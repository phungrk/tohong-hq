---
type: decision
id: ADR-031
date: 2026-11-07
decided_by: chief-of-staff (theo ý định Capu, T-089)
tasks: [T-089]
---
# Cột Xong của Kanban được giới hạn thẻ; sửa lời INV-001 hq/dashboard ("Tất cả luôn đủ")

**Bối cảnh:** Capu (2026-11-07): "Kanban · hq hiện tại quá dài. Mong muốn chỉ hiển thị 10 task done gần nhất. Khi cần thì load thêm". INV-001 hq/dashboard (từ T-041 INV-P1) viết "mọi việc ở bảy cột của dashboard.json có thẻ trên bảng" — sai khi cột Xong có hơn 10 việc (sổ cái hôm nay 86). Eval của INV-001 vẫn xanh vì fixture chỉ có 2 việc xong.

**Quyết định:**
1. Ý định mới của Capu thắng câu cũ của T-041 cho riêng cột Xong. Lời INV-001 đổi thành: "với bộ chọn `all` (và giá trị lạ), sáu cột đầu có thẻ cho mọi việc; cột Xong có min(tổng, giới hạn hiện tại) thẻ của các việc xong mới nhất theo `updated`, số đếm cột là tổng; mọi việc (kể cả việc xong đang ẩn) mở được Dòng thời gian qua Feed hoặc Cảnh báo."
2. Phép kiểm của INV-001 hiện có giữ nguyên (fixture 2 việc xong vẫn đúng). Ca kiểm mới "hơn 10 việc xong" chỉ xanh sau khi T-089 merge, nên gác ở `eval/T-089/bat-bien-cho-merge/` theo ADR-028 và đưa vào bể sau merge.

**Hệ quả:** không bất biến nào bị nới ngoài cột Xong. Sáu cột còn lại vẫn đủ thẻ.
