# Spec T-188: Tạm mở toàn bộ trang admin không cần đăng nhập (cờ bật/tắt)

## Ý định
Capu 2026-11-16 (ADR-116, `decisions/2026-11-16-adr-116-mo-admin-khong-dang-nhap.md`): "tạm thời trang admin https://tohong-front.vercel.app/?admin= không cần đăng nhập vẫn có thể truy cập. khi edit thì mặc nhiên là admin". Chief đã nêu rủi ro; Capu chọn "Toàn bộ admin, không mã". Nguồn: `board/T-188.md`.

## Bằng chứng
- ADR-116 (ý định trực tiếp và các ràng buộc Chief đặt). Không có số liệu người dùng; không cần.
- Đọc mã (back `c789686`, front `26c5758`): `lib/adminAuth.js` `requirePlatformAdmin` là cổng duy nhất, gọi ở dòng đầu `handleAdmin` (`api/admin.js`) cho mọi `/api/admin/*`; `auth.userId` được ghi vào `admin_id` của nhật ký và vào `by` / `reviewed_by` của lớp sửa vendor, bản duyệt enrich, yêu cầu kết nối, yêu cầu nâng cấp, gói. `isCapu` (quyền ký bản duyệt enrich) dựa vào `ADMIN_USER_IDS` + `CAPU_USER_IDS`. Front `src/admin/AdminApp.jsx` đòi Clerk (`SignedOut` → nút "Đăng nhập") hoặc `VITE_ADMIN_DEV_TOKEN`; không có thì hiện "Chưa cấu hình đăng nhập".
- Bể bất biến chạm vùng này: `eval/invariants/planner/admin/members/` INV-001..006 (INV-002: không phải admin → 403 ở mọi route members-*), `planner/admin/vendor-enrich/` INV-001..013 (INV-008: người ngoài không thấy, không gọi API vendor; INV-010: đọc là admin, ghi/ký là Capu).

## Giả thuyết
Nếu bật cờ thì Capu (và ai Capu gửi link) vào được `?admin=` ngay không qua Clerk, đúng ý "tạm thời". Chỉ số bảo vệ: khi cờ tắt (mặc định) không có gì đổi, mọi bất biến 403 hiện có vẫn xanh; không route nào ngoài `/api/admin/*` bị mở; không ai nhận được quyền Capu (ký bản duyệt enrich).

## Hành vi (người dùng thấy gì)

Định nghĩa dùng xuyên suốt:
- **Danh tính cố định** = đúng chuỗi `admin-khong-dang-nhap`.
- **Cờ Worker** = biến môi trường `ADMIN_OPEN` của Worker back. **Bật** khi và chỉ khi giá trị là đúng chuỗi `1`. Thiếu, rỗng, `0`, `true`, `yes`, `on`, ` 1`, `1 `, `01` hay bất kỳ giá trị nào khác đều là **tắt**.
- **Cờ build** = biến `VITE_ADMIN_OPEN` lúc build front. **Bật** khi và chỉ khi đúng chuỗi `1`; mọi giá trị khác là tắt. Hai cờ độc lập; cần cả hai bật để dùng trọn trang.
- Mặc định trong code và trong mọi file cấu hình nằm trong repo (`wrangler*.toml`, `.dev.vars*`, `.env*`) là **tắt**: không file nào đặt `ADMIN_OPEN=1` hay `VITE_ADMIN_OPEN=1`. Capu tự bật ở Cloudflare/Vercel.

