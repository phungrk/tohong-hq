#!/usr/bin/env python3
"""T-087 tiêu chí 1 (hỏng NHẸ): nháy hỏng ở id/title/state/area/issue/budget không làm list/summary/export/gate sập; giá trị đọc ra là
phần còn lại sau khi bỏ mọi " và khoảng trắng hai đầu; stderr có cảnh báo nêu file + trường; issue 12 sau khi chuẩn hoá có link.
Chạy: python3 eval/T-087/check_1_khong_sap.py"""
import json, tempfile
from pathlib import Path
import _lib as L
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": dict(L.CORRUPT, escalation="tu-lam", eval="[]"), "T-902": {"title": '"" khoảng trắng ""'}, "T-903": {}})
    out = Path(tmp) / "pub"; T = L.ROOT / "scripts/task.py"
    runs = {"list": L.run(fake, T, "list"), "summary": L.run(fake, T, "summary"), "summary --json": L.run(fake, T, "summary", "--json"),
            "export": L.run(fake, L.ROOT / "scripts/export_dashboard.py", "--out", out), "gate": L.run(fake, L.ROOT / "scripts/gate.py", "T-901")}
    for n, r in runs.items():
        L.chk("Traceback" not in r.stderr, f"{n}: sập có Traceback")
        if n != "gate": L.chk(r.returncode == 0, f"{n}: thoát {r.returncode}, phải 0")
    L.chk(runs["gate"].returncode == 2 and "Lỗi" in runs["gate"].stderr, "gate T-901: thoát 2 (thiếu eval) kèm 'Lỗi', thấy %s" % runs["gate"].returncode)
    L.chk("T-901" in runs["list"].stdout and "Xin \"chao\" ban" in runs["list"].stdout and "Chờ review" in runs["list"].stdout, "list: T-901 phải hiện title/trạng thái đã chuẩn hoá")
    m, err, ex = L.read(fake, "T-901")
    L.chk(m is not None, "read_task lỗi: " + err[-200:])
    if m:
        for k, (raw, exp) in L.LIGHT.items():
            L.chk(str(m.get(k)) == exp, f"{k}: {raw!r} phải đọc ra {exp!r}, thấy {m.get(k)!r}")
            L.chk(any("board/T-901.md" in l and f"trường {k}:" in l for l in err.splitlines()), f"stderr thiếu cảnh báo 'board/T-901.md' + 'trường {k}:'")
    m2, _, _ = L.read(fake, "T-902")
    L.chk(m2 and m2["title"] == "khoảng trắng", "title `\"\" khoảng trắng \"\"` phải đọc ra 'khoảng trắng', thấy %r" % (m2 and m2["title"]))
    L.chk("trường" not in L.read(fake, "T-903")[1], "việc lành T-903 bị cảnh báo")
    tj = out / "tasks.json"
    if tj.exists():
        ts = {t["id"]: t for t in json.loads(tj.read_text(encoding="utf-8"))}
        L.chk(ts.get("T-901", {}).get("title") == 'Xin "chao" ban' and ts.get("T-901", {}).get("state") == "review", "tasks.json: T-901 phải có title/state đã chuẩn hoá")
        L.chk({"T-902", "T-903"} <= set(ts), "tasks.json thiếu việc khác")
        L.chk(any("12" in l for l in (ts.get("T-901", {}).get("links") or []) if isinstance(l, str)) or "12" in json.dumps(ts.get("T-901", {})), "T-901 sau chuẩn hoá issue 12 phải có link issue 12")
    else: L.chk(False, "export không ra tasks.json")
    for n in ("export", "gate"):
        L.chk("board/T-901.md" in runs[n].stderr, f"{n}: stderr phải có cảnh báo nêu board/T-901.md")
L.done()
