---
type: decision
id: ADR-059
date: 2026-11-11
decided_by: capu
tasks: []
---
# ChatGPT Manual Operating Model v1.0 (bổ sung ADR-058)

**Bối cảnh:** ChatGPT đề xuất "Manual Operating Model v1.0" (phương án C): Claude là Chief of Staff, ChatGPT là assigned specialist chỉ làm khi Capu mở phiên; không agent runtime, webhook, OpenAI API; không merge, không sửa sổ cái; KPI thử nghiệm. Chief of Staff đồng ý với 4 chỉnh sửa; Capu "OK" (2026-11-11).

**Quyết định (bổ sung ADR-058):**
1. Mô hình thủ công: ChatGPT chỉ làm khi Capu kích hoạt bằng câu lệnh trong `handbook/chatgpt.md`.
2. Giao việc bằng file `inbox/chatgpt/T-xxx-<loại>.md` theo `templates/chatgpt-assignment.md` (không dùng nhãn: board không có nhãn). Chỉ Chief of Staff ghi và đóng.
3. Review spec: ChatGPT commit `reviews/T-xxx-chatgpt.md` lên nhánh `agents/chatgpt/T-xxx-review` trong tohong-hq, không mở PR. Review PR: comment `[ChatGPT review]` trên PR.
4. ChatGPT không đẩy lên nhánh `claude/…` hay `review/…` (workflow đồng bộ ghi đè); sửa tài liệu HQ thì gửi diff, Chief of Staff áp.
5. Review chéo không làm chậm cổng: bậc B không bắt buộc, quá cửa sổ 48 giờ thì vẫn merge theo policy; bậc C Capu tự quyết khi merge.
6. Nếu connector không ghi được, ChatGPT trả kết quả trong phiên, Capu dán lại.
7. KPI thử nghiệm và đánh giá sau 2–4 tuần như trong handbook; Chief of Staff ghi kết quả từng phát hiện vào file giao việc khi đóng.
