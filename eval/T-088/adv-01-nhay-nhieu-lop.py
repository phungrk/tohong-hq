"""T-088 adv-01 (tầng 3). Spec T-087 Bước 1: giá trị hỏng nhẹ = phần còn lại sau khi bỏ **mọi** dấu `"`
và khoảng trắng ở hai đầu. Input: nháy và khoảng trắng xen nhau nhiều lớp, vd `" " " abc " " "`
(không phải JSON chặt). Mong đợi: đọc ra `abc` (không còn nháy ở đầu/cuối), có cảnh báo; sau một lệnh đổi
trạng thái, giá trị ghi lại là `abc`. Chạy trên sổ cái tạm (TOHONG_ROOT)."""
import sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "T-087"))
import _lib as L

CASES = {  # thô -> đọc ra
    '" " " abc " " "': "abc",
    '"  "  "  "12"  "  "  "': "12",
    '" "" " Xin "chao" ban " "" "': 'Xin "chao" ban',
}
with tempfile.TemporaryDirectory() as tmp:
    boards = {}
    for i, raw in enumerate(CASES):
        boards[f"T-93{i}"] = {"title": raw}
    boards["T-939"] = {"issue": '"  "  "  "12"  "  "  "'}
    fake = L.mk(tmp, boards)
    for i, (raw, want) in enumerate(CASES.items()):
        tid = f"T-93{i}"
        m, err, cls = L.read(fake, tid)
        L.chk(cls == "", f"{tid} read_task lỗi {cls}: {err.strip()[:160]}")
        if m:
            L.chk(m["title"] == want, f"{tid} title thô {raw!r} đọc ra {m['title']!r}, mong {want!r}")
        L.chk(f"board/{tid}.md" in err and "trường title" in err, f"{tid} thiếu cảnh báo nêu file + trường")
    m, err, cls = L.read(fake, "T-939")
    L.chk(m is not None and m["issue"] == "12", f"T-939 issue đọc ra {(m or {}).get('issue')!r}, mong '12'")
    # ghi lại bằng lệnh đổi trạng thái: giá trị chuẩn hoá phải là abc
    t = L.ROOT / "scripts" / "task.py"
    r = L.run(fake, t, "cost", "T-930", "--by", "product", "--cost", "0.5", "--note", "adv-01")
    L.chk(r.returncode == 0, f"cost T-930 rc={r.returncode}: {r.stderr.strip()[:160]}")
    if r.returncode == 0:
        m, err, cls = L.read(fake, "T-930")
        L.chk(m is not None and m["title"] == "abc", f"sau lệnh ghi, title T-930 = {(m or {}).get('title')!r}, mong 'abc'")
        L.chk("T-930" not in err, f"sau lệnh ghi vẫn còn cảnh báo T-930: {err.strip()[:160]}")
L.done()
