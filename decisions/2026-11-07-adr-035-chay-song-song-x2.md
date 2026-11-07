---
type: decision
id: ADR-035
date: 2026-11-07
decided_by: capu (ý định) / chief-of-staff (cách làm)
tasks: []
---
# Nhân sự x2: mỗi vai chạy tối đa 2 bản song song

**Bối cảnh:** Capu (2026-11-07): "anh muốn tăng nhân sự lên gấp đôi". Hỏi lại ba cách (chạy song song x2; tuyển thêm vai; cả hai), Capu không chọn → Chief of Staff chọn cách được khuyến nghị: chạy song song x2. Hiện có 5 vai agent (insight, product, spec-critic, engineering, adversary); 3 vai trong roster chưa tuyển (vendor-ops, growth, finance) giữ nguyên trạng thái.

**Quyết định:**
1. Chief of Staff được chạy tới 2 bản của cùng một vai cùng lúc, trên 2 việc khác nhau.
2. Hai việc chạy song song không được sửa cùng một file. Việc sửa repo code (tohong-back, tohong-front, tohong-hq-dashboard) làm trong `git worktree` riêng ở scratchpad, không checkout chung thư mục `/home/user/<repo>`; eval/gate trỏ tới worktree qua biến `TOHONG_*_REPO`.
3. Hai việc cùng sửa `scripts/` của sổ cái, hoặc cùng sửa một file `index.html`, thì chạy lần lượt, không song song.
4. Eval front/dashboard chạy chồng có thể đỏ giả (T-077: cache vite chung). Gặp đỏ chỉ khi chạy chồng thì chạy lại riêng trước khi phân loại; T-077 được ưu tiên làm.
5. Chi phí token tăng theo số bản chạy cùng lúc; hook `scripts/cost.py` vẫn ghi như cũ.

**Xét lại khi:** xung đột file/flake tăng, hoặc Capu muốn tuyển thêm vai mới.
