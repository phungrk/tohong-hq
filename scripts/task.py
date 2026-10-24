#!/usr/bin/env python3
"""Sổ cái Tơ Hồng HQ: tạo việc, đổi trạng thái theo luật, ghi nhật ký sự kiện.

Mọi thay đổi trạng thái của việc PHẢI đi qua script này. Script:
  - kiểm tra lần chuyển trạng thái có hợp lệ không,
  - cập nhật phần đầu (frontmatter) và lịch sử của board/T-xxx.md,
  - ghi thêm một dòng vào ledger/events.jsonl (chỉ ghi thêm, không sửa).

Ví dụ:
  python3 scripts/task.py new --title "PRD bộ lọc ngân sách" --to product \
      --goal "Cặp đôi lọc vendor theo ngân sách" \
      --criteria "Có giả thuyết kèm chỉ số" --criteria "Có ít nhất 5 tiêu chí chấp nhận"
  python3 scripts/task.py start T-001 --by product
  python3 scripts/task.py handoff T-001 --by product --note "Bản PRD v1" --link handoffs/T-001-v1.md
  python3 scripts/task.py reject T-001 --by reviewer --against "tiêu chí 2" --severity blocker --note "Thiếu chỉ số"
  python3 scripts/task.py accept T-001 --by reviewer
  python3 scripts/task.py summary
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Asia/Ho_Chi_Minh")
except Exception:  # pragma: no cover
    TZ = None

ROOT = Path(os.environ.get("TOHONG_ROOT", Path(__file__).resolve().parent.parent))
BOARD = ROOT / "board"
LEDGER = ROOT / "ledger" / "events.jsonl"

STATES = ["new", "doing", "review", "rework", "blocked", "escalated", "done"]
STATE_VI = {
    "new": "Mới", "doing": "Đang làm", "review": "Chờ review", "rework": "Rework",
    "blocked": "Bị chặn", "escalated": "Leo thang", "done": "Xong",
}
EVENT_VI = {
    "assigned": "Giao việc", "started": "Bắt đầu", "handoff": "Bàn giao", "rejected": "Trả về",
    "accepted": "Chấp nhận", "blocked": "Báo bị chặn", "unblocked": "Gỡ chặn",
    "escalated": "Leo thang", "decided": "Capu quyết định",
}
FIELDS = ["id", "title", "state", "holder", "owner", "reviewer", "rounds", "version",
          "deadline", "escalation", "created", "updated", "prev_state", "cost"]
MAX_ROUNDS = 2          # vòng trả về tối đa trước khi tự động leo thang
STALL_HOURS = 24        # quá ngưỡng này không có sự kiện = đứng yên


class LedgerError(Exception):
    pass


# ---------- thời gian ----------
def now():
    override = os.environ.get("TOHONG_NOW")
    if override:
        return datetime.strptime(override, "%Y-%m-%dT%H:%M")
    dt = datetime.now(TZ) if TZ else datetime.now()
    return dt.replace(tzinfo=None)


def stamp(dt=None):
    return (dt or now()).strftime("%Y-%m-%dT%H:%M")


def parse_stamp(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M")


# ---------- đọc / ghi file việc ----------
def task_path(tid):
    if not re.fullmatch(r"T-\d{3,}", tid):
        raise LedgerError(f"Mã việc không hợp lệ: {tid} (dạng đúng: T-001)")
    return BOARD / f"{tid}.md"


def read_task(tid):
    p = task_path(tid)
    if not p.exists():
        raise LedgerError(f"Không có việc {tid} trong board/")
    text = p.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        raise LedgerError(f"{p} thiếu phần đầu (frontmatter)")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] == '"':
                v = json.loads(v)
            meta[k.strip()] = v
    for k in ("rounds", "version"):
        meta[k] = int(meta.get(k) or 0)
    meta["cost"] = float(meta.get("cost") or 0)
    return meta, m.group(2)


def write_task(meta, body):
    lines = ["---"]
    for k in FIELDS:
        v = meta.get(k, "")
        if isinstance(v, str) and (v == "" or re.search(r"[:#\"']", v) or v != v.strip()):
            v = json.dumps(v, ensure_ascii=False)
        lines.append(f"{k}: {v}")
    lines.append("---")
    BOARD.mkdir(parents=True, exist_ok=True)
    task_path(meta["id"]).write_text("\n".join(lines) + "\n" + body, encoding="utf-8")


def all_tasks():
    out = []
    if BOARD.exists():
        for p in sorted(BOARD.glob("T-*.md")):
            try:
                out.append(read_task(p.stem)[0])
            except LedgerError:
                pass
    return out


def next_id():
    nums = [int(t["id"][2:]) for t in all_tasks()]
    return f"T-{(max(nums) + 1 if nums else 1):03d}"


# ---------- nhật ký ----------
def next_event_id():
    if not LEDGER.exists():
        return "E-0001"
    n = sum(1 for line in LEDGER.open(encoding="utf-8") if line.strip())
    return f"E-{n + 1:04d}"


def log_event(meta, event, frm, to, detail="", severity="", cost=0.0, link=""):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "id": next_event_id(), "t": stamp(), "task": meta["id"], "title": meta["title"],
        "event": event, "from": frm, "to": to, "round": meta.get("rounds", 0),
        "severity": severity, "detail": detail, "link": link, "cost": round(cost, 2),
    }
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return row


def append_history(body, row):
    line = f"- {row['t']} · {EVENT_VI.get(row['event'], row['event'])} · {row['from']} → {row['to']}"
    if row["severity"]:
        line += f" · {row['severity']}"
    if row["detail"]:
        line += f" · {row['detail']}"
    if row["link"]:
        line += f" · [{row['link']}](../{row['link']})"
    if "## Lịch sử" not in body:
        body = body.rstrip() + "\n\n## Lịch sử\n"
    return body.rstrip("\n") + "\n" + line + "\n"


def transition(tid, allowed_from, new_state, event, by, to, *, holder=None, detail="",
               severity="", cost=0.0, link="", mutate=None):
    meta, body = read_task(tid)
    if meta["state"] not in allowed_from:
        ok = ", ".join(STATE_VI[s] for s in allowed_from)
        raise LedgerError(
            f"{tid} đang ở '{STATE_VI.get(meta['state'], meta['state'])}'. "
            f"Lệnh này chỉ dùng được khi việc ở: {ok}.")
    if mutate:
        mutate(meta)
    meta["state"] = new_state
    if holder:
        meta["holder"] = holder
    meta["updated"] = stamp()
    meta["cost"] = round(meta["cost"] + cost, 2)
    row = log_event(meta, event, by, to, detail, severity, cost, link)
    write_task(meta, append_history(body, row))
    return meta, row


# ---------- lệnh ----------
def cmd_new(a):
    tid = next_id()
    ts = stamp()
    meta = {
        "id": tid, "title": a.title, "state": "new", "holder": a.to, "owner": a.to,
        "reviewer": a.reviewer, "rounds": 0, "version": 0, "deadline": a.deadline or "",
        "escalation": a.escalation, "created": ts, "updated": ts, "prev_state": "", "cost": round(a.cost, 2),
    }
    if not a.criteria:
        raise LedgerError("Việc mới phải có ít nhất một --criteria (tiêu chí chấp nhận).")
    crit = "\n".join(f"{i}. {c}" for i, c in enumerate(a.criteria, 1))
    body = (f"\n# {tid} · {a.title}\n\n## Brief\n\n"
            f"**Mục tiêu:** {a.goal or a.title}\n\n"
            f"**Bối cảnh:** {a.context or '—'}\n\n"
            f"### Tiêu chí chấp nhận\n\n{crit}\n\n"
            f"### Không làm\n\n{a.out_of_scope or '—'}\n\n## Lịch sử\n")
    row = log_event(meta, "assigned", a.by, a.to, a.goal or "", cost=a.cost)
    write_task(meta, append_history(body, row))
    print(f"Đã tạo {tid} → {a.to}. File: board/{tid}.md")


def cmd_start(a):
    meta, _ = transition(a.task, ["new", "rework"], "doing", "started", a.by, a.by,
                         holder=a.by, detail=a.note or "", cost=a.cost)
    print(f"{a.task}: Đang làm ({a.by})")


def cmd_handoff(a):
    current, _ = read_task(a.task)
    rev = current["reviewer"]

    def bump(m):
        m["version"] += 1
    meta, _ = transition(a.task, ["doing", "rework"], "review", "handoff", a.by, rev,
                         holder=rev, detail=a.note or "", cost=a.cost, link=a.link or "",
                         mutate=bump)
    print(f"{a.task}: Chờ review (bản v{meta['version']}) → {rev}")


def cmd_reject(a):
    if not a.against:
        raise LedgerError("Trả về phải có --against: tiêu chí chấp nhận nào bị vi phạm.")
    meta, body = read_task(a.task)
    if meta["state"] != "review":
        raise LedgerError(f"{a.task} không ở trạng thái Chờ review, không trả về được.")
    detail = f"[{a.against}] {a.note or ''}".strip()
    if a.severity == "minor":
        # lỗi nhỏ: ghi nhận, việc vẫn được chấp nhận, bộ phận sửa song song
        row = log_event(meta, "rejected", a.by, meta["owner"], detail, "minor", 0, a.link or "")
        body = append_history(body, row)
        write_task(meta, body)
        transition(a.task, ["review"], "done", "accepted", a.by, "done", holder="-",
                   detail="Chấp nhận kèm lỗi minor", cost=a.cost)
        print(f"{a.task}: Xong (kèm lỗi minor đã ghi nhận)")
        return
    rounds = meta["rounds"] + 1
    if rounds > MAX_ROUNDS:
        def up(m):
            m["rounds"] = rounds
            m["prev_state"] = "rework"
        transition(a.task, ["review"], "escalated", "rejected", a.by, meta["owner"],
                   holder="chief-of-staff", detail=detail, severity="blocker", cost=a.cost,
                   link=a.link or "", mutate=up)
        m2, b2 = read_task(a.task)
        row = log_event(m2, "escalated", "chief-of-staff", "chief-of-staff",
                        f"Vòng trả về thứ {rounds}: Chief of Staff tìm gốc vấn đề")
        write_task(m2, append_history(b2, row))
        print(f"{a.task}: Vòng {rounds} → Leo thang. Chief of Staff phải xử lý.")
        return

    def up(m):
        m["rounds"] = rounds
    transition(a.task, ["review"], "rework", "rejected", a.by, meta["owner"],
               holder=meta["owner"], detail=detail, severity="blocker", cost=a.cost,
               link=a.link or "", mutate=up)
    print(f"{a.task}: Trả về {meta['owner']} (vòng {rounds}/{MAX_ROUNDS})")


def cmd_accept(a):
    transition(a.task, ["review"], "done", "accepted", a.by, "done", holder="-",
               detail=a.note or "", cost=a.cost)
    print(f"{a.task}: Xong")


def cmd_block(a):
    if not a.note:
        raise LedgerError("Báo bị chặn phải có --note: cần ai làm gì.")
    meta, _ = read_task(a.task)

    def keep(m):
        m["prev_state"] = m["state"]
    transition(a.task, ["new", "doing", "rework"], "blocked", "blocked", a.by, "chief-of-staff",
               detail=a.note, cost=a.cost, mutate=keep)
    print(f"{a.task}: Bị chặn — {a.note}")


def cmd_unblock(a):
    meta, _ = read_task(a.task)
    back = meta.get("prev_state") or "doing"
    transition(a.task, ["blocked"], back, "unblocked", a.by, meta["holder"],
               detail=a.note or "", cost=a.cost, mutate=lambda m: m.update(prev_state=""))
    print(f"{a.task}: Gỡ chặn → {STATE_VI[back]}")


def cmd_escalate(a):
    if not a.note:
        raise LedgerError("Leo thang phải có --note: câu hỏi cần Capu quyết.")

    def keep(m):
        if m["state"] != "escalated":
            m["prev_state"] = m["state"]
    transition(a.task, [s for s in STATES if s != "done"], "escalated", "escalated", a.by, "capu",
               holder="capu", detail=a.note, cost=a.cost, link=a.link or "", mutate=keep)
    print(f"{a.task}: Chờ Capu quyết — viết Decision Request vào inbox/capu/")


def cmd_decide(a):
    if not a.note:
        raise LedgerError("Ghi quyết định phải có --note.")
    meta, _ = read_task(a.task)
    if a.close:
        transition(a.task, ["escalated"], "done", "decided", "capu", "done", holder="-",
                   detail=a.note, link=a.link or "")
        print(f"{a.task}: Capu quyết định đóng việc")
        return

    def reset(m):
        m["prev_state"] = ""
        m["rounds"] = 0   # brief đã được làm rõ: bắt đầu lại đếm vòng
    transition(a.task, ["escalated"], "doing", "decided", "capu", meta["owner"],
               holder=meta["owner"], detail=a.note, link=a.link or "", mutate=reset)
    print(f"{a.task}: Capu đã quyết → {meta['owner']} làm tiếp")


def build_summary():
    tasks = all_tasks()
    events = []
    if LEDGER.exists():
        events = [json.loads(l) for l in LEDGER.read_text(encoding="utf-8").splitlines() if l.strip()]
    t_now = now()
    counts = {s: 0 for s in STATES}
    for t in tasks:
        counts[t["state"]] = counts.get(t["state"], 0) + 1
    open_tasks = [t for t in tasks if t["state"] != "done"]

    def hours(t):
        return round((t_now - parse_stamp(t["updated"])).total_seconds() / 3600, 1)
    alerts = []
    for t in open_tasks:
        h = hours(t)
        if t["state"] == "escalated" and t["holder"] == "capu":
            alerts.append({"task": t["id"], "title": t["title"], "kind": "Chờ Capu quyết", "hours": h})
        elif t["state"] == "escalated":
            alerts.append({"task": t["id"], "title": t["title"], "kind": "Leo thang, Chief of Staff xử lý", "hours": h})
        elif t["state"] == "blocked":
            alerts.append({"task": t["id"], "title": t["title"], "kind": "Bị chặn", "hours": h})
        elif h > STALL_HOURS:
            alerts.append({"task": t["id"], "title": t["title"], "kind": f"Đứng yên quá {STALL_HOURS} giờ", "hours": h})
        elif t["state"] == "rework" and t["rounds"] >= MAX_ROUNDS:
            alerts.append({"task": t["id"], "title": t["title"], "kind": f"Rework vòng {t['rounds']}", "hours": h})
    done = [t for t in tasks if t["state"] == "done"]
    first_pass = [t for t in done if t["rounds"] == 0 and not any(
        e["task"] == t["id"] and e["event"] == "rejected" for e in events)]
    since = t_now - timedelta(hours=24)
    last24 = [e for e in events if parse_stamp(e["t"]) >= since]
    return {
        "as_of": stamp(t_now),
        "counts": counts,
        "open": [{"task": t["id"], "title": t["title"], "state": t["state"], "holder": t["holder"],
                  "rounds": t["rounds"], "hours_since_update": hours(t)} for t in open_tasks],
        "alerts": alerts,
        "first_pass_yield": round(len(first_pass) / len(done), 2) if done else None,
        "cost_total": round(sum(e.get("cost", 0) for e in events), 2),
        "last_24h": {
            "events": len(last24),
            "accepted": sum(1 for e in last24 if e["event"] == "accepted"),
            "rejected": sum(1 for e in last24 if e["event"] == "rejected"),
            "cost": round(sum(e.get("cost", 0) for e in last24), 2),
        },
    }


def cmd_summary(a):
    s = build_summary()
    if a.json:
        print(json.dumps(s, ensure_ascii=False, indent=2))
        return
    c = s["counts"]
    print(f"Tình hình lúc {s['as_of']}")
    print("  " + " · ".join(f"{STATE_VI[k]}: {v}" for k, v in c.items() if v))
    fpy = s["first_pass_yield"]
    print(f"  First-pass yield: {'—' if fpy is None else f'{fpy:.0%}'} · Chi phí tổng: ${s['cost_total']}")
    l24 = s["last_24h"]
    print(f"  24 giờ qua: {l24['events']} sự kiện, {l24['accepted']} chấp nhận, {l24['rejected']} trả về, ${l24['cost']}")
    if s["alerts"]:
        print("Cảnh báo:")
        for al in s["alerts"]:
            print(f"  - {al['task']} {al['title']}: {al['kind']} ({al['hours']} giờ)")
    else:
        print("Cảnh báo: không có")
    if s["open"]:
        print("Đang mở:")
        for t in s["open"]:
            r = f", vòng {t['rounds']}" if t["rounds"] else ""
            print(f"  - {t['task']} [{STATE_VI[t['state']]}] {t['title']} · giữ: {t['holder']}{r}")


def cmd_list(a):
    for t in all_tasks():
        if a.state and t["state"] != a.state:
            continue
        print(f"{t['id']}  {STATE_VI[t['state']]:<10} {t['holder']:<15} {t['title']}")


def main(argv=None):
    p = argparse.ArgumentParser(description="Sổ cái Tơ Hồng HQ")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp, by_default=None, need_task=True):
        if need_task:
            sp.add_argument("task")
        sp.add_argument("--by", default=by_default, required=by_default is None)
        sp.add_argument("--note", default="")
        sp.add_argument("--cost", type=float, default=0.0, help="Chi phí ước tính, USD")
        sp.add_argument("--link", default="")

    sp = sub.add_parser("new", help="Tạo việc mới (Chief of Staff)")
    common(sp, by_default="chief-of-staff", need_task=False)
    sp.add_argument("--title", required=True)
    sp.add_argument("--to", required=True, help="Bộ phận nhận việc, vd product")
    sp.add_argument("--goal", default="")
    sp.add_argument("--context", default="")
    sp.add_argument("--criteria", action="append", default=[])
    sp.add_argument("--out-of-scope", default="")
    sp.add_argument("--deadline", default="")
    sp.add_argument("--reviewer", default="reviewer")
    sp.add_argument("--escalation", default="tu-lam", choices=["tu-lam", "bao-sau", "hoi-truoc"])
    sp.set_defaults(fn=cmd_new)

    for name, fn, hlp in [("start", cmd_start, "Bắt đầu làm"), ("handoff", cmd_handoff, "Bàn giao cho reviewer"),
                          ("accept", cmd_accept, "Reviewer chấp nhận"), ("block", cmd_block, "Báo bị chặn"),
                          ("unblock", cmd_unblock, "Gỡ chặn"), ("escalate", cmd_escalate, "Leo thang lên Capu")]:
        sp = sub.add_parser(name, help=hlp)
        common(sp)
        sp.set_defaults(fn=fn)

    sp = sub.add_parser("reject", help="Reviewer trả về")
    common(sp)
    sp.add_argument("--against", required=True, help="Tiêu chí chấp nhận bị vi phạm")
    sp.add_argument("--severity", choices=["blocker", "minor"], default="blocker")
    sp.set_defaults(fn=cmd_reject)

    sp = sub.add_parser("decide", help="Ghi quyết định của Capu cho việc đang leo thang")
    common(sp, by_default="capu")
    sp.add_argument("--close", action="store_true", help="Đóng việc thay vì làm tiếp")
    sp.set_defaults(fn=cmd_decide)

    sp = sub.add_parser("summary", help="Tình hình công ty")
    sp.add_argument("--json", action="store_true")
    sp.set_defaults(fn=cmd_summary)

    sp = sub.add_parser("list", help="Liệt kê việc")
    sp.add_argument("--state", choices=STATES)
    sp.set_defaults(fn=cmd_list)

    a = p.parse_args(argv)
    try:
        a.fn(a)
    except LedgerError as e:
        print(f"Lỗi: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
