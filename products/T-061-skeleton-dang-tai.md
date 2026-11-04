# Spec T-061: Trạng thái đang tải hiển thị skeleton

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu, 2026-11-04, nguyên văn: "ở trạng thái loading, màn hình hiển thị kiểu skeleton". Cặp đôi mở app trên điện thoại thấy khung xương đúng hình bố cục sắp hiện, thay vì màn trống giả ("0 người", "Chưa có khách mời") hay chữ "Đang tải…" trơn.

## Bằng chứng
Đo trên origin/main `218e623` của tohong-front, API giả trả chậm 1,5s, khung 390x844 (`products/` không có insight riêng; số liệu do Spec Writer đo, tự tin cao ~90%):
- Kế hoạch, Ngân sách, Khách mời không có trạng thái tải nào. Lúc chờ chúng hiện nội dung rỗng như thật: Khách mời "0 người", "Chưa có khách mời. Thêm khách đầu tiên để bắt đầu theo dõi RSVP." và nút "Thêm khách mời"; Ngân sách "0tr / 0tr", "Chưa đặt mục tiêu", "Chưa có hạng mục ngân sách…"; Kế hoạch "0/0 việc xong". Khi dữ liệu về, nội dung nhảy. Lỗi tải bị `.catch(() => {})` nuốt: màn ở lại trạng thái rỗng giả, không có thông báo, không có Thử lại.
- Trang chủ đã có skeleton (`DBSkeleton`, `src/screens/Dashboard.jsx:168`) nhưng: thẻ đầu cao 132px, thẻ thật cao 164px; ô tổng quan cao 92px, thật 117px (nhảy ~32px); chỉ bật sau khi biết `coupleId`, nên khoảng chờ `/api/me` vẫn hiện nội dung rỗng; không tắt chuyển động khi `prefers-reduced-motion`; `aria-live`/`aria-label` đặt trên `div` không có role.
- Mọi lỗi tải ở bốn tab đều im lặng. Chỉ có thông báo lỗi + Thử lại ở admin (`src/admin/common.jsx` `ErrorNote`) và câu "Không tải được gợi ý. Thử lại sau giúp Tơ Hồng nhé." trong thẻ chat.
- Màn khác đang chờ bằng chữ trơn: thẻ gợi ý vendor trong chat ("Đang tìm vendor phù hợp với hồ sơ của bạn…", `VendorChatCards.jsx:279`), danh sách vendor so sánh ("Đang tải các vendor khác…", `:754`), lịch sử cuộc trò chuyện (`chatSession.loading` chỉ hiện ba chấm gõ, `AppChat.jsx:473`), admin Thành viên ("Đang tải…", `admin/Members.jsx:52`; "Đang tải danh sách…", `admin/MemberList.jsx:85`), trang con hạng mục ngân sách khi mở bằng link sâu (lúc chưa tải xong rơi về danh sách rỗng).
- Cả bốn màn tab đều được dựng cùng lúc và cùng gọi API khi mở app (đếm trên main: `summary` 3 lần, `budget` 3 lần, các đường dẫn khác 1 lần). Spec này không đổi con số đó (tiêu chí 11).
- Các thẻ `GuestCard`, `TimelineCard`, `ChecklistCard` trong `chat/cards.jsx` có chữ "Đang tải …" nhưng không có đường mở nào trong app hiện nay (chip chủ đề `chips` tính ra nhưng không được vẽ, `AppChat.jsx:440`). Ngoài phạm vi, ghi ở "Không làm".

## Giả thuyết
Nếu thay màn rỗng giả và chữ chờ bằng skeleton đúng hình bố cục thì cặp đôi không còn thấy dữ liệu sai trong 1–2 giây đầu và bố cục không nhảy khi dữ liệu về. Chỉ số bảo vệ: thời gian tới nội dung thật (API không đổi, không thêm yêu cầu), cuộn cấp trang và thanh tab (ADR-022, layout inv-007..011).

