#!/usr/bin/env python3
"""Chi phí thật của từng agent, tính từ usage token trong transcript của Claude Code.

Hook (cấu hình trong .claude/settings.json, đọc JSON từ stdin):
  SubagentStop      → tính transcript của subagent vừa xong (agent_transcript_path),
                      ghi cho agent_type, gắn mã T-xxx đầu tiên trong lời giao việc.
  Stop, SessionEnd  → tính phần TĂNG THÊM của transcript phiên chính (transcript_path),
                      ghi cho chief-of-staff; rồi quét lại subagents/ của phiên để bắt
                      phần còn sót (transcript ghi trễ, hook SubagentStop lỗi...).

Không đếm trùng:
  - Mỗi tin nhắn API có một message.id; một tin ghi thành nhiều dòng (mỗi khối nội dung
    một dòng, cùng usage) nên gộp theo message.id.
  - Phiên chính và mỗi subagent nằm ở file transcript riêng; phiên chính không chứa
    tin của subagent, nên hai phần không chồng nhau.
  - Mỗi sự kiện chi phí mang con trỏ "src" = {session, agent, msgs, last}. Lần sau chỉ
    tính các tin nằm SAU tin "last" của con trỏ mới nhất cùng (session, agent).
    Con trỏ nằm trong chính ledger/events.jsonl nên sống qua phiên bị dừng hay đổi máy.

Giá: scripts/pricing.json (có nguồn và ngày kiểm). Model không có trong bảng giá thì vẫn
ghi sự kiện, cost của phần đó = 0, kèm severity "warning" và số token chưa tính.

Hook không bao giờ chặn agent: không in gì ra stdout, luôn thoát mã 0; lỗi thì ghi một
sự kiện "cost_warning" (nếu ghi được) rồi bỏ qua.

Chạy tay:
  python3 scripts/cost.py report <transcript.jsonl>     # chỉ in, không ghi gì
  python3 scripts/cost.py sync <transcript-phiên-chính.jsonl> [--session ID]
                                                        # ghi như hook Stop (phiên cũ chưa có hook)
  python3 scripts/cost.py install-hook [--settings FILE]
                                                        # CHỈ người gọi tay (Capu, hoặc Chief of Staff
                                                        # sau khi Capu duyệt). Không lệnh nào tự chạy nó.
  python3 scripts/cost.py backfill <phiên> [--projects-dir DIR] [--final] [--dry-run]
                                  [--expect-usd X.XXXX] [--allow-running]
                                                        # mã thoát: 0 xong, 1 không có transcript hoặc
                                                        # dry-run còn thiếu, 2 lỗi, 3 không giữ được khóa,
                                                        # 5 --expect-usd lệch, 6 --final trên phiên đang chạy
"""
import argparse
import glob
import json
import os
import re
import shlex
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import task  # noqa: E402

PRICING_FILE = HERE / "pricing.json"
MAIN_AGENT = "chief-of-staff"
TASK_RE = re.compile(r"\bT-\d{3,}\b")


# ---------- giá ----------
def load_pricing():
    return json.loads(PRICING_FILE.read_text(encoding="utf-8"))


def find_model(pricing, model):
    models = pricing["models"]
    if model in models:
        return models[model]
    base = re.sub(r"-\d{8}$", "", model or "")   # vd claude-haiku-4-5-20251001
    return models.get(base)


def message_cost(pricing, model, u):
    """Trả về (usd, cảnh báo hoặc ""). Cảnh báo khi model lạ hoặc thiếu giá cho chế độ đặc biệt."""
    p = find_model(pricing, model)
    if p is None:
        return 0.0, f"model lạ '{model}' chưa có trong scripts/pricing.json"
    warn = ""
    inp = int(u.get("input_tokens") or 0)
    out = int(u.get("output_tokens") or 0)
    cr = int(u.get("cache_read_input_tokens") or 0)
    cw = int(u.get("cache_creation_input_tokens") or 0)
    cc = u.get("cache_creation") or {}
    cw1h = int(cc.get("ephemeral_1h_input_tokens") or 0)
    cw5m = int(cc.get("ephemeral_5m_input_tokens") or 0)
    if cw5m + cw1h != cw:          # không có chi tiết: coi phần còn lại là cache 5 phút
        cw5m = max(cw - cw1h, 0)
    rates = p
    if p.get("long_prompt_over") and inp + cr + cw > p["long_prompt_over"]:
        rates = p["long"]
    if u.get("speed") == "fast":
        if "fast" in p:
            rates = p["fast"]
        else:
            warn = f"chế độ fast của '{model}' chưa có giá, tạm tính giá thường"
    usd = (inp * rates["input"] + out * rates["output"] + cr * rates["cache_read"]
           + cw5m * rates["cache_write_5m"] + cw1h * rates["cache_write_1h"]) / 1e6
    if u.get("inference_geo") == "us":
        usd *= pricing.get("us_inference_multiplier", 1.1)
    searches = int((u.get("server_tool_use") or {}).get("web_search_requests") or 0)
    usd += searches * pricing.get("web_search_per_1000", 10.0) / 1000
    return usd, warn