1. **Cờ Worker bật, mọi yêu cầu `/api/admin/*` (mọi phương thức) chạy không cần đăng nhập.** Không có token, token rác, token guest, token của một admin thật hay của người thường: kết quả như nhau, không còn 401/403 do cổng admin. Danh tính của yêu cầu luôn là danh tính cố định, bất kể token và bất kể `ADMIN_USER_IDS` (thiếu, rỗng, hay liệt kê người khác). `GET /api/admin/me` trả `admin: true` và `user_id: "admin-khong-dang-nhap"`. Đường lạ dưới `/api/admin/` vẫn trả như cũ (không phải 403, không phải 200).
2. **Cờ Worker bật, mọi thao tác ghi dưới `/api/admin/*` thành công không token và ghi đúng danh tính cố định.** Gồm: sửa/xoá lớp sửa vendor, duyệt/rút duyệt enrich, đổi trạng thái yêu cầu kết nối, kích hoạt/từ chối yêu cầu nâng cấp, thu hồi/giữ gói tự kích hoạt. Mọi dòng nhật ký (`GET /api/admin/audit`) sinh ra có `admin_id` = danh tính cố định; lịch sử lớp sửa vendor, bản duyệt enrich (`reviewed_by`), yêu cầu kết nối và gói ghi người thao tác = danh tính cố định; không nơi nào ghi mã admin thật hay guest vì yêu cầu đó. Danh tính cố định **không bao giờ là Capu**: bản duyệt enrich của nó có `by_capu=false`, kể cả khi ai đó liệt kê chính chuỗi này trong `ADMIN_USER_IDS` hoặc `CAPU_USER_IDS`; nên export ký (`/api/internal/vendor-enrich/export`) không có mục nào của nó.
3. **Cờ Worker tắt: y như hôm nay, từng byte.** Mọi yêu cầu `/api/admin/*` từ người không trong `ADMIN_USER_IDS` (không token, rác, guest, người thường, `ADMIN_USER_IDS` thiếu/rỗng) vẫn nhận 403 với thân đúng `{"error":"forbidden"}`, không ghi R2. Phản hồi (mã + thân) với `ADMIN_OPEN` thiếu và với từng giá trị tắt liệt kê ở trên **giống hệt nhau**. Admin thật (trong `ADMIN_USER_IDS`) vẫn thấy `user_id` của chính họ ở `/me`, không phải danh tính cố định.
4. **Không mở gì ngoài `/api/admin/*`.** Với cờ bật, mọi route khác (`/api/couples/*`, `/api/vendors*`, `/api/claim`, `/api/internal/*`, đường lạ, `/api/administrator`, `/api/adminx/me`, `/api/admin-members`, `/admin/me`) trả mã và thân **giống hệt** khi cờ tắt, cho cùng yêu cầu không token / token rác / guest; không ghi thêm R2. Người ngoài vẫn không đọc được dữ liệu cặp đôi. Quyền của cặp đôi (owner/member/viewer) không đổi.
5. **Cờ build bật, `/?admin=` không đòi đăng nhập.** Không cần khoá Clerk, không cần token dev: vào thấy ngay thanh tab "Các mục admin" đủ sáu tab, trang gọi `GET /api/admin/me`, bấm được mọi tab, không có nút "Đăng nhập", không có chữ "Chưa cấu hình đăng nhập". Khi có khoá Clerk (như production), vẫn không hiện nút "Đăng nhập" và không gửi request nào tới máy chủ Clerk. Nếu Worker trả 403 cho `/me` (Worker chưa bật cờ) thì trang vẫn chỉ nói "Bạn không có quyền xem trang này", không thanh tab, không gọi `/api/admin/vendor-enrich*` hay `/api/admin/vendors*`. Trang không phải `?admin` không đổi.
6. **Cờ build tắt (thiếu hoặc khác đúng `1`): y như hôm nay.** Không khoá Clerk + không token dev: "Chưa cấu hình đăng nhập", không thanh tab, không gọi `/api/admin/*`. Có token dev: vào được như cũ (chạy local). Có khoá Clerk: cổng đăng nhập chặn trước khi gọi API admin.
7. **Bất biến hiện có vẫn xanh với cờ tắt**: members INV-002, vendor-enrich INV-008 và INV-010.

