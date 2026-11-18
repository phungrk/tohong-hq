# ADR-130: Capu duyệt chi Resolve overrides 140 request; giao việc sửa pipeline

Ngày: 2026-11-18 · Người quyết: Capu · Ghi bởi: Chief of Staff

## Quyết định
1. Capu: "duyệt chi Resolve overrides 140 request". Chief chạy `resolve-overrides.yml` trên phungrk/tohong với `dry_run=false` và `resolve_max_requests=140`. Các trần khác để mặc định: enrich_budget $1.0, refresh_max_requests 6.
   - Lần chạy thử trước đó (run 44328164871): 133 mục, tối đa 133 lượt Places, cộng 1 lượt enrich ước tính $0.04.
   - Chi phí ước tính $0.6–2.3, tự tin trung bình. Chi thật ghi theo dòng GOOGLE_USAGE của lần chạy.
2. Capu: "Sửa pipeline (có thể lấy thông tin vendor thông qua màn hình admin)". Tạo việc T-207: mục accept_place nhận đúng ứng viên Enrich (hoặc có thông tin admin đã thấy trên màn hình) thì lấy `resolved` từ dữ liệu đó, không gọi Google.