# ---------- transcript ----------
def read_transcript(path):
    """Danh sách tin API theo thứ tự xuất hiện, gộp theo message.id (lấy usage của dòng cuối)."""
    msgs, order = {}, []
    first_user, agent_name = None, ""
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue          # dòng cuối có thể đang ghi dở
            if not agent_name and r.get("attributionAgent"):
                agent_name = r["attributionAgent"]
            if first_user is None and r.get("type") == "user":
                c = (r.get("message") or {}).get("content")
                first_user = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
            if r.get("type") != "assistant":
                continue
            m = r.get("message") or {}
            mid = m.get("id") or r.get("requestId") or r.get("uuid")
            if not mid or not m.get("usage"):
                continue
            if mid not in msgs:
                order.append(mid)
            msgs[mid] = {"id": mid, "model": m.get("model", ""), "usage": m["usage"],
                         "stop_reason": m.get("stop_reason"), "t": r.get("timestamp", "")}
    return [msgs[i] for i in order], (first_user or ""), agent_name


def is_empty(u):
    keys = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
    return not any(int(u.get(k) or 0) for k in keys)


def summarize(pricing, msgs):
    """Cộng tiền và token theo model. Trả về (usd, theo_model, cảnh báo)."""
    total, by_model, warns = 0.0, {}, []
    for m in msgs:
        u = m["usage"]
        if is_empty(u):            # tin tổng hợp nội bộ (model "<synthetic>"), không tốn tiền
            continue
        usd, w = message_cost(pricing, m["model"], u)
        if w and w not in warns:
            warns.append(w)
        b = by_model.setdefault(m["model"], {"calls": 0, "usd": 0.0, "in": 0, "out": 0, "cr": 0, "cw": 0})
        b["calls"] += 1
        b["usd"] += usd
        b["in"] += int(u.get("input_tokens") or 0)
        b["out"] += int(u.get("output_tokens") or 0)
        b["cr"] += int(u.get("cache_read_input_tokens") or 0)
        b["cw"] += int(u.get("cache_creation_input_tokens") or 0)
        total += usd
    return total, by_model, warns


def fmt_tokens(n):
    return f"{n / 1e6:.2f}M" if n >= 1e6 else (f"{n / 1e3:.1f}k" if n >= 1e3 else str(n))


def describe(by_model, origin):
    parts = [f"{mdl}: {b['calls']} lượt, in {fmt_tokens(b['in'])} / out {fmt_tokens(b['out'])} / "
             f"cache đọc {fmt_tokens(b['cr'])} / cache ghi {fmt_tokens(b['cw'])} = ${b['usd']:.4f}"
             for mdl, b in by_model.items()]
    return f"Tự động từ usage trong transcript ({origin}); " + "; ".join(parts)


# ---------- con trỏ trong ledger ----------
def cursor_map():
    """Con trỏ mới nhất của mỗi (session, agent), đọc sổ cái một lần."""
    cur = {}
    for e in task.read_events():
        src = e.get("src")
        if isinstance(src, dict) and src.get("session") and src.get("agent"):
            cur[(src["session"], src["agent"])] = src
    return cur


def last_cursor(session, agent_key, cmap=None):
    return (cmap if cmap is not None else cursor_map()).get((session, agent_key))


def pending(msgs, cursor, final):
    """Các tin chưa tính. final=False: chỉ tin CUỐI CÙNG của file mà stop_reason còn rỗng bị hoãn
    (con trỏ dừng ngay trước nó). Tin rỗng ở giữa vẫn tính theo usage hiện có."""
    start = 0
    if cursor:
        ids = [m["id"] for m in msgs]
        if cursor.get("last") not in ids:
            raise RuntimeError(f"không thấy tin {cursor.get('last')} của con trỏ trước trong transcript; "
                               f"bỏ qua để tránh đếm trùng")
        start = ids.index(cursor["last"]) + 1
    new = msgs[start:]
    if not final and new and not new[-1].get("stop_reason"):
        new = new[:-1]
    return new, start