## Hành vi (người dùng thấy gì)

### 1. Phạm vi (chốt, xác nhận mặc định của Chief of Staff và thêm hai mục)
Có skeleton:
- A. Bốn tab: Trang chủ, Kế hoạch, Ngân sách, Khách mời. Trang con hạng mục ngân sách (`#/ngan-sach/<id>`) khi ngân sách chưa tải xong.
- B. Chat AI: danh sách gợi ý vendor (`VMatchChatCard`), danh sách vendor để so sánh (`VPickerMultiChatCard`), lịch sử cuộc trò chuyện khi mở một cuộc từ ngăn kéo.
- C. Admin, tab Thành viên: khối số liệu tổng hợp và danh sách thành viên.

Không có skeleton (không phải "chờ dữ liệu của màn"): chấm gõ khi AI đang trả lời; chữ AI đang viết trong thẻ chi tiết vendor (`whyLoading`); nút "Xem thêm" đang tải; các tab admin khác (Hộp kết nối, Nâng cấp gói, Gói tự kích hoạt, Dữ liệu vendor, Nhật ký, Số liệu `AdminApp`); màn trắng của Clerk (`AuthedApp` trả `null`); thẻ GuestCard/TimelineCard/ChecklistCard (không có đường mở).

### 2. Khi nào hiện và biến mất
- Một màn "đang chờ" từ lúc nó bắt đầu chờ dữ liệu (mở app, đổi tab, mở trang con, mở thẻ chat, hoặc màn được dựng lại), kể cả khoảng chờ `/api/me`, tới lúc yêu cầu dữ liệu chính của màn trả lời (thành công, 404, hoặc lỗi).
- Mốc thời gian: các khối skeleton, vùng `role="status"` và `aria-busy="true"` **xuất hiện cùng một lúc**, khoảng 150ms sau lúc bắt đầu chờ (eval đo 100–250ms từ lúc điều hướng, kể cả khi `/api/me` còn chờ 1s). Không được bật "chỉ sau khi `/api/me` về". Trong lúc đó (kể cả lúc chờ `/api/me`) chỉ có nền giấy, header và thanh tab; không hiện nội dung rỗng giả. Tải xong trong 150ms thì skeleton không hề xuất hiện. Đã hiện thì giữ tới khi tải xong (không có thời gian tối thiểu).
- **Header được phép đổi khi `/api/me` về** (ví dụ ở 320px nút "Mời cùng xem" xuất hiện làm header cao thêm khoảng 17px; đó là header thật, không phải skeleton). Dịch chuyển giữa skeleton và nội dung thật (tiêu chí 4) được đo **kể từ lúc `/api/me` đã về**, ở cả 390 và 320. Spec không đòi giữ chỗ cho nút đó.
- **Làm mới và dựng lại** (luật mới, thay câu cũ "dữ liệu cũ ở nguyên như main"): Kế hoạch và Khách mời được dựng lại bằng `key` mỗi khi chat thêm việc/khách (main hiện màn rỗng giả "0 người"). Khi một màn dựng lại hoặc tải lại mà chưa có dữ liệu thì áp cùng luật: skeleton sau ~150ms, không rỗng giả. Khi màn vẫn còn dữ liệu (ví dụ Ngân sách tải lại theo `refreshKey`) thì giữ dữ liệu đang hiện tới khi có bản mới và không chèn skeleton. Cơ chế (giữ `key` hay bỏ) do Engineering chọn, miễn đúng hai câu trên.
- 404 của `budget`/`timeline` nghĩa là "chưa có dữ liệu", không phải lỗi: hiện trạng thái rỗng như main (Ngân sách: "Chưa có hạng mục ngân sách…"). Skeleton không được quay mãi.
- Lúc chờ, các giá trị phụ thuộc dữ liệu ở header không hiện giá trị giả: "0 người", "0 xác nhận · 0 chờ", thanh RSVP (phần tô), "0/0 việc xong", "Chưa có số khách", "Chưa đặt mục tiêu", "Chưa đặt sức chứa". Để trống đúng chiều cao dòng hoặc thay bằng khối skeleton cùng dòng. Nút hành động của trạng thái rỗng ("Thêm khách mời", "Thêm hạng mục", "Thêm việc") không hiện lúc chờ.

