# Quyết định · T-041 phạm vi bộ lọc sản phẩm trên dashboard

**Ngày:** 2026-11-02 · **Người quyết:** Chief of Staff (bậc A, đảo ngược được, không chạm ranh giới cứng) · **Nguồn:** Spec Gate `handoffs/T-041-D1.md`

1. **Một màn hình, một con số.** Khi chọn sản phẩm, mọi nơi hiện việc hay đếm việc đều lọc theo sản phẩm đó: bảng việc, KPI, Cảnh báo, Dòng thời gian, Feed, số trên khối mô hình, Release/Production, nhân vật và dot. Không để KPI "Bị chặn: 0" đứng cạnh Cảnh báo có việc bị chặn.
2. **Sản phẩm của việc do sổ cái quyết, không do trình duyệt suy.** `export_dashboard.py` thêm trường `product` cho mỗi việc, tính bằng `task.normalize_area` (vùng cũ `front/*` → `planner`, `dashboard/*` → `hq`; vùng rỗng → `""`). Dashboard chỉ đọc trường này.
3. **Việc không có sản phẩm** (`product: ""`) chỉ hiện ở "Tất cả".
4. **Mô hình luồng không đổi hình** khi đổi bộ lọc: cùng tọa độ khối, đường, cổng; khối bể được cao thêm nhưng giống nhau ở mọi lựa chọn (thu hẹp INV-P3 thành đúng câu này).
5. Insight theo sản phẩm: không thuộc T-041; charter Insight sẽ yêu cầu báo cáo tuần có mục `planner/` và `hq/` (báo sau trong digest).
