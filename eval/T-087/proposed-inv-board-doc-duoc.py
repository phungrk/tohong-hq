#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT hq/ledger (T-087; chỉ spec-critic được rút vào eval/invariants/hq/ledger/).
Mọi board/T-*.md thật đọc được bằng read_task mà không ném lỗi, và mọi giá trị đọc ra là str/int/float/list (không None).
Thêm: board hỏng nháy (tạm) không làm read_task ném lỗi. Chạy: python3 eval/T-087/proposed-inv-board-doc-duoc.py"""
import subprocess, sys, tempfile
import _lib as L
code = ("import sys; sys.path.insert(0,%r); import task\n"
        "bad=[]\nfor p in sorted(task.BOARD.glob('T-*.md')):\n"
        "    try: task.read_task(p.stem)\n    except Exception as e: bad.append(p.stem+': '+type(e).__name__)\n"
        "print('\\n'.join(bad)); sys.exit(1 if bad else 0)" % str(L.ROOT / "scripts"))
r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=str(L.ROOT))
L.chk(r.returncode == 0, "board thật không đọc được: " + r.stdout.strip()[:200])
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": L.CORRUPT})
    m, err = L.read(fake, "T-901")
    L.chk(m is not None, "board hỏng nháy làm read_task ném lỗi")
L.done()