def plan_account(pricing, parsed, session, agent_key, final, cursor):
    """Tính phần chưa ghi từ transcript đã đọc. Trả về None nếu không có gì mới."""
    msgs = parsed[0]
    new, start = pending(msgs, cursor, final)
    if not new:
        return None
    usd, by_model, warns = summarize(pricing, new)
    return {"new": new, "start": start, "usd": usd, "by_model": by_model, "warns": warns}


def write_plan(pricing, pl, session, agent_key, agent, tid, origin):
    """Ghi sự kiện cho một kế hoạch đã tính (không đọc lại transcript)."""
    new, by_model, warns, usd = pl["new"], pl["by_model"], pl["warns"], pl["usd"]
    note = describe(by_model, origin) if by_model else f"Tự động từ transcript ({origin}); không có token tính tiền"
    note += f"; giá theo scripts/pricing.json (kiểm {pricing.get('checked', '?')})"
    if warns:
        note += "; CẢNH BÁO: " + "; ".join(warns)
    src = {"session": session, "agent": agent_key, "msgs": pl["start"] + len(new), "last": new[-1]["id"]}
    if tid:
        try:
            task.read_task(tid)
        except task.LedgerError:
            note += f"; mã {tid} không có trong board/, ghi task rỗng"
            tid = ""
    return task.record_cost(tid, agent, usd, note, severity="warning" if warns else "",
                            extra={"src": src})


def account(pricing, path, session, agent_key, agent, tid, final, origin):
    """Ghi phần chưa tính của một transcript. Trả về dòng sự kiện, hoặc None nếu không có gì mới."""
    pl = plan_account(pricing, read_transcript(path), session, agent_key, final, last_cursor(session, agent_key))
    return write_plan(pricing, pl, session, agent_key, agent, tid, origin) if pl else None


def subagent_info(path, agent_type="", parsed=None):
    _, first_user, attributed = parsed or read_transcript(path)
    m = TASK_RE.search(first_user)
    agent = agent_type or attributed or MAIN_AGENT   # agent nội bộ của Claude Code: tính cho phiên chính
    return agent, (m.group(0) if m else "")


def agent_key_of(path):
    stem = Path(path).stem
    return stem[len("agent-"):] if stem.startswith("agent-") else stem


def handle_subagent(pricing, session, path, agent_type, agent_id, final=True):
    agent, tid = subagent_info(path, agent_type)
    return account(pricing, path, session, agent_id or agent_key_of(path), agent, tid, final,
                   f"subagent {agent_id or agent_key_of(path)}")


def handle_main(pricing, session, transcript):
    rows = []
    try:
        r = account(pricing, transcript, session, "main", MAIN_AGENT, "", True, "phiên chính")
        if r:
            rows.append(r)
    except Exception as e:  # phần phiên chính lỗi vẫn quét tiếp subagent
        warn(session, MAIN_AGENT, f"phiên chính: {e}")
    sub_dir = Path(transcript).with_suffix("") / "subagents"
    for p in sorted(glob.glob(str(sub_dir / "agent-*.jsonl"))):
        try:
            r = handle_subagent(pricing, session, p, "", "", final=False)
            if r:
                rows.append(r)
        except Exception as e:  # một subagent lỗi không làm mất phần của các subagent khác
            warn(session, MAIN_AGENT, f"quét {Path(p).name}: {e}")
    return rows


def warn(session, agent, msg):
    """Ghi một cảnh báo (cost 0) vào ledger, mỗi nội dung một lần cho mỗi phiên."""
    try:
        detail = f"Không ghi được chi phí tự động: {msg}"
        for e in task.read_events():
            if e.get("event") == "cost_warning" and e.get("detail") == detail and \
                    (e.get("src") or {}).get("session") == session:
                return
        task.record_cost("", agent or MAIN_AGENT, 0.0, detail, severity="warning", event="cost_warning",
                         extra={"src": {"session": session, "agent": "warning"}})
    except Exception:
        pass


