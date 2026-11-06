"""T-088 adv-02 (tầng 3). Spec T-087 Bước 1: "Mỗi (file, trường) có **một dòng stderr** mỗi tiến trình:
`Cảnh báo: board/T-xxx.md · trường <tên>: nháy kép hỏng, đã bỏ nháy ngoài`".
Input: một board có HAI trường hỏng nhẹ (title, issue). Mong đợi: stderr của `task.py list` có đúng một dòng
cho mỗi (file, trường), mỗi dòng đúng mẫu trên (không gộp hai trường vào một dòng), và stdout không chứa cảnh báo."""
import sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "T-087"))
import _lib as L

with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-941": {"title": '"Xin "chao" ban"', "issue": '""12""'}})
    r = L.run(fake, L.ROOT / "scripts" / "task.py", "list")
    L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"list rc={r.returncode}")
    lines = [l for l in r.stderr.splitlines() if "board/T-941.md" in l]
    for f in ("title", "issue"):
        want = f"Cảnh báo: board/T-941.md · trường {f}: nháy kép hỏng, đã bỏ nháy ngoài"
        n = sum(1 for l in lines if l.strip() == want)
        L.chk(n == 1, f"cần đúng 1 dòng {want!r}, có {n}; stderr: {lines!r}")
    L.chk("Cảnh báo" not in r.stdout, "stdout bị chen cảnh báo")
L.done()
