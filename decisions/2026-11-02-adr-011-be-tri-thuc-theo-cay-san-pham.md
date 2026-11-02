# ADR-011 · Bể tri thức chia theo cây sản phẩm, agent dùng chung

**Ngày:** 2026-11-02 · **Người quyết:** Capu (qua Chief of Staff) · **Trạng thái:** đã chốt

## Bối cảnh

Tơ Hồng HQ vận hành hai sản phẩm không liên quan nhau: **wedding planner** cho cặp đôi (`planner/`) và **dashboard quản lý** cho Capu (`hq/`). Số sản phẩm sẽ tăng. Câu hỏi: mô hình Eval-Gated 2029 chia theo sản phẩm hay dùng chung agent, và bể tri thức có chia không.

## Quyết định

1. **Agent dùng chung.** Một bộ charter (`product`, `spec-critic`, `engineering`, `adversary`, `insight`) cho mọi sản phẩm. Agent không có trí nhớ; chuyên môn sản phẩm nằm ở bể, không nằm ở agent. Ngữ cảnh sản phẩm đi vào việc qua `area` và qua bể.
2. **Bể chia theo cây.** `eval/invariants/_shared/` → `<sản phẩm>/` → `<sản phẩm>/<vùng>/…`. `gate.py` chạy `_shared/` và mọi cấp cha của vùng việc chạm. Bất biến gần gốc phải tổng quát; `_shared/` chỉ chứa luật công ty (không secret trong repo, sổ cái đọc được).
3. **Vùng bắt buộc có tiền tố sản phẩm.** `task.py new --area` từ chối vùng không bắt đầu bằng `planner/` hay `hq/`. Vùng cũ (`front/…`, `dashboard/…`) được ánh xạ tự động để việc đã xong chạy lại được.
4. **Một sổ cái, một inbox, một ngưỡng chú ý.** Không tách board hay inbox theo sản phẩm. Ngưỡng 3 Decision Request/ngày tính cho cả công ty.
5. **Khác nhau ở nguồn áp và bậc mặc định**, không ở quy trình: `planner/` lấy insight từ PostHog, bậc mặc định B, chạm dữ liệu người dùng → C. `hq/` lấy insight từ sổ cái (thời gian qua cổng, rework, đứng yên), bậc mặc định A.

## Khi nào xét lại

Tách thành hai HQ chỉ khi: có Spec Owner thứ hai; bất biến `_shared/` bị hai sản phẩm kéo về hai hướng và phải phân xử liên tục; hoặc nhật ký sản phẩm này làm `task.py summary` của sản phẩm kia khó đọc.

## Hệ quả

- Di chuyển: `eval/invariants/front/*` → `planner/front/*`, `eval/invariants/dashboard/model` → `hq/dashboard/model`. Thêm `_shared/inv-001` (không secret), `_shared/inv-002` (sổ cái đọc được).
- `gate.py`: đi ngược cây, chỉ chạy file `inv-*`. `task.py`: `PRODUCTS`, `LEGACY_AREAS`, `normalize_area`.
- Dashboard: thêm bộ lọc theo sản phẩm (việc riêng, bậc A, vùng `hq/dashboard`).
- Bất biến rút được ở sản phẩm A mà tổng quát thì đặt lên `_shared/` để sản phẩm B được bảo vệ miễn phí — đây là lợi ích kinh tế chính của việc dùng chung agent.
