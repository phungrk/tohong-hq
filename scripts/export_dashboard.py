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
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import task  # noqa: E402  (dùng chung cách đọc file việc và thời gian)

ROOT = task.ROOT


PRIVATE_EVENT_FIELDS = ("detail", "link")


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
            "tier": str(t.get("tier") or ""),
        })

    events = []
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

    if public:
        # Bản công khai: bỏ nội dung chi tiết (defect, ghi chú, đường dẫn file)
        for e in events:
            for k in PRIVATE_EVENT_FIELDS:
                e.pop(k, None)

    for name, rows in (("tasks", tasks), ("events", events), ("roster", roster)):
        (out / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    bundle = {"generated_at": stamp, "timezone": "Asia/Ho_Chi_Minh", "public": public,
              "regression_evals": regression_evals, "tasks": tasks, "events": events, "roster": roster}
    (out / "dashboard.json").write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    print(f"Đã xuất lúc {stamp}{' (bản công khai)' if public else ''}: {len(tasks)} việc, {len(events)} sự kiện, "
          f"{sum(r['status'] == 'Hired' for r in roster)}/{len(roster)} vị trí đã có người → {out}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Xuất dữ liệu cho dashboard")
    p.add_argument("--out", required=True, help="Thư mục ghi tasks.json, events.json, roster.json, dashboard.json")
    p.add_argument("--public", action="store_true", help="Bỏ nội dung chi tiết để đăng công khai")
    a = p.parse_args()
    export(Path(a.out), public=a.public)