Ai thấy gì khi cờ bật (để Capu đọc ở diff hành vi): bất kỳ ai có link `?admin=` (hoặc biết địa chỉ API, vì API gọi thẳng được không cần trang) xem được Thành viên (tên, email), Hộp kết nối (tên, email, số điện thoại/Zalo cặp đôi để lại), Hàng chờ nâng cấp, Gói tự kích hoạt, Nhật ký; sửa được dữ liệu vendor; đổi trạng thái yêu cầu kết nối; **kích hoạt gói trả phí cho cặp đôi bất kỳ** và thu hồi gói. Mọi thứ đó được ghi dưới một danh tính chung nên không phân biệt được ai làm.

## Ràng buộc (vòi)
- Repo: `tohong-back` (`lib/adminAuth.js`, nơi `requirePlatformAdmin` và `isCapu` sống) và `tohong-front` (`src/admin/AdminApp.jsx`) · Nhánh: `t-188-mo-admin-khong-dang-nhap` (cả hai repo) · Vùng (`area`): board đang ghi `hq/admin`; bất biến liên quan nằm ở `planner/admin/` nên đề nghị Chief đổi sang `planner/admin` (xem Câu hỏi mở).
- Bất biến đã đọc: `_shared/` + `planner/admin/members/` INV-001..006 + `planner/admin/vendor-enrich/` INV-001..013. Spec không vi phạm khi cờ tắt. **Khi cờ bật, lời văn tuyệt đối của members INV-002, vendor-enrich INV-008 và INV-010(a) ("người không phải admin luôn 403") không còn đúng theo ý ADR-116.** Mọi eval của các bất biến ấy dựng env tường minh (không có `ADMIN_OPEN`) nên chúng vẫn chạy xanh với cờ tắt; bản thay đề xuất ở "Bất biến đề xuất". Spec không tự sửa bất biến.
- Kiến trúc: giữ một cổng duy nhất (`requirePlatformAdmin`) cho `/api/admin/*`; không rải kiểm tra cờ ở từng route. Front: một cờ build, đọc một chỗ.
- Không chạm: route ngoài `/api/admin/*`, quyền cặp đôi, schema dữ liệu, export ký, payment (chỉ lộ ra qua việc mở cổng admin, không đổi logic gói), `wrangler.toml` [vars], secret. Không đặt biến thật ở Cloudflare/Vercel.
- Bậc lưới lọc: **C** (auth + dữ liệu người dùng + thao tác cấp gói). Capu đọc diff hành vi và tự merge.

## Tiêu chí chấp nhận và eval
Mọi eval chạy từ gốc `tohong-hq`; repo lấy từ `TOHONG_BACK_REPO` / `TOHONG_FRONT_REPO` (mặc định cạnh gốc HQ). Back dùng worker thật + R2 giả của chính repo, mạng bị chặn. Front tự build vào thư mục tạm + Playwright + API giả.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Cờ Worker bật: mọi route đọc `/api/admin/*` chạy không token / token rác / guest / admin thật / người thường; `/me` trả danh tính cố định | `bash eval/T-188/check_1_co_bat_doc_khong_token.sh` |
| 2 | Cờ Worker bật: mọi thao tác ghi thành công không token, nhật ký và lịch sử ghi danh tính cố định, danh tính đó không bao giờ là Capu | `bash eval/T-188/check_2_co_bat_ghi_danh_tinh_co_dinh.sh` |
| 3 | Cờ Worker tắt/khác đúng `1`: 403 như cũ giống hệt từng byte; cấu hình trong repo không bật cờ | `bash eval/T-188/check_3_co_tat_nhu_cu.sh` |
| 4 | Cờ bật không đổi gì ở route ngoài `/api/admin/*` và quyền cặp đôi | `bash eval/T-188/check_4_khong_mo_route_ngoai_admin.sh` |
| 5 | Cờ build bật: `?admin=` không đòi đăng nhập (kể cả khi có khoá Clerk); Worker 403 thì vẫn "không có quyền" | `bash eval/T-188/check_5_front_co_bat_khong_dang_nhap.sh` |
| 6 | Cờ build tắt/khác đúng `1`: y như hôm nay | `bash eval/T-188/check_6_front_co_tat_nhu_cu.sh` |
| 7 | Bất biến admin hiện có (members INV-002, vendor-enrich INV-008, INV-010) vẫn xanh với cờ tắt | `bash eval/T-188/check_7_bat_bien_admin_hien_co.sh` |