### 3. Hình dạng, bám bố cục thật (khung 390; ở 320 cũng phải khớp)
Header và thanh tab là bản thật, không thành skeleton (header có thể đổi khi `/api/me` về, xem mục 2). Skeleton chỉ nằm dưới header. Mỗi khối skeleton là một hình chữ nhật đặc (phần tử rỗng, nền tô, bo theo `--r-sm`/`--r-lg`); khối có thể gồm nhiều hình, không có chữ trong khối.

| Màn | Khối đầu của skeleton phải khớp | Các khối sau (tối thiểu) |
| --- | --- | --- |
| Trang chủ | thẻ đếm ngược: rộng 358, cao 164 (đo trên main), cùng top với thẻ thật | nhãn "Tổng quan" (bar ~90x12), lưới 2x2 ô cao 117; phần "Sắp tới" không dựng (số mục thay đổi) |
| Kế hoạch | thẻ tóm tắt giai đoạn: rộng 358, cao 55, cùng top với thẻ thật | tiêu đề giai đoạn cao 35; >= 4 hàng việc cao 61 |
| Ngân sách | dòng chữ "ĐÃ PHÂN BỔ": khối cao bằng dòng chữ, cùng top | số tiền lớn, thanh tiến độ cao 8, nhãn "HẠNG MỤC", >= 3 hàng hạng mục cao ~74 |
| Khách mời | dòng tiêu đề nhóm "NHÀ TRAI": khối cùng top với dòng chữ | >= 3 hàng khách cao 70 |
| Trang con hạng mục | nút Quay lại thật; tên hạng mục là một khối | khối tổng + >= 3 hàng khoản |
| Chat: gợi ý vendor | ảnh bìa vendor đầu: rộng 100, cao >= 100, cùng top với ảnh thật | >= 3 hàng (ảnh 100x100 + 3 dòng chữ); tiêu đề thẻ ("Tiệc & nhà hàng") là bản thật |
| Chat: so sánh | hàng vendor: ảnh 40x40 + 2 dòng | >= 3 hàng |
| Chat: lịch sử | bong bóng tin nhắn (trái và phải xen kẽ) | >= 3 bong bóng |
| Admin Thành viên | hai thẻ số liệu cao bằng thẻ thật | >= 3 hàng danh sách; ô tìm kiếm không nhảy |

**Chỉ các dòng Trang chủ, Kế hoạch, Ngân sách, Khách mời và ảnh bìa vendor trong chat có eval đo hình học (tiêu chí 2 và 4). Các dòng trang con hạng mục, so sánh vendor, lịch sử chat, admin là hướng dẫn, nghiệm thu bằng ảnh 390 của tiêu chí 12 (trang con: eval chỉ đo thanh tab; admin: ô tìm kiếm ±4px). Code Gate không được trả `--kind spec` vì "hình dạng sai" ở các dòng này.**

Dung sai (đo từ lúc `/api/me` đã về): tiêu đề và thanh tab lệch tối đa 2px; top của khối đầu so với mốc thật tối đa 3px; chiều cao khối đầu (chỉ Trang chủ, Kế hoạch, và ảnh bìa chat) tối đa 4px; Số hàng skeleton khác số hàng thật là được (số mục chưa biết), không đo.

### 4. Màu và chuyển động
- Màu chỉ lấy từ token có sẵn: `--line-100` (mặc định), `--line-200`, `--sand`, `--linen`. Không màu cứng, không màu mới.
- Hiệu ứng là **pulse** (độ mờ 0,55 ↔ 1, chu kỳ ~1,3s, như `dbPulse` đang có), không shimmer: một hiệu ứng, một cách đo, không cần màu mới. Khi người dùng bật `prefers-reduced-motion: reduce`, không animation nào chạy trong skeleton; khối vẫn hiện tĩnh.

