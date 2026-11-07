#!/usr/bin/env python3
"""Xuất dữ liệu sổ cái cho dashboard Tơ Hồng HQ.

Đọc board/*.md, ledger/events.jsonl và org/roster.json, ghi ra 3 file JSON
(mảng các dòng) vào thư mục đích:

  tasks.json   — mỗi việc một dòng, kèm số giờ kể từ lần cập nhật cuối
  events.json  — nhật ký sự kiện, đánh số lại cho duy nhất (seq)
  roster.json  — sơ đồ tổ chức, trạng thái Hired / Need Hiring

Script chỉ đọc sổ cái, không ghi gì vào repo.

  python3 scripts/export_dashboard.py --out /tmp/tohong-dash
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import task  # noqa: E402  (dùng chung cách đọc file việc và thời gian)

ROOT = task.ROOT


PRIVATE_EVENT_FIELDS = ("detail", "link")


def product_of(area: str) -> str:
    """Sản phẩm của một việc: phần trước dấu '/' đầu của normalize_area; vùng rỗng hoặc lạ -> ''."""
    if not area or not isinstance(area, str):
        return ""
    try:
        return task.normalize_area(area).split("/", 1)[0]
    except task.LedgerError:
        return ""


GH = "https://github.com/phungrk/"
PR_RE = re.compile(r"https://github\.com/phungrk/([\w.-]+)/pull/(\d+)")
ASK_BLOCK_RE = re.compile(r"^\s*Chờ Capu\b", re.I)
KIND_ORDER = ["escalated", "decision", "blocked", "merge-c", "diff-b"]


def build_capu_queue(tasks, lines, issues=None):
    """Danh sách việc chờ Capu (spec T-076 D1-D5): chỉ đọc sổ cái, không token, không mạng."""
    evs = []
    for l in lines:
        try:
            evs.append(json.loads(l))
        except json.JSONDecodeError:
            pass
    nfc = lambda x: unicodedata.normalize("NFC", x or "")
    asks, answers, blocks, processed = {}, {}, {}, set()
    prs = task.collect_prs(evs)
    # M1 (T-083): link sự kiện merged của chính việc cũng là PR của việc
    for e in evs:
        if e.get("event") == "merged" and e.get("task") and task.PR_URL_RE.fullmatch(e.get("link") or ""):
            lst = prs.setdefault(e["task"], [])
            if e["link"] not in lst:
                lst.append(e["link"])
    for i, e in enumerate(evs):
        t, kind = e.get("task", ""), e.get("event", "")
        if kind == "merged":
            processed.add(e.get("link", ""))
        if not t:
            continue
        det = nfc(e.get("detail"))
        if kind == "blocked":
            blocks[t] = det
        if kind == "escalated" or (kind == "blocked" and ASK_BLOCK_RE.search(det)):
            asks[t] = i
        if kind in ("decided", "unblocked"):
            answers.setdefault(t, []).append((i, kind))
    inbox = {}
    idir = ROOT / "inbox" / "capu"
    if idir.is_dir():
        for f in sorted(idir.glob("T-*.md"), key=lambda f: f.name):
            m = re.match(r"(T-\d+)-", f.name)
            if m:
                inbox.setdefault(m.group(1), []).append(f)
    issues = issues or {}
    t_now = task.now()
    queue = []
    for t in tasks:
        tid, st = t["id"], t["state"]
        last_block = blocks.get(tid)
        block_asks = st == "blocked" and last_block is not None and bool(ASK_BLOCK_RE.search(last_block))
        if tid in asks:
            answered = any(i > asks[tid] for i, _ in answers.get(tid, []))
        else:
            answered = any(k == "decided" for _, k in answers.get(tid, []))
        block_asks = block_asks and not answered   # M4: đã trả lời thì không còn loại blocked
        kinds = set()
        files = inbox.get(tid, [])
        if files and not (st == "blocked" and not block_asks):
            if not answered:
                kinds.add("decision")
        if st == "escalated":
            kinds.add("escalated")
        if block_asks:
            kinds.add("blocked")
        links = []
        if kinds:
            if files:
                links.append({"label": "Decision Request", "url": f"{GH}tohong-hq/blob/main/inbox/capu/{files[-1].name}", "pr_state": ""})
            else:
                links.append({"label": "Decision Request", "url": f"{GH}tohong-hq/tree/main/inbox/capu", "pr_state": ""})
        tier = str(t.get("tier") or "")
        pr_links = []
        if t.get("owner") == "engineering" and st == "done" and tier in ("B", "C"):
            allpr = prs.get(tid, [])
            open_pr = [u for u in allpr if u not in processed]
            if open_pr:
                kinds.add("diff-b" if tier == "B" else "merge-c")
            elif not allpr:   # M2: luật 48 giờ chỉ khi tập PR rỗng
                hrs = (t_now - task.parse_stamp(t["updated"])).total_seconds() / 3600
                if hrs < 48:
                    kinds.add("diff-b" if tier == "B" else "merge-c")
            for u in open_pr:
                m = PR_RE.fullmatch(u)
                pr_links.append({"label": f"PR {m.group(1)}#{m.group(2)}", "url": u, "pr_state": "open"})
        if not kinds:
            continue
        # T-081 D-I1: link Issue (sau Decision Request, trước PR) khi board có issue là số nguyên dương
        iss = str(issues.get(tid, "")).strip()
        if len(iss) >= 2 and iss[0] == '"' and iss[-1] == '"':   # chỉ bỏ nháy kép khi có cặp bao ngoài
            iss = iss[1:-1].strip()
        if re.fullmatch(r"[1-9][0-9]*", iss):
            links.append({"label": f"Issue #{iss}", "url": f"{GH}tohong-hq/issues/{iss}", "pr_state": ""})
        links.extend(pr_links)
        decide_by = ""
        if files and kinds & {"escalated", "decision", "blocked"}:
            m = re.search(r"(?m)^decide-by:\s*(\d{4}-\d{2}-\d{2})", files[-1].read_text(encoding="utf-8", errors="replace"))
            decide_by = m.group(1) if m else ""
        kind = next(k for k in KIND_ORDER if k in kinds)
        queue.append({"task": tid, "kind": kind, "decide_by": decide_by, "links": links})
    return sorted(queue, key=lambda q: q["task"])

# --- Khối `model` (spec T-092 mục A): số liệu bể tri thức cho Knowledge Reservoir ---
_KR_PRE = re.compile(r'^(?:#+|//+|"""|\'\'\')+')
_KR_POST = re.compile(r'(?:"""|\'\'\')\s*$')
KR_URL = "https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/"