def run_hook(data):
    event = data.get("hook_event_name", "")
    session = data.get("session_id", "") or "unknown"
    pricing = load_pricing()
    with task.ledger_lock():
        if event == "SubagentStop":
            path = os.path.expanduser(data.get("agent_transcript_path") or "")
            if path and os.path.exists(path):
                try:
                    handle_subagent(pricing, session, path, data.get("agent_type") or "", data.get("agent_id") or "")
                except Exception as e:
                    warn(session, data.get("agent_type"), f"subagent {data.get('agent_id')}: {e}")
            else:
                warn(session, data.get("agent_type"), f"SubagentStop không có agent_transcript_path đọc được ({path})")
        elif event in ("Stop", "SessionEnd"):
            path = os.path.expanduser(data.get("transcript_path") or "")
            if path and os.path.exists(path):
                handle_main(pricing, session, path)
            else:
                warn(session, MAIN_AGENT, f"{event} không có transcript_path đọc được ({path})")


# ---------- install-hook ----------
HOOK_EVENTS = ("SubagentStop", "Stop", "SessionEnd")
def is_cost_hook(command):
    """Lệnh gọi đúng file tên cost.py (basename) với đối số đầu sau nó là `hook`."""
    try:
        toks = shlex.split(str(command))
    except ValueError:
        toks = str(command).split()
    return any(os.path.basename(t.strip("'\"")) == "cost.py" and i + 1 < len(toks) and toks[i + 1] == "hook"
               for i, t in enumerate(toks))


def hook_command():
    return f"python3 {shlex.quote(str(Path(__file__).resolve()))} hook"


def install_hooks(settings):
    """Đặt đúng một hook cost.py hook (đường dẫn tuyệt đối) cho mỗi sự kiện trong HOOK_EVENTS.
    Chỉ chạm settings['hooks'][sự kiện đó]; trả về settings mới (đối tượng mới)."""
    out = json.loads(json.dumps(settings))
    hooks = out.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise ValueError("khoá 'hooks' không phải đối tượng JSON")
    cmd = hook_command()
    for ev in HOOK_EVENTS:
        groups = hooks.setdefault(ev, [])
        if not isinstance(groups, list) or not all(isinstance(g, dict) and isinstance(g.get("hooks", []), list)
                                                    for g in groups):
            raise ValueError(f"hooks.{ev} có cấu trúc lạ, không dám sửa")
        done = False
        for g in list(groups):
            kept = []
            had = bool(g.get("hooks"))
            for h in g.get("hooks", []):
                if isinstance(h, dict) and is_cost_hook(h.get("command", "")):
                    if done:
                        continue          # hook cost thừa: bỏ
                    h["command"] = cmd    # thay tại chỗ
                    done = True
                kept.append(h)
            g["hooks"] = kept
            if had and not kept:
                groups.remove(g)      # nhóm chỉ chứa hook cost cũ; nhóm rỗng sẵn của người khác giữ nguyên
        if not done:
            groups.append({"hooks": [{"type": "command", "command": cmd}]})
    return out


