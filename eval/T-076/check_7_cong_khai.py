#!/usr/bin/env python3
"""T-076 tiêu chí 7: bản công khai chỉ thêm đúng `capu_queue` (mã việc, loại, hạn, nhãn, URL GitHub); không rò chi tiết sự kiện, nội dung file bàn giao/Decision Request, đường dẫn nội bộ; PR đã merged không để lại dấu vết.
Chạy: cd /home/user/tohong-hq && python3 eval/T-076/check_7_cong_khai.py
"""
import json, re, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _export_lib as X
GH = "https://github.com/phungrk/"
bad = []
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    tasks = {"T-921": dict(state="done", owner="engineering", tier="B", updated="2026-11-06T09:00", holder="-"), "T-922": dict(state="done", owner="engineering", tier="C", updated="2026-11-06T09:00", holder="-"),
             "T-923": dict(state="escalated", owner="product", tier="B", updated="2026-11-06T09:00", holder="chief-of-staff")}
    ev = [X.handoff_event(1, "T-921", GH + "tohong-front/pull/1"), X.handoff_event(2, "T-922", GH + "tohong-back/pull/2"), X.ev(3, "T-922", "merged", "merged: BI-MAT-MERGE", GH + "tohong-back/pull/2")]
    ev[0]["detail"] = "BI-MAT-CHI-TIET-921"; ev[1]["detail"] = "BI-MAT-CHI-TIET-922"
    fake = X.build(tmp, tasks, ev, {"T-923-bi-mat.md": "2026-11-10"}, {"T-921-v1.md": "NOI-DUNG-BAN-GIAO-BI-MAT " + GH + "tohong-front/pull/1\n"})
    import os, shutil
    if os.environ.get("T076_DUMP_DIR"):
        dd = Path(os.environ["T076_DUMP_DIR"]); shutil.copytree(fake, dd / "check_7_ledger")
        (dd / "check_7.json").write_text(json.dumps({"now": X.NOW, "ledger": "check_7_ledger", "expect": {"queue": ["T-921", "T-923"], "kinds": {"T-921": "diff-b", "T-923": "escalated"}}}), encoding="utf-8"); sys.exit(0)
    d, err = X.export(fake, tmp / "out", public=True)
    if d is None: print("FAIL exporter không chạy: " + str(err)); sys.exit(1)
    raw = (tmp / "out" / "dashboard.json").read_text(encoding="utf-8")
    for s in ("BI-MAT-CHI-TIET", "NOI-DUNG-BAN-GIAO-BI-MAT", "BI-MAT-MERGE", "handoffs/", "/home/", str(X.ROOT)):
        if s in raw: bad.append(f"bản công khai chứa chuỗi nội bộ {s!r}")
    if any(("detail" in e or "link" in e) for e in d["events"]): bad.append("sự kiện công khai còn detail/link")
    allowed = {"generated_at", "timezone", "public", "regression_evals", "tasks", "events", "roster", "capu_queue", "model"}
    if set(d) - allowed: bad.append("khoá cấp một lạ: " + ",".join(sorted(set(d) - allowed)))
    q = d.get("capu_queue")
    if not isinstance(q, list): bad.append("thiếu capu_queue")
    else:
        if sorted(e["task"] for e in q) != ["T-921", "T-923"]: bad.append("capu_queue phải là T-921 (PR chưa merged) và T-923 (leo thang); T-922 đã merged không được có: " + str([e["task"] for e in q]))
        for e in q:
            for l in e["links"]:
                if not re.fullmatch(r"https://github\.com/phungrk/[A-Za-z0-9._-]+/(pull/\d+|blob/main/inbox/capu/[^/]+|tree/main/inbox/capu)", l["url"]): bad.append("URL ngoài khuôn: " + l["url"])
        if "pull/2" in json.dumps(q): bad.append("PR đã merged còn dấu vết trong capu_queue")
    if len(d["tasks"]) != 3: bad.append("tasks phải đủ 3 việc")
if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
