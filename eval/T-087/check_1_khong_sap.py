#!/usr/bin/env python3
"""T-087 tiêu chí 1: nháy hỏng không làm task.py list/summary, export_dashboard.py, gate.py sập; trường hỏng đọc như chuỗi thô
(giữ nguyên cả nháy) và có cảnh báo stderr nêu tên file + trường. Chạy: python3 eval/T-087/check_1_khong_sap.py"""
import json, tempfile
from pathlib import Path
import _lib as L
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": L.CORRUPT, "T-902": {}})
    out = Path(tmp) / "pub"
    runs = {"list": L.run(fake, L.ROOT / "scripts/task.py", "list"), "summary": L.run(fake, L.ROOT / "scripts/task.py", "summary"),
            "summary --json": L.run(fake, L.ROOT / "scripts/task.py", "summary", "--json"),
            "export": L.run(fake, L.ROOT / "scripts/export_dashboard.py", "--out", out),
            "gate": L.run(fake, L.ROOT / "scripts/gate.py", "T-901")}
    for n, r in runs.items():
        L.chk("Traceback" not in r.stderr, f"{n}: sập có Traceback")
        if n != "gate": L.chk(r.returncode == 0, f"{n}: thoát {r.returncode}, phải 0")
    L.chk(runs["gate"].returncode in (0, 1, 2), "gate: mã thoát lạ")
    L.chk(L.CORRUPT["title"] in runs["list"].stdout, "list: title hỏng phải hiện nguyên chuỗi thô, nháy giữ nguyên")
    m, err = L.read(fake, "T-901")
    L.chk(m is not None, "read_task ném lỗi: " + err[-200:])
    if m:
        for k, raw in L.CORRUPT.items():
            L.chk(m.get(k) == raw, f"{k}: phải là chuỗi thô {raw!r}, thấy {m.get(k)!r}")
        L.chk(m["issue"] == '""12""', "issue hỏng không được thành số 12")
        for k in L.CORRUPT:
            L.chk(any("board/T-901.md" in l and f"trường {k}:" in l for l in err.splitlines()),
                  f"stderr thiếu dòng cảnh báo có 'board/T-901.md' và 'trường {k}:'")
        L.chk("T-902" not in err, "việc lành T-902 bị cảnh báo")
    tj = out / "tasks.json"
    if tj.exists():
        ts = {t["id"]: t for t in json.loads(tj.read_text(encoding="utf-8"))}
        L.chk(ts.get("T-901", {}).get("title") == L.CORRUPT["title"], "tasks.json: title của T-901 phải là chuỗi thô")
        L.chk("T-902" in ts, "tasks.json thiếu việc lành T-902")
    else: L.chk(False, "export không ra tasks.json")
    L.chk("Cảnh báo" in runs["export"].stderr and "board/T-901.md" in runs["export"].stderr, "export: stderr phải có cảnh báo nêu board/T-901.md")
    L.chk("Cảnh báo" in runs["gate"].stderr and "board/T-901.md" in runs["gate"].stderr, "gate: stderr phải có cảnh báo nêu board/T-901.md")
L.done()