### 5. Truy cập
- Mỗi vùng chờ là một phần tử có `role="status"`, tên truy cập "Đang tải…" (nhãn, không phải chữ nhìn thấy), và nằm trong (hoặc là) phần tử `aria-busy="true"`. **`aria-busy="true"` chỉ đặt trên vùng nội dung đang chờ (phần dưới header): không phủ header, thanh tab, nút "Mở menu"/AI hay bất kỳ phần tử focus được nào.** Không đặt `aria-busy` ở gốc màn. Cây truy cập của vùng chỉ có nhãn đó: các khối skeleton không được đọc, không có nút/liên kết/ô nhập.
- Không phần tử nào trong vùng chờ focus được; nhấn Tab không bao giờ đưa focus vào vùng chờ.
- Tải xong: `aria-busy` bỏ (hoặc "false"), vùng `status` "Đang tải" biến mất.
- Chữ "Đang tải…" nhìn thấy (rộng và cao > 8px) không còn ở bất kỳ màn nào trong phạm vi.

### 6. Lỗi tải
- Chat (gợi ý vendor, so sánh): giữ nguyên câu hiện có ("Không tải được gợi ý. Thử lại sau giúp Tơ Hồng nhé." / "Không tải được danh sách. …"), không nút; skeleton biến mất.
- Admin: `ErrorNote` như cũ (`role="alert"`, nút "Thử lại"); skeleton biến mất.
- Bốn tab và trang con (KHÔNG có lỗi hiển thị trên main, xem Bằng chứng): khi yêu cầu dữ liệu chính của màn lỗi (hoặc `/api/me` lỗi) thì skeleton biến mất và thay bằng một thông báo `role="alert"` bắt đầu bằng "Không tải được" kèm nút tên đúng "Thử lại". Bấm Thử lại gửi lại yêu cầu bị lỗi và màn về lại trạng thái chờ rồi nội dung thật. Lúc lỗi không hiện trạng thái rỗng giả (cùng danh sách ở mục 2). Văn bản đầy đủ do Engineering chọn, miễn bắt đầu bằng "Không tải được".
- Lịch sử cuộc trò chuyện: giữ hành vi hiện có (`chatSession.error` hiện thành tin nhắn lỗi của AI).

### 7. Không đổi API
Cùng các yêu cầu như main: không endpoint mới, không đổi phương thức, không thêm lần gọi (trần từng đường dẫn khi mở một màn = số đo trên main: summary 3, budget 3, còn lại 1; tiêu chí 11). Thử lại sau lỗi là yêu cầu cũ gọi lại.

## Ràng buộc (vòi)
- Repo: `tohong-front` · Nhánh: `t-061-skeleton` · Vùng (`area`): `planner/front/loading`
- Bất biến của vùng đã đọc: `eval/invariants/_shared/` (INV-001 không secret, INV-002 số cái đọc được), `planner/front/layout` inv-001..011, `navigation` inv-001..007, `budget` inv-001..004. Spec này không vi phạm; cụ thể: skeleton không tạo cuộn ngang (inv-002), khối trên mép trang không nền sẫm (inv-011), thanh tab và header vẫn dính (inv-008, 010), document là thứ cuộn (inv-007), không thêm lớp phủ nào. Không đề nghị đổi bất biến cũ.
- Kiến trúc / design system: token màu và bo góc trong `src/index.css` (`--line-100`, `--r-sm`, `--r-lg`); `db-skel`/`dbPulse` là chỗ đã có, dùng lại hoặc thay thế đều được. `src/nav.js` không đổi.
- Không chạm: payment, auth, schema DB, dữ liệu người dùng, API.
- Bậc lưới lọc đề xuất: **A** (giữ như Chief of Staff đặt) vì chỉ UI, API không đổi, eval tự động phủ gần hết. Một điểm đáng nâng cân nhắc: thông báo lỗi mới ở bốn tab là hành vi mới nhìn thấy được (xem Câu hỏi mở); vẫn không chạm ranh giới cứng nên không cần bậc B.

