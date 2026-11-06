#!/usr/bin/env python3
"""T-082 adv-03 (tầng 3, spec B3 + C2/C3: mỗi /ok hợp lệ của Capu phải có kết cục thấy được: ghi + xác nhận, từ chối,
hoặc workflow đỏ sau 5 lần thử; không được biến mất im lặng).
Input phá: ba sự kiện issue_comment tới gần nhau (Capu `/ok` ở issue A khi một lượt khác đang chạy, rồi bất kỳ bình luận
nào nữa, kể cả của người lạ, vì `concurrency:` cấp workflow được tính TRƯỚC `if` của job). GitHub Actions chỉ giữ MỘT
lượt chờ cho mỗi nhóm concurrency: lượt chờ cũ bị huỷ (cancelled) khi lượt mới xếp hàng, kể cả với cancel-in-progress: false.
Nhóm hằng `ok-tren-issue` dùng chung cho mọi bình luận => lệnh /ok đang chờ bị huỷ, không ghi, không trả lời.
Mong đợi (kiểm tĩnh): workflow ok-tren-issue.yml không có nhóm concurrency dùng chung giữa các bình luận khác nhau:
hoặc không có concurrency (đua push đã được B3 xử lý bằng thử lại), hoặc nhóm có chứa github.event.comment.id.
Thêm: không có `${{ github.event.* }}` hay `${{ ... body ... }}` trong run:/script: (D2)."""
import re, sys, pathlib
def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _hook
ROOT = pathlib.Path(__file__).resolve().parents[2]
wf = (ROOT / ".github/workflows/ok-tren-issue.yml").read_text(encoding="utf-8")
fails = []
groups = re.findall(r"^\s*concurrency:\s*\n\s+group:\s*(.+)$", wf, re.M) + \
         re.findall(r"^[ \t]*concurrency:[ \t]*([^\s{].*)$", wf, re.M)
for g in groups:
    if "comment.id" not in g:
        fails.append(f"nhóm concurrency {g.strip()!r} dùng chung cho mọi bình luận: lượt /ok đang chờ bị huỷ khi lượt thứ ba xếp hàng")
# D2: nội dung không vào run:/script:
blocks = re.findall(r"^(\s*)(?:run|script):\s*\|?\s*\n((?:\1\s+.*\n?)*)", wf, re.M)
for _, body in blocks:
    for m in re.findall(r"\$\{\{[^}]*\}\}", body):
        if "github.event" in m or "body" in m or "title" in m or "inputs" in m:
            fails.append(f"biểu thức {m} nằm trong run:/script:")
assert not fails, "\n".join(fails)
print("PASS workflow /ok không có nhóm concurrency nuốt lệnh, không nội suy sự kiện vào run/script")
