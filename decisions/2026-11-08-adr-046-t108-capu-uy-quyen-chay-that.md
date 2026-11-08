---
type: decision
id: ADR-046
date: 2026-11-08
decided_by: capu
tasks: [T-108]
---
# Capu uỷ quyền Chief of Staff bấm chạy thật workflow enrich venue (T-108)

**Bối cảnh:** Capu chọn phương án A cho T-108 (chạy ngay). Bản chạy thử (dry run) phungrk/tohong run 42439266111 báo 99 venue đủ điều kiện, ước tính $3,47 cho 99 lượt Text Search, trần $5. Theo luật công ty, agent không tự chi tiền.

**Quyết định (Capu, 2026-11-08):** "em chạy thật đi". Chief of Staff chạy `enrich-venue.yml` với `dry_run=false`, `budget=5.0`, `refresh_max_requests=250`. Trần chi chỉ cho lần chạy này là $5 Text Search; ảnh tải về trong hạn mức miễn phí ≤ 1.000. Uỷ quyền chỉ áp dụng cho một lần chạy này, không mở rộng sang lần sau.

**Còn lại:** PR dữ liệu và PR pool ở tohong-back thuộc bậc C, Capu đọc `review-needed.csv` và tự merge.
