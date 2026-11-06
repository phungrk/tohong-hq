#!/usr/bin/env python3
"""T-087 tiêu chí 7: area lạ hoặc dạng danh sách KHÔNG phải hỏng (khớp hq/dashboard INV-005): việc vẫn có trong list và tasks.json (product ""),
không nằm trong board_hong, đọc không ném; riêng gate.py trên việc có area chuỗi lạ hoặc danh sách không rỗng thoát khác 0 kèm `Lỗi:`, không Traceback.
Chạy: python3 eval/T-087/check_7_area_la_khong_hong.py"""
import json, tempfile
from pathlib import Path
import _lib as L
T = L.ROOT / "scripts/task.py"
cases = {"T-921": '"hqx/dashboard"', "T-922": '["hq/dashboard"]', "T-923": "[]"}
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {t: {"area": a, "eval": '["echo ok"]'} for t, a in cases.items()} | {"T-924": {}}); out = Path(tmp) / "pub"
    ls, sm = L.run(fake, T, "list"), L.run(fake, T, "summary", "--json")
    ex = L.run(fake, L.ROOT / "scripts/export_dashboard.py", "--out", out)
    for n, r in (("list", ls), ("summary", sm), ("export", ex)): L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"{n}: sập/thoát {r.returncode}")
    bh = [b["task"] for b in (json.loads(sm.stdout or "{}").get("board_hong") or [])]
    ids = {t["id"]: t for t in json.loads((out / "tasks.json").read_text(encoding="utf-8"))} if (out / "tasks.json").exists() else {}
    for t in cases:
        L.chk(t in ls.stdout, f"list thiếu {t}"); L.chk(t in ids, f"tasks.json thiếu {t}")
        L.chk(t not in bh, f"{t} bị báo là board hỏng (area lạ không phải hỏng)")
    L.chk(ids.get("T-921", {}).get("product") == "", "T-921 product phải là '' ; thấy %r" % ids.get("T-921", {}).get("product"))
    for t in ("T-921", "T-922"):   # area chuỗi lạ / danh sách không rỗng; `[]` = không có vùng, gate chạy như thường
        g = L.run(fake, L.ROOT / "scripts/gate.py", t)
        L.chk(g.returncode != 0 and "Lỗi:" in g.stderr and "Traceback" not in g.stderr, f"gate {t}: phải thoát != 0 kèm 'Lỗi:' không Traceback; thoát {g.returncode}: {g.stderr[-150:]}")
L.done()
