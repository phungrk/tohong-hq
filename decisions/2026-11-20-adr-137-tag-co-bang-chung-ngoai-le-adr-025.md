# ADR-137: Tag phong cách có bằng chứng là ngoại lệ của ADR-025; thay planner/vendor/pool inv-001

Ngày: 2026-11-20 · Người quyết: Capu (chọn giữ tag của PR tohong#108), Chief ghi · Việc: T-215

## Quyết định
- Ngoại lệ của ADR-025 ("tag tính từ văn bản nguồn"): vendor có bằng chứng tag hợp lệ thì regen giữ nguyên `style_tags` của nguồn. Bằng chứng hợp lệ nghĩa là dòng `enrichment_log` cuối cùng có `source: google_ai_mode` và `changes.style_tags`, mỗi phần tử là `{tag, evidence}`, tag thuộc 10 tag chuẩn, evidence không rỗng (luật đầy đủ ở spec T-215). Vendor không có bằng chứng thì giữ hành vi cũ.
- Regen không được làm bẩn file đang được git theo dõi trong tohong.
- `eval/invariants/planner/vendor/pool/inv-001` (mọi styles phải bằng tag tính từ văn bản) đo đúng điều đã bị ngoại lệ này thay.
  - Ở Code Gate của việc engineering T-215, inv-001 đỏ là có chủ đích. Mọi bất biến khác phải xanh.
  - Trước khi merge, Chief chạy lại gate với bể đã đổi: thay inv-001 bằng v2 (`eval/T-215/inv-proposed-pool-khop-van-ban-nguon-v2.py`). Gate phải GREEN mới merge.
  - Sau khi merge, Chief commit việc đổi bể (cách làm giống ADR-126).

## Bổ sung (2026-11-20, sau khi Spec Gate trả T-215 lần 1)
- Gate chỉ chạy bất biến của vùng và các vùng cha, không chạy vùng con. T-215 thuộc vùng `planner/vendor`, nên `pool/*` không chạy ở cổng. Giữ nguyên vùng `planner/vendor`.
- `pool/inv-001` v1 hiện đã đỏ trên main (52 vendor) vì #108 đổi văn bản nguồn. v2 chỉ xanh được sau khi PR Sync ở back merge, vì nó đo pool đã commit trong back. Vì vậy thứ tự là:
  1. merge PR tohong của T-215;
  2. chạy Sync bằng SHA merge đó, merge PR Sync;
  3. Chief thay inv-001 bằng v2 và kiểm v2 xanh trên main mới.
- Hai bất biến `planner/admin/vendor-enrich` inv-006 và inv-014 cũng đỏ trên main kể từ #108 (eadf6d7), trên 0605898 thì vẫn PASS. Đây là sự cố bể, tách thành việc riêng, không thuộc T-215.
- Chief phân xử các điểm trong D1:
  - check_5 đổi thành phép đo tương đối: không thêm lệch mới so với commit nền.
  - Câu "Sync xanh" hiểu là Sync chạy bằng SHA merge của T-215.
  - Gate không đặt `T215_REF`.
  - Loại thư mục back (`edge`) khỏi phép kiểm "không làm bẩn cây".
  - Diff hành vi phải nêu: 29/77 vendor mang tag không có bằng chứng riêng.
