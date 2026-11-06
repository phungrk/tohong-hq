"""T-088 adv-03 (tầng 3). Board hỏng ở dạng spec T-087 chưa liệt kê ví dụ: `state: ""`, `state: ["review"]`
(danh sách), `tier: ["A"]`, thiếu hẳn dòng `id:`, file không có frontmatter, tên file lạ `T-12.md`.
Mong đợi (spec Bước 2 + Ý định: không làm sập): list/summary/summary --json/export thoát 0, không Traceback,
không có các việc đó trong list; gate.py trên từng việc thoát != 0 kèm `Lỗi:`, không Traceback."""
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "T-087"))
import _lib as L

T, G, X = (L.ROOT / "scripts" / n for n in ("task.py", "gate.py", "export_dashboard.py"))
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-951": {"state": '""'}, "T-952": {"state": '["review"]'}, "T-953": {"tier": '["A"]'},
                      "T-954": {}, "T-960": {"title": "lanh"}})
    b = (fake / "board" / "T-954.md").read_text(encoding="utf-8")
    (fake / "board" / "T-954.md").write_text(b.replace("id: T-954\n", "", 1), encoding="utf-8")
    (fake / "board" / "T-955.md").write_text("# không có frontmatter\n", encoding="utf-8")
    (fake / "board" / "T-12.md").write_text(b.replace("id: T-954", "id: T-12"), encoding="utf-8")
    bad_ids = ["T-951", "T-952", "T-953", "T-954", "T-955"]
    for argv in (["list"], ["summary"], ["summary", "--json"]):
        r = L.run(fake, T, *argv)
        L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"{argv} rc={r.returncode} {r.stderr[-200:]}")
        if argv == ["list"]:
            L.chk("T-960" in r.stdout and not any(i in r.stdout for i in bad_ids), f"list sai: {r.stdout[-300:]}")
        if argv[-1] == "--json":
            try:
                j = json.loads(r.stdout)
                L.chk(all(i in [x["task"] for x in j.get("board_hong", [])] for i in bad_ids[:4]),
                      f"board_hong thiếu việc hỏng nặng: {j.get('board_hong')}")
            except ValueError:
                L.chk(False, "summary --json không phải JSON")
    r = L.run(fake, X, "--out", Path(tmp) / "out")
    L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"export rc={r.returncode} {r.stderr[-200:]}")
    if r.returncode == 0:
        ids = [t["id"] for t in json.loads((Path(tmp) / "out" / "tasks.json").read_text())["tasks"]] \
            if isinstance(json.loads((Path(tmp) / "out" / "tasks.json").read_text()), dict) else \
            [t["id"] for t in json.loads((Path(tmp) / "out" / "tasks.json").read_text())]
        L.chk("T-960" in ids and not any(i in ids for i in bad_ids), f"tasks.json sai: {ids}")
    for tid in bad_ids:
        r = L.run(fake, G, tid, "--cwd", fake)
        L.chk(r.returncode != 0 and "Lỗi:" in r.stderr and "Traceback" not in r.stderr,
              f"gate {tid} rc={r.returncode} {r.stderr[-200:]}")
L.done()
