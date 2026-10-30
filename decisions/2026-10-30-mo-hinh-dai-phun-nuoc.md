---
type: decision
id: ADR-009
date: 2026-10-30
decided_by: capu
tasks: []
---
# Chuyển mô hình vận hành sang "đài phun nước": spec + eval, lưới lọc ba bậc, Insight

**Quyết định:** Capu đồng ý ("ok", phiên 2026-10-30) refactor mô hình phát triển của Tơ Hồng HQ theo mô hình đài phun nước: Insight (máy bơm) → Spec + eval (thân cột) → Ràng buộc (vòi) → sinh song song (tia) → lưới lọc (eval, ba bậc) → bể (production + tri thức) → ống hồi.

**Vì sao:** mô hình cũ là Scrum chạy bằng agent. Ba chỗ gãy đã thấy trong sổ cái:
1. T-001 bị trả về ba vòng rồi leo thang vì "kiểm được nghĩa là gì?": lỗi nằm ở brief nhưng hệ thống bắt người làm rework.
2. Capu phải merge tay mọi PR, rồi liên tục ra quyết định ad hoc cho phép tự merge (ADR-001, ADR-004, ADR-008).
3. Chưa có nguồn insight nào ngoài trực giác của Capu; chưa phỏng vấn user, chưa đọc dữ liệu sản phẩm.

**Thay đổi:**
- `scripts/task.py`: trường `eval`, `tier`, `spec_returns`; trạng thái `spec`; lệnh `respec`. Việc giao `engineering` bắt buộc có eval. Trả về vòng 2 đưa việc về `spec` (Spec Writer sửa), về spec lần hai mà vẫn trả về thì leo thang.
- `CLAUDE.md`: mô hình đài phun nước; lưới lọc ba bậc A/B/C thay cho "merge là Hỏi trước"; luật rework mới; thay thế ADR-001/004/008 bằng luật chung.
- Charter: `product` → Spec Writer (spec + eval, không PRD); `reviewer` → Eval Engineer (hai tầng: eval tự động, review ý định); `engineering` chỉ nhận việc có eval, được chạy nhiều nhánh song song, không merge.
- Tuyển `insight`: báo cáo insight tuần từ dữ liệu sản phẩm, ống hồi (sự cố → eval hồi quy).
- Nhịp: bỏ standup sáng và wrap-up chiều; thêm Insight tuần (thứ Bảy 9:00) và phiên spec thứ Bảy. Chỉ số thay velocity: spec acceptance rate, số lần về spec, eval pass rate, giờ giao→chấp nhận, số quyết định của Capu, chi phí mỗi việc.
- Mẫu mới `templates/spec.md`; thư mục `eval/`, `insights/`.

**Việc Capu cần làm sau khi merge:**
1. Xóa hai scheduled task "Standup sáng" và "Wrap-up chiều" trên claude.ai/code; tạo task "Insight tuần" theo `routines/weekly-insight.md`.
2. Cấp cho `insight` quyền đọc dữ liệu sản phẩm (tohong-back) — việc đầu tiên giao cho Insight là nối nguồn và báo cáo "hiện đo được gì".
3. Việc Engineering đầu tiên theo khuôn mới: xem lệnh mẫu trong `templates/brief.md`.

**Giữ nguyên:** ranh giới cứng của `CLAUDE.md`; không đặt secret thay Capu; không migration trên dữ liệu thật; người làm không tự chấm điểm.

**Theo dõi:** sau 4 tuần, báo cáo chất lượng so sánh first-pass yield và số quyết định của Capu trước/sau. Nếu số lần về spec không giảm sau 8 tuần thì vấn đề ở khuôn spec, sửa `templates/spec.md` trước khi sửa charter.
