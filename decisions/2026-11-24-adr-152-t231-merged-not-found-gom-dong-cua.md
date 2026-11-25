# ADR-152: T-231 merged; `ai_mode_result: not_found` gồm cả vendor đóng cửa vĩnh viễn

- Ngày: 2026-11-24
- Người quyết: Capu (merge cả hai PR; trả lời "có" cho câu đóng cửa vĩnh viễn; "chưa chạy" Sync vì đang enrich thêm)
- Việc: T-230 (spec), T-231 (code)

## Merge

Capu tự merge trong cửa sổ bậc B:
- https://github.com/phungrk/tohong/pull/122 → b9b7932
- https://github.com/phungrk/tohong-back/pull/80 → 7b1d621

Adversary accept (adv-01, adv-02 xanh), gate GREEN 32/32. Nhắc hẹn 48 giờ của Chief đã huỷ.

## Bể

Thăng `eval/T-230/bat-bien-cho-merge/inv-010-ai-mode-not-found-vang-pool-nguon-nguyen.py` vào `eval/invariants/planner/vendor/pool/`. Kiểm trên tohong origin/main (`env -i`, cwd /tmp): PASS (phần A bản sao, phần B 0 id mang cờ).

## Định nghĩa (Capu chốt)

"Vendor không tồn tại" gồm: AI Mode không tìm thấy doanh nghiệp, **và** doanh nghiệp đã đóng cửa vĩnh viễn / ngừng hoạt động. Cả hai ghi `ai_mode_result: "not_found"` ở mức vendor trong `vendors.json` qua PR dữ liệu enrich AI Mode. Code không đổi (máy chỉ đọc đúng chuỗi `"not_found"`). Tạm đóng cửa không thuộc định nghĩa này (giữ cơ chế temp_closed sẵn có).

Hệ quả: 11 vendor "đã đóng cửa/chuyển ngành/không còn hoạt động" trong PR #112 (flower) chưa mang cờ; muốn loại thì PR dữ liệu kế tiếp ghi cờ cho chúng.

## Sync

Chưa chạy Sync vendor pool (bước 6) theo lời Capu: đang enrich thêm vendor. Pool back vẫn trễ sau tohong#110, #112 (pool/inv-001 đỏ tới khi Sync).

## Phụ lục 2026-11-25: gắn cờ dữ liệu thật

Theo yêu cầu Capu ("vendor có note AI Mode ghi not found/không tìm thấy thì ghi cờ"), Chief mở PR dữ liệu https://github.com/phungrk/tohong/pull/124: 68 bản ghi (67 id) ceremony/flower mang `ai_mode_result: "not_found"` — 63 theo ghi chú không tìm thấy doanh nghiệp, 5 theo ghi chú đóng cửa vĩnh viễn/ngừng hoạt động rõ ràng (flower 33, 40, 68, 76, 93). Không gắn: vendor tồn tại nhưng lệch địa chỉ (flower 74, 92), có ứng viên có thể đúng (flower 43), và 8 bản ghi "nhiều khả năng ngừng hoạt động" chưa khẳng định (flower 17, 45, 49, 50, 60, 73, 94; ceremony 74) — chờ Capu. Đã sinh lại `enrich-report.json`; test liên quan ok. Chưa Sync.