def cmd_install_hook(settings_arg):
    path = Path(os.path.expanduser(settings_arg or "~/.claude/settings.json"))
    path = Path(os.path.realpath(path))
    cur = {}
    if path.exists():
        try:
            cur = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(cur, dict):
                raise ValueError("gốc không phải đối tượng JSON")
        except ValueError as e:
            print(f"Lỗi: {path} không phải JSON hợp lệ ({e}); giữ nguyên file", file=sys.stderr)
            return 2
    try:
        new = install_hooks(cur)
    except ValueError as e:
        print(f"Lỗi: {path}: {e}; giữ nguyên file", file=sys.stderr)
        return 2
    if path.exists() and new == cur:
        print(f"{path}: đã có đủ hook, không đổi")
        return 0
    path = Path(os.path.realpath(path))       # symlink: ghi vào file đích, giữ nguyên symlink
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(new, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if path.exists():
        os.chmod(tmp, path.stat().st_mode & 0o7777)   # giữ quyền (vd 0600)
    os.replace(tmp, path)
    print(f"{path}: đã đăng ký hook cost.py cho {', '.join(HOOK_EVENTS)}")
    return 0


# ---------- backfill ----------
RUNNING_WINDOW_S = 300


def _pick(cands, cursor_last):
    """cands: [(path, ids)]. Chọn file chứa cursor_last (nếu có), rồi nhiều message.id nhất, rồi tên nhỏ hơn."""
    pool = [c for c in cands if cursor_last and cursor_last in c[1]] or cands
    return sorted(pool, key=lambda c: (-len(c[1]), str(c[0])))[0]


def cmd_backfill(a):
    """Trả về mã thoát (xem spec T-101 mục 5-10)."""
    expect = None
    if a.expect_usd is not None:
        try:
            expect = float(a.expect_usd)
            if expect != expect or expect in (float("inf"), float("-inf")):
                raise ValueError
        except ValueError:
            print(f"Lỗi: --expect-usd phải là số (vd 882.1605), nhận {a.expect_usd!r}; không ghi gì", file=sys.stderr)
            return 2
    projects = Path(os.path.expanduser(a.projects_dir or "~/.claude/projects"))
    # mã phiên là tên file nguyên văn, không phải mẫu glob
    files = sorted(f for f in glob.glob(str(Path(glob.escape(str(projects))) / "*" / (glob.escape(a.session) + ".jsonl")))
                   if Path(f).name == a.session + ".jsonl")
    if not files:
        print(f"Không có transcript nào của phiên {a.session} trong {projects}", file=sys.stderr)
        return 1
    # đọc mọi transcript MỘT lần, ngoài khoá (phần nặng nhất); trong khoá chỉ tra cứu và ghi
    parsed = {}
    subfiles = []
    for f in files:
        parsed[f] = read_transcript(f)
        subfiles += sorted(glob.glob(str(Path(glob.escape(str(Path(f).with_suffix("")))) / "subagents" / "agent-*.jsonl")))
    for p in subfiles:
        parsed[p] = read_transcript(p)
    if a.dry_run:
        return _backfill(a, files, subfiles, parsed, expect, write=False)
    try:
        with task.ledger_lock(strict=True):
            return _backfill(a, files, subfiles, parsed, expect, write=True)
    except task.LedgerLockError as e:
        print(f"Lỗi: {e}; không ghi gì", file=sys.stderr)
        return 3


def _backfill(a, files, subfiles, parsed, expect, write):
    session, errors = a.session, []
    pricing = load_pricing()
    cmap = cursor_map()                       # sổ cái đọc một lần
    idsets = {f: {m["id"] for m in parsed[f][0]} for f in files}
    main = _pick([(f, idsets[f]) for f in files], (last_cursor(session, "main", cmap) or {}).get("last"))[0]
    for f in files:
        extra = idsets[f] - idsets[main]
        if f != main and extra:
            print(f"Lỗi: {f} có {len(extra)} message.id không thuộc file chính {main} "
                  f"(hai nhánh khác nhau); không ghi gì", file=sys.stderr)
            return 2
    by_agent = {}
    for p in subfiles:
        by_agent.setdefault(agent_key_of(p), []).append((p, {m["id"] for m in parsed[p][0]}))
    subs = {k: _pick(c, (last_cursor(session, k, cmap) or {}).get("last"))[0] for k, c in sorted(by_agent.items())}
    if a.final and write:
        now = time.time()
        recent = [p for p in list(files) + list(subs.values()) if now - os.path.getmtime(p) < RUNNING_WINDOW_S]
        if recent:
            msg = (f"--final trên phiên có transcript sửa trong {RUNNING_WINDOW_S} giây gần nhất "
                   f"({Path(recent[0]).name}...): phiên có thể còn chạy, tin cuối sẽ mất phần tăng thêm")
            if not a.allow_running:
                print(f"Lỗi: {msg}; không ghi gì (--allow-running để bỏ qua)", file=sys.stderr)
                return 6
            print(f"CẢNH BÁO: {msg}", file=sys.stderr)
    targets = [("main", MAIN_AGENT, "", main, "phiên chính")]
    for k, p in subs.items():
        agent, tid = subagent_info(p, parsed=parsed[p])
        targets.append((k, agent, tid, p, f"subagent {k}"))
    n_msgs, usd, plans = 0, 0.0, []
    for key, agent, tid, p, origin in targets:
        try:
            pl = plan_account(pricing, parsed[p], session, key, a.final, last_cursor(session, key, cmap))
        except Exception as e:
            errors.append(f"{origin}: {e}")
            continue
        if pl:
            n_msgs += len(pl["new"])
            usd += pl["usd"]
            plans.append((pl, key, agent, tid, origin))
    if not write:
        for e in errors:
            print(f"Lỗi: {e}", file=sys.stderr)
        if errors:
            return 2
        print(f"PENDING msgs={n_msgs} usd={usd:.4f}")
        return 1 if n_msgs else 0
    if expect is not None and f"{usd:.4f}" != f"{expect:.4f}":
        print(f"Lỗi: số sắp ghi ${usd:.4f} khác --expect-usd {a.expect_usd}; không ghi gì", file=sys.stderr)
        return 5
    rows = []
    for pl, key, agent, tid, origin in plans:    # ghi đúng phần đã tính và đã so với --expect-usd
        try:
            rows.append(write_plan(pricing, pl, session, key, agent, tid, origin))
        except Exception as e:
            errors.append(f"{origin}: {e}")
    for r in rows:
        print(f"{r['id']} {r['from']:<15} {r['task'] or '-':<6} ${r['cost']}")
    print(f"Đã ghi {len(rows)} sự kiện chi phí")
    for e in errors:
        print(f"Lỗi (bỏ phần này, đã ghi phần còn lại): {e}", file=sys.stderr)
    return 2 if errors else 0


# ---------- chạy tay ----------
def cmd_report(paths):
    pricing = load_pricing()
    grand = 0.0
    per_agent = {}
    for path in paths:
        msgs, first_user, attributed = read_transcript(path)
        usd, by_model, warns = summarize(pricing, msgs)
        m = TASK_RE.search(first_user) if attributed else None
        who = attributed or MAIN_AGENT
        grand += usd
        per_agent[who] = per_agent.get(who, 0.0) + usd
        print(f"{Path(path).name}  agent={who}  task={m.group(0) if m else '-'}  ${usd:.4f}")
        for mdl, b in by_model.items():
            print(f"    {mdl}: {b['calls']} lượt  in {b['in']}  out {b['out']}  cache đọc {b['cr']}  "
                  f"cache ghi {b['cw']}  ${b['usd']:.4f}")
        for w in warns:
            print(f"    CẢNH BÁO: {w}")
    print("Theo agent: " + ", ".join(f"{k} ${v:.4f}" for k, v in sorted(per_agent.items())))
    print(f"Tổng: ${grand:.4f}")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "hook":
        try:
            run_hook(json.load(sys.stdin))
        except Exception as e:
            warn("unknown", MAIN_AGENT, f"lỗi hook: {type(e).__name__}: {e}")
        sys.exit(0)   # không in gì ra stdout: Stop hook đọc stdout như quyết định
    p = argparse.ArgumentParser(description="Chi phí từ transcript Claude Code")
    sub = p.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("report", help="In chi phí từng transcript, không ghi gì")
    sp.add_argument("paths", nargs="+")
    sp = sub.add_parser("sync", help="Ghi chi phí còn thiếu của một phiên, như hook Stop")
    sp.add_argument("transcript")
    sp.add_argument("--session", default="", help="Mặc định: tên file transcript")
    sp = sub.add_parser("install-hook", help="Đăng ký hook cost.py (đường dẫn tuyệt đối) vào settings.json cấp người dùng. "
                                              "Chỉ người gọi tay (Capu, hoặc Chief of Staff sau khi Capu duyệt)")
    sp.add_argument("--settings", default="", help="Ghi FILE này thay $HOME/.claude/settings.json")
    sp = sub.add_parser("backfill", help="Bù chi phí còn thiếu của một phiên theo mã phiên")
    sp.add_argument("session")
    sp.add_argument("--projects-dir", default="", help="Mặc định $HOME/.claude/projects")
    sp.add_argument("--final", action="store_true", help="Tính cả tin cuối còn dở (chỉ cho phiên đã kết thúc)")
    sp.add_argument("--dry-run", action="store_true", help="Không ghi; in PENDING msgs=<n> usd=<x>; thoát 1 nếu n>0")
    sp.add_argument("--expect-usd", default=None, help="Số tiền sắp ghi phải bằng X.XXXX, lệch thì thoát 5")
    sp.add_argument("--allow-running", action="store_true", help="Cho --final chạy trên phiên có vẻ còn chạy")
    a = p.parse_args()
    if a.cmd == "report":
        cmd_report(a.paths)
    elif a.cmd == "install-hook":
        sys.exit(cmd_install_hook(a.settings))
    elif a.cmd == "backfill":
        sys.exit(cmd_backfill(a))
    else:
        session = a.session or Path(a.transcript).stem
        with task.ledger_lock():
            rows = handle_main(load_pricing(), session, a.transcript)
        for r in rows:
            print(f"{r['id']} {r['from']:<15} {r['task'] or '-':<6} ${r['cost']}")
        print(f"Đã ghi {len(rows)} sự kiện chi phí")


if __name__ == "__main__":
    main()