## Tiêu chí chấp nhận và eval
Chạy từ `/home/user/tohong-hq`; `<front>` = `/home/user/tohong-front` (đã ở nhánh cần đo). Mỗi lệnh in `PASS`/`FAIL <lý do>`, mã thoát 0/1.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Bốn tab và trang con hạng mục: khi API trễ 1,5s có vùng `role=status` "Đang tải" nhìn thấy, `aria-busy="true"`, >= 3 khối skeleton; không có chữ chờ trơn, trạng thái rỗng giả hay nút thêm; dữ liệu về thì nội dung thật hiện và skeleton biến mất | `bash eval/T-061/run.sh <front> --only 1` |
| 2 | Chat (kiểm ở mốc cố định 700ms sau khi mở): gợi ý vendor và lịch sử trò chuyện có skeleton, không chữ chờ trơn, tiêu đề thẻ không nhảy (±2), ảnh bìa đầu khớp (top/rộng/cao ±4) | `bash eval/T-061/run.sh <front> --only 2` (danh sách so sánh vendor: `eval/T-061/checklist.md`, vì cần luồng nhiều bước) |
| 3 | Admin Thành viên (kiểm ở mốc cố định 700ms sau khi mở): vùng danh sách và vùng số liệu đều có skeleton, không chữ chờ trơn, ô tìm kiếm không nhảy (±4) | `bash eval/T-061/run.sh <front> --only 3` |
| 4 | Không nhảy bố cục ở 390 và 320, đo từ lúc `/api/me` đã về: tiêu đề ±2, thanh tab ±2, top khối đầu ±3, chiều cao khối đầu ±4 (Trang chủ, Kế hoạch); trang con: thanh tab ±2. Làm mới: Khách mời (dựng lại, chưa có dữ liệu) hiện skeleton không rỗng giả; Ngân sách (còn dữ liệu) không chèn skeleton và giữ dữ liệu cũ | `bash eval/T-061/run.sh <front> --only 4` |
| 5 | Lỗi tải: bốn tab và `/api/me` hiện "Không tải được…" + "Thử lại", không rỗng giả, Thử lại hoạt động; ngân sách 404 là trạng thái rỗng; chat và admin giữ thông báo như cũ | `bash eval/T-061/run.sh <front> --only 5` |
| 6 | Thời điểm: tải nhanh (~20ms) không hề hiện skeleton; với `/api/me` trễ 1s và dữ liệu trễ 1,5s, khối skeleton nhìn thấy trong 100–250ms từ lúc điều hướng (tức trong lúc chờ `/api/me`) và suốt lúc chờ không có chữ rỗng giả | `bash eval/T-061/run.sh <front> --only 6` |
| 7 | `prefers-reduced-motion`: mặc định có animation chạy trong skeleton; bật reduce thì không animation nào chạy mà khối vẫn hiện | `bash eval/T-061/run.sh <front> --only 7` |
| 8 | Truy cập: `role=status` tên "Đang tải", trong `aria-busy="true"` chỉ bọc vùng nội dung (không chứa header, thanh tab, nút Mở menu/AI), cây truy cập chỉ có nhãn, không focus được, Tab 14 lần không vào vùng; xong thì biến mất | `bash eval/T-061/run.sh <front> --only 8` |
| 9 | Mọi khối skeleton tô bằng `--line-100`/`--line-200`/`--sand`/`--linen` | `bash eval/T-061/run.sh <front> --only 9` |
| 10 | 320 và 390: lúc chờ không cuộn ngang | `bash eval/T-061/run.sh <front> --only 10` |
| 11 | Không đổi API: chỉ gọi endpoint đã có; trần từng đường dẫn khi mở một màn = số đo trên main (GET summary 3, GET budget 3, mọi đường khác 1) | `bash eval/T-061/run.sh <front> --only 11` |
| 12 | PR có ảnh 390 trước (main) và sau cho từng màn trong phạm vi (>= 10 ảnh, ghi rõ "390", mục Trước, mục Sau) | `bash eval/T-061/check_pr.sh <số-PR>`; tạo ảnh: `bash eval/T-061/run.sh <front> --only 1,2,3 --shots <thư-mục>` |
| 13 | Bất biến planner/front/* và _shared, cộng eval T-054 (cuộn cấp trang) vẫn xanh | `bash eval/T-061/run.sh <front> --only 13` (gồm `bash eval/T-054/run_invariants.sh <front>`) |

Chạy tất cả (trừ 12): `bash eval/T-061/run.sh <front>`. Đo trên main `218e623` phải ĐỎ ở tiêu chí 1–10 (đã thấy), tiêu chí 11 và 13 XANH (chốt hồi quy).
Chạy riêng các bất biến: `bash eval/T-061/run.sh <front> --only 13` (chạy cả `planner/front/layout|navigation|budget`, `_shared` và thư mục `planner/front/loading` khi có; hoặc `python3 scripts/gate.py T-061 --cwd /home/user/tohong-front`, vùng `planner/front/loading` chạy cả bất biến cha `planner/front`, `planner`).

## Bất biến đề xuất (tầng 2)
INV đề xuất (vùng `planner/front/loading`, viết thành script sau khi spec qua cổng; Spec critic quyết):
1. **Trạng thái chờ không nói dối**: ở bốn tab, trong lúc API chưa trả lời, không có chữ trạng thái rỗng ("Chưa có khách mời", "Chưa có hạng mục", "0 người"…) và không có nút "Thêm …" nhìn thấy. Đo bằng khung TC1 (API trễ).
2. **Skeleton có nhãn và không focus được**: mọi `[aria-busy="true"]` nhìn thấy chứa `role=status` tên "Đang tải", không chứa header/thanh tab và không phần tử focus được (TC8).
3. **Skeleton tôn trọng reduced-motion**: bật `prefers-reduced-motion: reduce` thì không animation nào chạy trong vùng `aria-busy="true"` (TC7).
Các tính chất hình học (không nhảy) gắn với dữ liệu giả cụ thể nên giữ ở tầng 1, không đề nghị thành bất biến.

## Không làm
- Không đổi API, dữ liệu, thứ tự yêu cầu, số lần gọi; không thêm bộ nhớ đệm.
- Không shimmer, không thư viện skeleton, không màu mới.
- Không skeleton cho: chấm gõ AI, `whyLoading`, "Xem thêm", tab admin ngoài Thành viên, màn trắng Clerk, thẻ GuestCard/TimelineCard/ChecklistCard (không có đường mở; nếu sau này bật lại phải làm theo spec này).
- Không dựng "Sắp tới" của Trang chủ trong skeleton.
- Không thời gian hiện tối thiểu cho skeleton; không đổi `nav.js`; không đổi bất biến nào.

## Câu hỏi mở
Một câu cho Capu (mặc định đã áp dụng, đổi được sau): ở bốn tab hiện nay lỗi tải bị nuốt im lặng nên tiêu chí "lỗi tải vẫn hiện thông báo + Thử lại như cũ" không có "cũ" để giữ. Spec chọn: khi lỗi thì skeleton thay bằng thông báo "Không tải được…" kèm nút "Thử lại" (hành vi mới, nhỏ, không đổi API), thay vì để skeleton quay mãi hoặc quay về màn rỗng giả. Capu có đồng ý không? Nếu không, phương án thay là quay về màn rỗng như main (và đổi tiêu chí 5, mục 6).