def _kr_clean(line):
    s = _KR_PRE.sub("", line.strip()).strip()
    return _KR_POST.sub("", s).strip()


def _kr_colon(s):
    """Dấu ':' đầu tiên nằm ngoài mọi cặp ngoặc tròn; -1 nếu không có."""
    depth = 0
    for i, c in enumerate(s):
        if c == "(":
            depth += 1
        elif c == ")":
            depth = max(0, depth - 1)
        elif c == ":" and depth == 0:
            return i
    return -1


def _kr_finish(t, slug):
    t = t.strip()
    k = t.find(". ")
    if k >= 0:
        t = t[:k]
    t = t.strip().rstrip(":").strip()
    if len(t) > 140:
        t = t[:140].rstrip() + "…"
    return t or slug.replace("-", " ")


_KW_CODE = ("import from def class return if elif else for while with try except finally raise assert print exit const let var function "
            "await async set export source cd echo python python3 node bash npm git grep curl fi done exec mkdir rm cp mv cat sed awk jq "
            "printf npx readonly declare local esac yield lambda trap touch chmod eval unset shift ls").split()
_KW_AMB = "test case then do pass find sort head tail true false diff command".split()
_KW_END = r"(?=$|[\s(\[{:;=.-])"
_KW_RE = re.compile(r"^(" + "|".join(_KW_CODE) + r")" + _KW_END)
_AMB_RE = re.compile(r"^(" + "|".join(_KW_AMB) + r")(?:$|\s*;|\s+(?=[-\"$/.\[('])|\s+(?=(?:" + "|".join(_KW_CODE) + r")" + _KW_END + "))")
_PIPE_RE = re.compile(r" \| *(?:" + "|".join(sorted(set(_KW_CODE) | set(_KW_AMB) | set("wc tr cut xargs tee uniq sh".split()))) + r")" + _KW_END)
_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\[\]'\"]*\s*(?:[-+*/|&%]|\*\*|//)?=(?!=)\s*\S")
_MULTI_RE = re.compile(r"^[A-Za-z_][\w.]*(?:\s*,\s*[A-Za-z_][\w.]*)+\s*=(?!=)")
_TYPED_RE = re.compile(r"^[A-Za-z_]\w*\s*:\s*[A-Za-z_][\w\[\], .]*=(?!=)")
_CALL_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*\(.*\)\s*;?$")
_OPEN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*\(")
_DATA_RE = re.compile(r'^"[\w.-]+"\s*:|^[a-z_]+:\s*[\["{]|^\S+\)\s*,?$|\)\s*;\s*\S')
_MACH_PATHS = ("/home/", "/root/", "/tmp/", "handoffs/", "C:\\", "/Users/", "/var/", "/opt/")
_CODE_SYMS = ("$", "{", "}", "|", "&", "!", "<", ">", "@", ";", "\\", "^", "~", "/", "%", "*", "+")
_CODE_INFIX = ("$(", "${", " && ", " || ", " == ", " != ", " => ", " === ", " !== ", "=>", "->", ">&", "2>")


def strip_trailing_comment(t):
    """T-094 muc A': cat chu thich cuoi dong. Chuoi nhay chi dong boi dung loai nhay da mo, khong xet '\\';
    chua dong thi khong cat. Khoang trang chi la [ \\t]. Chi diem tach dau tien (khoang trang ngoai chuoi,
    sau do '#' hoac '//' roi mot [ \\t], phia truoc co ky tu ngoai [ \\t])."""
    q = None
    for i, ch in enumerate(t):
        if q:
            if ch == q:
                q = None
        elif ch in "\"'":
            q = ch
        elif ch in " \t":
            r = t[i + 1:]
            if ((r[:1] == "#" and r[1:2] in (" ", "\t")) or (r[:2] == "//" and r[2:3] in (" ", "\t"))) and t[:i].strip(" \t"):
                return t[:i].rstrip(" \t")
    return t


def looks_like_code(s):
    """T-094 muc A + A': dong code hoac duong dan may thi khong dung lam ten; xet ca dong, roi phan head truoc chu thich cuoi dong."""
    t = s.strip()
    if not t:
        return False
    if _code_core(t):
        return True
    h = strip_trailing_comment(t)
    return h != t and _code_core(h)


def _code_core(t):
    if any(p in t for p in _MACH_PATHS) or t.startswith(_CODE_SYMS) or t.endswith("{"):
        return True
    if any(x in t for x in _CODE_INFIX):
        return True
    if _PIPE_RE.search(t) and (t.isascii() or _KW_RE.match(t) or _AMB_RE.match(t)):
        return True
    if not t.split()[0].isupper() and (_KW_RE.match(t) or _AMB_RE.match(t)):
        return True
    if t.isascii() and (_DATA_RE.search(t) or t.startswith(('"', "(")) or t.count(")") > t.count("(")):
        return True
    if _ASSIGN_RE.match(t) or _MULTI_RE.match(t) or _TYPED_RE.match(t) or _CALL_RE.match(t):
        return True
    return bool(_OPEN_RE.match(t) and (t.isascii() or t.count("(") > t.count(")") or t.endswith("(")))


def kr_name(text, slug, fname=""):
    ls = [_kr_clean(l) for l in text.split("\n")[:12]]
    for i, l in enumerate(ls):
        if not l.lower().startswith("bất biến"):
            continue
        k = _kr_colon(l)
        head, tail = (l[:k], l[k + 1:].strip()) if k >= 0 else (l, "")
        if tail and not tail.lower().startswith("nguồn") and not head.rstrip().lower().endswith("nguồn"):
            if not looks_like_code(tail):
                return _kr_finish(tail, slug)
            break
        j = i + 1
        if not l.rstrip().endswith((".", ":")):
            while j < len(ls) and ls[j] and not ls[j].rstrip().endswith((".", ":")):
                j += 1
            j += 1
        for m in ls[j:]:
            if len(m) >= 50 and not m.lower().startswith("chỉ xanh") and not looks_like_code(m):
                return _kr_finish(m, slug)
        break
    for l in ls:
        m = re.match(r"^INV-\d+\s*(?:\([^)]*\))?\s*·\s*(.+)$", l, re.I)
        if m:
            if looks_like_code(m.group(1)):
                break
            return _kr_finish(m.group(1), slug)
    return _kr_finish("", slug) or fname


def kr_source(text):
    t = "\n".join(text.split("\n")[:12])
    i = t.lower().find("nguồn")
    if i < 0:
        return ""
    m = re.search(r"T-\d+", t[i:])
    return m.group(0) if m else ""


def build_model(public: bool) -> dict:
    inv_root = ROOT / "eval" / "invariants"
    items = []
    if inv_root.is_dir():
        for f in inv_root.rglob("*"):
            if not (f.name.startswith("inv-") and f.is_file()):
                continue
            at_root = f.parent == inv_root
            area = "_root" if at_root else f.parent.relative_to(inv_root).as_posix()
            m = re.match(r"inv-(\d+)", f.name)
            num = m.group(1) if m else None
            slug = re.sub(r"^inv-(?:\d+-?)?", "", f.name)
            slug = slug.rsplit(".", 1)[0] if "." in slug else slug
            text = f.read_text(encoding="utf-8", errors="replace")
            it = {"area": area, "id": "INV-" + (num if num else "?"), "slug": slug,
                  "name": kr_name(text, slug, f.name), "source": kr_source(text), "url": KR_URL + ("" if at_root else area + "/") + f.name}
            if not public:
                it["path"] = "eval/invariants/" + ("" if at_root else area + "/") + f.name
            items.append(((area != "_shared", area, int(num) if num else 10 ** 9, f.name), it))
    items.sort(key=lambda x: x[0])
    lst = [x[1] for x in items]
    inv = {}
    for x in lst:
        inv[x["area"]] = inv.get(x["area"], 0) + 1
    adv = 0
    ev = ROOT / "eval"
    if ev.is_dir():
        for d in ev.iterdir():
            if d.is_dir() and re.fullmatch(r"T-\d+", d.name):
                adv += sum(1 for c in d.iterdir() if c.is_file() and c.name.startswith("adv-"))
    reg = ev / "regression"
    regn = sum(1 for p in reg.iterdir() if not p.name.startswith(".") and p.name != "README.md") if reg.is_dir() else 0
    pdir = ROOT / "products"
    specs = sum(1 for p in pdir.glob("T-*.md") if p.is_file()) if pdir.is_dir() else 0
    idir = ROOT / "insights"
    ins = sorted(p.name for p in idir.glob("*-weekly.md") if p.is_file()) if idir.is_dir() else []
    return {"invariants": inv, "invariants_total": len(lst), "invariant_list": lst, "adversarial_evals": adv,
            "regression_evals": regn, "specs": specs, "insight_reports": len(ins),
            "last_insight": ins[-1] if ins else ""}


def export(out: Path, public: bool = False):
    out.mkdir(parents=True, exist_ok=True)
    as_of = task.now()
    stamp = task.stamp(as_of)

    tasks = []
    for t in task.all_tasks():
        hours = round((as_of - task.parse_stamp(t["updated"])).total_seconds() / 3600, 1)
        tasks.append({
            "id": t["id"], "title": t["title"], "state": t["state"], "holder": t["holder"],
            "owner": t["owner"], "reviewer": t["reviewer"], "rounds": t["rounds"],
            "version": t["version"], "deadline": t.get("deadline", ""), "budget": t.get("budget", ""),
            "cost": t["cost"], "created": t["created"], "updated": t["updated"],
            "hours_since_update": hours, "pipeline": f"{t['owner']} → {t['reviewer']}", "as_of": stamp,
            "tier": str(t.get("tier") or ""), "area": t.get("area", ""), "product": product_of(t.get("area", "")), "evals": len(t.get("eval", [])),
            "spec_returns": t.get("spec_returns", 0), "evals_added": t.get("evals_added", 0),
        })

    events = []
    lines = []
    if task.LEDGER.exists():
        # bỏ dòng trùng y hệt (có thể sinh ra khi rebase nhánh có nhật ký gộp hai phía)
        lines = list(dict.fromkeys(l for l in task.LEDGER.read_text(encoding="utf-8").splitlines() if l.strip()))
        for i, line in enumerate(lines, 1):
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            events.append({
                "seq": f"S-{i:05d}", "ledger_id": e.get("id", ""), "t": e.get("t", ""),
                "task": e.get("task", ""), "title": e.get("title", ""), "event": e.get("event", ""),
                "from": e.get("from", ""), "to": e.get("to", ""), "round": e.get("round", 0),
                "severity": e.get("severity", ""), "detail": e.get("detail", ""),
                "link": e.get("link", ""), "cost": float(e.get("cost", 0) or 0),
                "state": e.get("state", ""), "holder": e.get("holder", ""),
            })
        events.sort(key=lambda e: (e["t"], e["seq"]))

    roster_src = json.loads((ROOT / "org" / "roster.json").read_text(encoding="utf-8"))
    roster = []
    for r in roster_src["roles"]:
        f = r.get("agent_file", "")
        hired = r["kind"] == "human" or (f and (ROOT / f).exists())
        roster.append({
            "id": r["id"], "name": r["name"], "role": r["role"], "kind": r["kind"],
            "reports_to": r.get("reports_to", ""), "mission": r.get("mission", ""),
            "agent_file": f, "status": "Hired" if hired else "Need Hiring", "as_of": stamp,
        })

    # Số eval hồi quy: mục cấp một của eval/regression/ (trừ tên bắt đầu '.' và README.md); null nếu thiếu thư mục
    reg_dir = ROOT / "eval" / "regression"
    regression_evals = None
    if reg_dir.is_dir():
        regression_evals = sum(1 for p in reg_dir.iterdir() if not p.name.startswith(".") and p.name != "README.md")

    issue_map = {t["id"]: t.get("issue", "") for t in task.all_tasks()}   # chỉ để dựng link trong capu_queue, không vào tasks[]
    capu_queue = build_capu_queue(tasks, lines, issue_map)

    if public:
        # Bản công khai: bỏ nội dung chi tiết (defect, ghi chú, đường dẫn file)
        for e in events:
            for k in PRIVATE_EVENT_FIELDS:
                e.pop(k, None)

    for name, rows in (("tasks", tasks), ("events", events), ("roster", roster)):
        (out / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    bundle = {"generated_at": stamp, "timezone": "Asia/Ho_Chi_Minh", "public": public,
              "regression_evals": regression_evals, "tasks": tasks, "events": events, "roster": roster,
              "capu_queue": capu_queue, "model": build_model(public)}
    (out / "dashboard.json").write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    print(f"Đã xuất lúc {stamp}{' (bản công khai)' if public else ''}: {len(tasks)} việc, {len(events)} sự kiện, "
          f"{sum(r['status'] == 'Hired' for r in roster)}/{len(roster)} vị trí đã có người → {out}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Xuất dữ liệu cho dashboard")
    p.add_argument("--out", required=True, help="Thư mục ghi tasks.json, events.json, roster.json, dashboard.json")
    p.add_argument("--public", action="store_true", help="Bỏ nội dung chi tiết để đăng công khai")
    a = p.parse_args()
    export(Path(a.out), public=a.public)
