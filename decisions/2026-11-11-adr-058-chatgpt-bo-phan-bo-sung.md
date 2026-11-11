---
type: decision
id: ADR-058
date: 2026-11-11
decided_by: capu
tasks: []
---
# ChatGPT là bộ phận bổ sung: reviewer chéo + engineering bậc A, làm việc qua GitHub connector

**Bối cảnh:** Capu có trả phí ChatGPT và muốn "có thêm ChatGPT cùng làm cho nhanh", không chuyển hẳn (2026-11-11). PR https://github.com/phungrk/tohong-hq/pull/34 viết theo hướng thay thế (browser-only, bỏ Claude Code); Chief of Staff review: mâu thuẫn `CLAUDE.md`, mất review độc lập, merge không ép được vì connector đăng nhập bằng tài khoản Capu, `gate.py` chưa chạy được trong Actions. Capu chọn cách làm việc (b): ChatGPT dùng GitHub connector, tự comment lên PR.

**Quyết định:**
1. ChatGPT là bộ phận bổ sung, không thay Chief of Staff hay subagent nào. Hai vai:
   - **Reviewer chéo** (mô hình khác Claude, nên độc lập thật): Spec Gate phụ cho spec bậc B/C, Code Gate phụ cho PR bậc B/C sau khi `adversary` chấp nhận, trước khi Capu đọc diff hành vi.
   - **Engineering bậc A** khi Chief of Staff giao: việc UI/copy nhỏ, độc lập, ở repo sản phẩm.
2. ChatGPT không sửa `board/`, `ledger/`, `eval/invariants/`, `decisions/`, `CLAUDE.md`. Sổ cái chỉ Chief of Staff ghi qua `scripts/task.py` (tránh trùng mã như ADR-042).
3. ChatGPT trả kết quả bằng comment trên PR, mở đầu `[ChatGPT review]`, theo mẫu ở `handbook/chatgpt.md`. Mỗi phát hiện trỏ tới eval, bất biến `INV-nnn` hoặc câu trong spec.
4. Phát hiện của ChatGPT là một khẳng định phải kiểm, không phải lệnh: Chief of Staff (hoặc `adversary` khi Chief of Staff giao) dựng lại; đúng thì thành `evalplus`/`reject` theo luật cổng hiện có, sai thì trả lời trên PR vì sao.
5. Nhánh ChatGPT dùng tiền tố `agents/chatgpt/…`; không chạm sổ cái nên không cần sửa `sync-ledger.yml`.
6. Luật merge bậc A/B/C không đổi. ChatGPT không merge, không bật auto-merge.

**Thử nghiệm đầu:** ChatGPT review chéo PR code của T-124 (trang admin bảng enrich) khi có. Sau 3 PR, Chief of Staff báo Capu: số phát hiện đúng / sai / trùng với adversary.

**PR #34:** đề xuất Capu đóng hoặc viết lại theo ADR này (bỏ "supersedes" và non-goal về Claude Code).
