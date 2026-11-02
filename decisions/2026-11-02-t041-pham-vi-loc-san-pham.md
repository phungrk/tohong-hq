# Quyết định · T-041 phạm vi bộ lọc sản phẩm trên dashboard

**Ngày:** 2026-11-02 · **Người quyết:** Chief of Staff (bậc A, đảo ngược được, không chạm ranh giới cứng) · **Nguồn:** Spec Gate `handoffs/T-041-D1.md`

1. **Một màn hình, một con số.** Khi chọn sản phẩm, mọi nơi hiện việc hay đếm việc đều lọc theo sản phẩm đó: bảng việc, KPI, Cảnh báo, Dòng thời gian, Feed, số trên khối mô hình, Release/Production, nhân vật và dot. Không để KPI "Bị chặn: 0" đứng cạnh Cảnh báo có việc bị chặn.
2. **Sản phẩm của việc do sổ cái quyết, không do trình duyệt suy.** `export_dashboard.py` thêm trường `product` cho mỗi việc, tính bằng `task.normalize_area` (vùng cũ `front/*` → `planner`, `dashboard/*` → `hq`; vùng rỗng → `""`). Dashboard chỉ đọc trường này.
3. **Việc không có sản phẩm** (`product: ""`) chỉ hiện ở "Tất cả".
4. **Mô hình luồng không đổi hình** khi đổi bộ lọc: cùng tọa độ khối, đường, cổng; khối bể được cao thêm nhưng giống nhau ở mọi lựa chọn (thu hẹp INV-P3 thành đúng câu này).
5. Insight theo sản phẩm: không thuộc T-041; charter Insight sẽ yêu cầu báo cáo tuần có mục `planner/` và `hq/` (báo sau trong digest).

## Bổ sung sau Spec Gate lần 2 (2026-11-02, Chief of Staff)

6. **Ngoại lệ bảng Đội ngũ:** bảng này là bảng người (agent), không phải bảng việc; giữ số của cả công ty, nhưng hai cột "Đang giữ" và "Kết quả" phải ghi nhãn "cả công ty" khi đang lọc, để không đứng cạnh số đã lọc mà không chú thích. Kích thước nút trên Bản đồ luồng theo tập đã lọc (nguyên tắc H2); adversary thêm eval nếu Engineering bỏ qua.
7. Spec T-041 qua cổng → việc code là **T-042** (engineering, bậc A, vùng `hq/dashboard/model`), dùng đúng 6 eval của spec.
