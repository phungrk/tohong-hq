# ADR-137: Tag phong cách có bằng chứng là ngoại lệ của ADR-025; thay planner/vendor/pool inv-001

Ngày: 2026-11-20 · Người quyết: Capu (chọn giữ tag của PR tohong#108), Chief ghi · Việc: T-215

## Quyết định
- Ngoại lệ của ADR-025 ("tag tính từ văn bản nguồn"): vendor có bằng chứng tag hợp lệ thì regen giữ nguyên `style_tags` của nguồn. Bằng chứng hợp lệ nghĩa là dòng `enrichment_log` cuối cùng có `source: google_ai_mode` và `changes.style_tags`, mỗi phần tử là `{tag, evidence}`, tag thuộc 10 tag chuẩn, evidence không rỗng (luật đầy đủ ở spec T-215). Vendor không có bằng chứng thì giữ hành vi cũ.
- Regen không được làm bẩn file đang được git theo dõi trong tohong.
- `eval/invariants/planner/vendor/pool/inv-001` (mọi styles phải bằng tag tính từ văn bản) đo đúng điều đã bị ngoại lệ này thay.
  - Ở Code Gate của việc engineering T-215, inv-001 đỏ là có chủ đích. Mọi bất biến khác phải xanh.
  - Trước khi merge, Chief chạy lại gate với bể đã đổi: thay inv-001 bằng v2 (`eval/T-215/inv-proposed-pool-khop-van-ban-nguon-v2.py`). Gate phải GREEN mới merge.
  - Sau khi merge, Chief commit việc đổi bể (cách làm giống ADR-126).
