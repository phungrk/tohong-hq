---
type: decision
id: ADR-116
date: 2026-11-16
decided_by: capu
tasks: [T-188]
---
# Tạm mở toàn bộ trang admin không cần đăng nhập (Capu quyết, bậc C)

Capu (2026-11-16): "tạm thời trang admin https://tohong-front.vercel.app/?admin= không cần đăng nhập vẫn có thể truy cập. khi edit thì mặc nhiên là admin". Chief nêu rủi ro (trang admin có dữ liệu người dùng thật: Thành viên, Hàng chờ nâng cấp, Hộp kết nối, Nhật ký, Kế hoạch cũ) và đề xuất chỉ mở vendor/enrich kèm mã; Capu chọn "Toàn bộ admin, không mã".

Ràng buộc Chief đặt cho việc cài (T-188):
- Bậc C (auth + dữ liệu người dùng): Capu đọc diff hành vi và TỰ merge; Chief không merge.
- "Tạm thời": bật/tắt bằng một cờ cấu hình duy nhất (biến môi trường không bí mật, ví dụ ADMIN_OPEN=1 ở Worker và cờ build ở front), mặc định TẮT trong code; Capu tự bật ở Cloudflare/Vercel — Chief không đặt biến/secret thay Capu. Tắt cờ = quay về cổng requirePlatformAdmin y như cũ.
- Mọi lần sửa khi mở không đăng nhập ghi người sửa là một danh tính cố định (vd "admin-khong-dang-nhap") trong nhật ký/lịch sử overlay — không giả danh admin thật.
- Không mở rộng sang route ngoài /api/admin/*; không đổi quyền cặp đôi.

Bổ sung (2026-11-16): Capu "merge 188 luôn khi xong" — Capu ủy quyền rõ cho Chief merge PR của T-188 (bậc C) khi đã qua Spec Gate + Code Gate (adversary accept, gate GREEN, PR không xung đột). Cờ mở admin vẫn mặc định TẮT trong code; Chief không bật cờ, không đặt biến môi trường — Capu tự bật.
