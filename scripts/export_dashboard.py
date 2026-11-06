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
              "capu_queue": capu_queue}
    (out / "dashboard.json").write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    print(f"Đã xuất lúc {stamp}{' (bản công khai)' if public else ''}: {len(tasks)} việc, {len(events)} sự kiện, "
          f"{sum(r['status'] == 'Hired' for r in roster)}/{len(roster)} vị trí đã có người → {out}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Xuất dữ liệu cho dashboard")
    p.add_argument("--out", required=True, help="Thư mục ghi tasks.json, events.json, roster.json, dashboard.json")
    p.add_argument("--public", action="store_true", help="Bỏ nội dung chi tiết để đăng công khai")
    a = p.parse_args()
    export(Path(a.out), public=a.public)
