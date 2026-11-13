# Spec T-153: Admin mở thẳng bảng enrich vendor

## Ý định
Capu 2026-11-13: "hiển thị trang dữ liệu vendor/enrich làm trang top khi vào page admin https://tohong-front.vercel.app/?admin=". Nguồn: board/T-153.md.

## Bằng chứng
- Ý định trực tiếp của Capu (trên). Hiện tại tab mặc định là "Thành viên" (`useState('members')`), bảng enrich nằm sau hai cú bấm. GIẢ ĐỊNH, tự tin ~90%: Capu muốn mở là thấy bảng enrich ngay vì đây là việc admin dùng nhiều nhất hiện nay.

## Giả thuyết
Nếu admin mở thẳng bảng enrich thì số cú bấm để duyệt vendor giảm 2. Chỉ số bảo vệ: người không phải admin vẫn không thấy gì; các tab khác vẫn dùng được.

## Hành vi (người dùng thấy gì)
1. Admin vào `?admin=`: thanh tab "Các mục admin" có "Dữ liệu vendor" là tab ĐẦU TIÊN, và nó đang được chọn. Tab đang chọn mang `aria-current="page"`, đúng một tab có thuộc tính này. Trang hiện ngay bảng "Bảng enrich vendor" (nút "Enrich Google Maps" aria-pressed=true). Không gọi API danh sách vendor hay members-summary khi chưa ai bấm tab đó.
2. Năm tab còn lại giữ nguyên tên và thứ tự tương đối: Thành viên, Hộp kết nối, Nâng cấp gói, Gói tự kích hoạt, Nhật ký. Bấm tab nào thì tab đó được chọn (aria-current chuyển theo) và nội dung tab hiện ra; rời "Dữ liệu vendor" thì bảng enrich biến mất; bấm quay lại "Dữ liệu vendor" từ tab khác thì lại là bảng enrich. Trong tab, hai nút "Danh sách vendor" / "Enrich Google Maps" vẫn chuyển qua lại như cũ.
3. Quy tắc chế độ xem của tab "Dữ liệu vendor": có vendor được chỉ định (từ nút "Sửa vendor này" ở Hộp kết nối) thì chế độ DANH SÁCH, mở đúng vendor đó (một lần GET `/api/admin/vendors/<id>`, không gọi API enrich); không có vendor chỉ định thì chế độ ENRICH.
4. Người không phải admin (GET `/api/admin/me` trả 403): vẫn chỉ thấy "Bạn không có quyền xem trang này", không có thanh tab, không có bảng, không có request nào tới `/api/admin/vendor-enrich*` hay `/api/admin/vendors*`.

## Ràng buộc (vòi)
- Repo: `tohong-front` · Nhánh: `t-153-admin-mo-bang-enrich` · Vùng: `planner/admin/vendor-enrich`
- Bất biến đã đọc: `eval/invariants/_shared/` + `planner/admin/` + `planner/admin/vendor-enrich/` (INV-001..007) — spec này không vi phạm; không chạm báo cáo, chữ ký back/HQ hay workflow dữ liệu. Eval T-124 (check_8) và T-147 (check_6) mở tab bằng cách bấm "Dữ liệu vendor" rồi "Enrich Google Maps"; bấm lại tab đang chọn phải không làm hỏng điều đó.
- Không chạm: quyền admin, API, drawer chi tiết (T-151, T-152 đang làm), payment, auth, schema, dữ liệu người dùng.
- Bậc đề xuất: A — chỉ đổi giao diện, eval tự động phủ hết.

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Vào ?admin=: "Dữ liệu vendor" đứng đầu, aria-current="page", bảng enrich hiện, không gọi danh sách vendor / members-summary | `bash eval/T-153/check_1_tab_dau_va_bang_enrich.sh` |
| 2 | Các tab khác chuyển qua lại được, thứ tự năm tab còn lại giữ nguyên, quay lại tab vendor là bảng enrich | `bash eval/T-153/check_2_chuyen_tab_qua_lai.sh` |
| 3 | Hộp kết nối > "Sửa vendor này" mở đúng vendor ở chế độ danh sách | `bash eval/T-153/check_3_hop_ket_noi_mo_dung_vendor.sh` |
| 4 | Người không phải admin không thấy tab/bảng và không gọi API vendor | `bash eval/T-153/check_4_nguoi_ngoai_khong_vao_duoc.sh` |

Mọi eval chạy từ gốc tohong-hq, repo front lấy từ `${TOHONG_FRONT_REPO:-/home/user/tohong-front}`; dùng Playwright, tự build và giả API (mẫu T-147 #6). Đã kiểm trên bản sao có vá thử: cả bốn PASS; trên mã hiện tại 1, 2, 3 đỏ, 4 xanh (đúng, vì 4 là hành vi phải giữ).

## Bất biến đề xuất (tầng 2)
Không. (Thứ tự tab và tab mặc định là lựa chọn sản phẩm, không phải tính chất phải đúng mãi.)

## Không làm
Không đổi quyền, API, drawer, nội dung bảng enrich; không thêm tab; không nhớ tab lần trước.

## Câu hỏi mở
Không.

## Ghi chú cho Engineering
Eval cũ T-124 check_8 và T-147 check_6 đang đỏ sẵn trên mã hiện tại với cùng lỗi (kiểm lúc viết spec, trước khi sửa); không phải do spec này. Chỉ cần không làm chúng đỏ thêm.