Tự kiểm bằng bản cài giả (cờ đọc ở `requirePlatformAdmin` + `isCapu` loại danh tính cố định; front đọc `VITE_ADMIN_OPEN === '1'` ở `AdminApp`): 1-7 đều PASS. Trên mã hiện tại: 1, 2, 5 đỏ (đúng, là hành vi mới); 3, 4, 6, 7 xanh (đúng, là hành vi phải giữ). Đột biến thử: cờ hiểu "truthy" làm 3 và 6 đỏ; bỏ loại trừ Capu làm 2 đỏ; danh tính khác làm 1 đỏ.

## Bất biến đề xuất (tầng 2)
Cho `planner/admin/` (Spec critic rút vào bể khi spec qua cổng):
- **INV-A (cờ chỉ mở với đúng `1`)**: copy `check_3` (không gồm phần quét cấu hình repo nếu thấy vướng) — mọi giá trị `ADMIN_OPEN` khác đúng `1` cho 403 `{"error":"forbidden"}` giống hệt cờ thiếu.
- **INV-B (danh tính cố định không bao giờ là Capu, không bao giờ vào export ký)**: phần Capu của `check_2`.
- **INV-C (cờ không mở route ngoài `/api/admin/*`)**: copy `check_4`.
- **INV-D (không file cấu hình trong repo bật cờ)**: phần quét cấu hình của `check_3`.
- **Bản thay lời văn cho Chief (sửa bất biến phải qua Chief, ghi `decisions/`)**: thêm vế "khi `ADMIN_OPEN` khác đúng `1`" vào members INV-002, vendor-enrich INV-008 và INV-010(a); nội dung kiểm giữ nguyên.
- **Làm cứng bản chụp front của bất biến**: `members/lib/members_ui_inv.cjs` và `vendor-enrich/lib/t153_admin_tab.cjs` build với `{...process.env, ...}`; nếu máy chạy gate có `VITE_ADMIN_OPEN=1` trong môi trường, hai bất biến này sẽ đỏ oan (trang mở không đăng nhập). Đề nghị thêm `VITE_ADMIN_OPEN: ''` vào env build của hai file (đổi một tham số, không đổi ý bất biến). Eval của T-188 đã tự ép như vậy.

## Không làm
- Không đặt biến `ADMIN_OPEN` / `VITE_ADMIN_OPEN` thật ở Cloudflare, Vercel hay file nào trong repo.
- Không thêm mã truy cập, giới hạn IP, giới hạn tần suất, hay biểu ngữ cảnh báo (ngoài ý ADR-116; nếu muốn, là việc riêng).
- Không mở route ngoài `/api/admin/*`; không đổi quyền cặp đôi; không đổi export ký; không đổi cách chọn Capu.
- Không gỡ hay đổi cổng khi cờ tắt: đường 403 giữ nguyên từng byte.
- Không dọn dữ liệu nhật ký cũ; nhật ký chỉ ghi thêm.

## Câu hỏi mở
Một: ADR-116 mở toàn bộ, nên "kích hoạt gói trả phí" và "thu hồi gói" (động chạm tiền) cũng mở cho ai có link. Spec theo đúng ADR (không loại trừ). Capu có muốn loại hai thao tác này khỏi phần mở không (khi đó hai route đó vẫn đòi admin thật, và spec/eval sửa lại)? Ngoài ra, việc nhờ Chief: đổi `--area` của T-188 sang `planner/admin` để bất biến tầng 2 của vùng tự chạy.
