---
type: decision
id: ADR-050
date: 2026-11-08
decided_by: chief-of-staff
tasks: [T-110, T-112]
---
# INV-015 thêm điều khoản miễn cho mục duyệt tay của Capu

**Bối cảnh:** T-110 (spec) và T-112 (code, phungrk/tohong#73) cho Capu nhận khớp tay một vendor mà luật sáu cổng đã từ chối, ví dụ Thiskyhall (độ tin 0,455, địa chỉ không khớp, ADR-048). INV-015 hiện đòi mọi bản ghi `google_maps` phải qua `accept_match`, nên sẽ đỏ với các bản ghi này.
- Spec-critic đã bác cách ghi đè `confidence=1.0`, vì như vậy là lách bất biến (T-110 D1, B2).
- Spec-critic cũng tìm ra lỗ trong bản nháp điều khoản: `decision` có thể trỏ tới bất kỳ file nào trong HQ có dòng `decided_by: capu`.

**Quyết định:**
1. INV-015 thêm đúng một điều khoản: vế `accept_match` được miễn cho bản ghi `enrichment_log` có `manual_override: true` và dòng audit có `manual_override: "accept_place"`. Miễn chỉ khi đủ cả hai điều kiện:
   - `manual_overrides.json` có mục `accept_place` cùng `vendor_id`, và `resolved.place_id` trùng `place_id` của bản ghi;
   - `decision` của mục đó là một file **nằm trong `<HQ>/decisions/` sau realpath**, có `decided_by: capu` **ở frontmatter**, và có nhắc `vendor_id`.
2. Bản ghi `manual_override` không có mục tương ứng thì bị coi là bản ghi giả và báo đỏ. Các vế khác của INV-015 vẫn áp: `address_source` theo snapshot, có `formatted_address`, cờ `address_match` khớp giá trị tính lại.
3. Đây là thêm một ngoại lệ có điều kiện. Không nới vế nào cho bản ghi tự động.
4. Đã chạy INV-015 mới trên dữ liệu main và trên bản tổng duyệt T-112 của adversary: đều PASS.
5. INV-020 và INV-021 (T-110) vẫn chờ ở `eval/T-110/bat-bien-cho-merge/` cho tới khi PR dữ liệu và PR pool của lần chạy thật merge (ADR-028). Nếu đưa vào sớm, INV-021 sẽ đỏ trong khoảng giữa lúc merge #73 và lúc merge dữ liệu.
