#!/usr/bin/env python3
"""T-087 tiêu chí 3: task.py summary báo file board có trường hỏng; board lành thì không có mục đó.
Chạy: python3 eval/T-087/check_3_summary_bao_hong.py"""
import json, tempfile
def jl(r):
    try: return json.loads(r.stdout)
    except Exception: return {}
import _lib as L
T = L.ROOT / "scripts/task.py"
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": {"title": L.CORRUPT["title"], "issue": L.CORRUPT["issue"]}, "T-902": {}})
    r = L.run(fake, T, "summary")
    L.chk(r.returncode == 0, f"summary thoát {r.returncode}")
    L.chk("Board hỏng:" in r.stdout, "stdout thiếu dòng 'Board hỏng:'")
    line = [l for l in r.stdout.splitlines() if "T-901" in l and "board/T-901.md" in l and "title" in l and "issue" in l]
    L.chk(len(line) == 1 and line[0].lstrip().startswith("- "), "phải có đúng một dòng '- T-901 (board/T-901.md): title, issue'; thấy " + str(line))
    L.chk(not any("T-902" in l and "board/" in l for l in r.stdout.splitlines()), "việc lành T-902 bị báo hỏng")
    j = jl(L.run(fake, T, "summary", "--json"))
    L.chk(j.get("board_hong") == [{"task": "T-901", "file": "board/T-901.md", "fields": ["title", "issue"]}], "json board_hong sai: " + str(j.get("board_hong")))
    L.chk(sum(j.get("counts", {}).values()) == 2, "việc hỏng vẫn phải được đếm trong counts")
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-903": {}})
    j = jl(L.run(fake, T, "summary", "--json"))
    L.chk(j.get("board_hong") == [], "board lành: board_hong phải là []; thấy " + str(j.get("board_hong")))
    L.chk("Board hỏng" not in L.run(fake, T, "summary").stdout, "board lành: không in mục Board hỏng")
L.done()
