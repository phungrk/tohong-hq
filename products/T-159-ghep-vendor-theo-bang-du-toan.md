# Spec T-159: Ghép vendor (chat + tab Vendor) theo phân bổ hạng mục trong bảng dự toán

## Ý định
Capu (2026-11-14, board/T-159.md): gợi ý vendor theo đúng số tiền cặp đôi đã phân bổ cho từng hạng mục trong bảng dự toán, không chỉ tổng × tỷ lệ mặc định.

## Bằng chứng
- `lib/profileBuilder.js` (chat) đọc `coupleState.budget_breakdown[category]` (VND); `api/vendors.js` (tab) đọc `profile.budget_by_category` (triệu). Grep toàn tohong-back: không có chỗ nào ghi hai trường này (chỉ test và eval đối kháng T-143 đặt tay). Nên mọi cặp đôi thật luôn rơi về tổng × `BUDGET_TEMPLATE`. Tự tin cao (đã grep ngày 2026-11-14).
- Bảng dự toán nằm ở R2 `data/couples/<id>/budget.json` (`api/budget.js`); mỗi hạng mục có `id`, `allocated_tr` (triệu). `src/budget/useBudget.js` ghi `allocated_tr` là số nguyên triệu, tối thiểu 0; hạng mục mới người dùng thêm có id `c<timestamp>` và `allocated_tr` 0.
- GET `/api/couples/:id/budget` co giãn `allocated_tr` theo `profile.budget` khi tổng trong bảng lệch hồ sơ (api/budget.js): số người dùng nhìn thấy có thể khác số lưu.
- `BUDGET_TO_VENDOR_CATEGORIES` (lib/budgetCategories.js) hiện là identity: 10 hạng mục ↔ 10 category vendor, riêng `reserve` không có vendor.
- ADR-026 và inv-041: chấm điểm chat bằng ngân sách hạng mục gốc chưa nới; T-140 spec: nới ×1,2 chỉ ở bước lọc của chat; tab Vendor không nới.
- Mức độ người dùng thật có sửa bảng dự toán: GIẢ ĐỊNH, tự tin ~60% (chưa kiểm số liệu sử dụng; không ảnh hưởng tới tính đúng của spec).

## Giả thuyết
Nếu ghép vendor dùng số cặp đôi phân bổ thì vendor gợi ý khớp với số họ thấy trong bảng dự toán, và hạng mục họ đổi phân bổ thì danh sách đổi theo. Chỉ số bảo vệ: chất lượng top-5 chat (inv-039/041, T-140), tab Vendor không đổi với cặp đôi chưa phân bổ, độ trễ chat (không thêm quá một lần đọc R2).

## Hành vi (người dùng thấy gì)

Đơn vị: `allocated_tr` và `budget_by_category` tính bằng **triệu đồng**; `budget_for_category` của chat và `budget_breakdown` cũ tính bằng **VND**. Đổi triệu → VND bằng nhân 1.000.000 rồi làm tròn tới đồng; không thêm làm tròn nào khác.

**H1. Thứ tự nguồn ngân sách của một hạng mục** (cao xuống thấp; lấy nguồn đầu tiên có):
1. (chỉ chat) số tiền trong tin nhắn (cách đọc số trong `extractBudgetFromMessage` giữ nguyên);
2. `allocated_tr` của hạng mục đó trong bảng dự toán, nếu là số hữu hạn > 0 (xem H3);
3. trường cũ `budget_breakdown[category]` (chat, VND) / `budget_by_category[category]` (tab, triệu) nếu có: không ai ghi, giữ để test và hồ sơ cũ không vỡ; hành vi của chúng giữ như hiện nay, chỉ nằm dưới `allocated_tr`;
4. tổng ngân sách hồ sơ (`profile.budget`, triệu) × tỷ lệ `BUDGET_TEMPLATE` của hạng mục;
5. mặc định: chat dùng `DEFAULT_BUDGET_VND`; tab không có ngân sách hạng mục (điểm ngân sách trung tính 0,5), như hiện nay.

Tầng 4 và 5 **giữ nguyên từng chữ hành vi hiện nay** của mỗi bề mặt, kể cả điểm lệch đã có: hạng mục `honeymoon` có tỷ lệ 0% (chat: tổng × 5% do `|| 0.05`; tab: ngân sách 0 → điểm trung tính 0,5). Không sửa trong việc này.

**H2. Chat.** Ngân sách hạng mục tìm được theo H1 là `budget_for_category` (VND). Nới ×1,2 chỉ ở bước lọc cứng khi ít hơn 5 vendor qua lọc (như T-140); chấm điểm (`computeMatches`) và mọi chỗ khác dùng ngân sách hạng mục **gốc chưa nới** (inv-041). Đổi `allocated_tr` trong bảng → lượt chat ghép kế tiếp lọc theo số mới.

**H3. Thế nào là "đã phân bổ".** `allocated_tr` đọc bằng `Number(x)`; chỉ khi kết quả là số hữu hạn > 0 mới là "đã phân bổ" cho hạng mục đó. Mọi trường hợp khác là **chưa phân bổ** và rơi xuống tầng 3: `allocated_tr` = 0, âm, null, chuỗi không phải số, thiếu hạng mục trong bảng, không có bảng.
- `allocated_tr = 0` nghĩa là **"chưa phân bổ"**, không phải "không chi cho hạng mục này". Lý do: UI không phân biệt hai ý này (hạng mục mới tạo và `honeymoon` mới khởi tạo đều là 0, trạng thái `chua_phan_bo`); coi 0 là "không chi" sẽ lọc sạch mọi vendor của hạng mục. Hệ quả chấp nhận: cặp đôi thật sự không chi cho hạng mục đó vẫn thấy gợi ý theo tổng × tỷ lệ khi họ hỏi hạng mục đó.
- Bảng **không** được "điền sẵn" cho hạng mục thiếu hoặc khi chưa có bảng (khác GET `/budget`, vốn điền `round(tổng × pct)`): hạng mục thiếu dùng tổng × tỷ lệ chính xác (không làm tròn tới triệu).

**H4. Số được dùng = số bảng đang hiển thị.** Với hạng mục có trong bảng, giá trị dùng bằng đúng `allocated_tr` mà GET `/api/couples/:id/budget` trả cho hạng mục đó, tức đã co giãn theo `profile.budget` khi tổng lưu trong bảng lệch tổng hồ sơ (cùng luật `scale = profile.budget / total_tr` làm tròn từng hạng mục; chỉ co giãn khi cả hai tổng > 0). Giá trị sau co giãn bằng 0 là "chưa phân bổ" (H3).

**H5. Tab Vendor.** `GET /api/vendors/match` và `GET /api/vendors/:id` (màn chi tiết, cùng hàm chấm điểm) dùng ngân sách hạng mục theo H1 (bỏ tầng 1) làm ngân sách của hạng mục khi chấm điểm ngân sách (`computeMatches`) và khi sinh câu "vì sao" (câu giải thích AI lưu theo hash hồ sơ, nên đổi phân bổ thì câu được sinh lại). Tab **không nới** ×1,2 và không loại vendor vì ngân sách; điểm ngân sách giữ công thức hiện có (vượt ≤ 20% giảm tuyến tính, vượt > 20% bằng 0). Hình dạng phản hồi HTTP không đổi. Request không phải ghép/chi tiết (`/categories`, `POST /status`, trang có `coupleId` khác) không đọc bảng.

**H6. Map hạng mục ↔ category vendor.** Nguồn duy nhất: `BUDGET_TO_VENDOR_CATEGORIES` (lib/budgetCategories.js), hướng tra: category vendor → đúng một id hạng mục.
| Hạng mục (id) | Category vendor |
| --- | --- |
| venue, ceremony, photography, jewelry, attire, decor, makeup, transport, stationery, honeymoon | cùng tên (một-một) |
| reserve (Dự phòng phát sinh) | không có vendor: không bao giờ làm ngân sách của hạng mục nào; số của nó bị bỏ qua |
| hạng mục người dùng tự thêm (id không có trong `BUDGET_TEMPLATE`, vd `c1700000`) | không có vendor: bị bỏ qua, không ném |
Luật: mỗi hạng mục map tới tối đa **một** category (một số `allocated_tr` không được chia cho nhiều category); mỗi category vendor (CATEGORIES trừ `all`, và mọi category có trong pool) có đúng **một** hạng mục map tới. Không có hạng mục map một-nhiều hay vendor-không-hạng-mục hôm nay. Thêm hạng mục mới vào `BUDGET_TEMPLATE` mà chưa khai báo trong map → eval 5 đỏ; muốn hạng mục mới không có vendor thì phải sửa danh sách `NO_VENDOR_OK` trong eval 5 kèm quyết định (đổi spec).
- `honeymoon`: có vendor, tỷ lệ mẫu 0%; khi người dùng phân bổ > 0 (UI rút số đó từ `reserve`) thì dùng số đó như mọi hạng mục khác; chưa phân bổ thì giữ hành vi cũ ở H1 tầng 4. Chat hiện không có ý định ghép cho trăng mật (không đổi).
- `reserve`: số của nó (kể cả lớn) không ảnh hưởng ghép vendor; không có đường nào vay từ reserve để nới ngân sách hạng mục.

**H7. Nguồn đọc, chi phí, lỗi.** Bảng đọc lúc chạy từ R2 qua store hiện có, key `data/couples/<coupleId>/budget.json` (cùng nơi `api/budget.js` ghi), **không cache** (đổi phân bổ có hiệu lực ngay lượt sau). Đúng **một** lần đọc R2 thêm cho mỗi request ghép: mỗi lượt chat có ý định ghép vendor mà tin không có số tiền (tin có số tiền: 0 hoặc 1 lần đọc đều được), mỗi `GET /api/vendors/match`, mỗi `GET /api/vendors/:id` có `coupleId`; **không** đọc ở lượt chat không ghép và các route vendor khác. Không gọi mạng nào khác, không gọi LLM thêm. Không đọc bảng khi đã có `coupleId` không hợp lệ/không có quyền (tab giữ hành vi hiện có). Đọc lỗi (R2 ném, JSON hỏng, bảng không phải đối tượng, `categories` không phải mảng, phần tử rác) → coi như không có bảng, rơi về H1 tầng 3 trở xuống, **không ném, không đổi mã HTTP, không log lỗi ra người dùng**; đường chat vẫn thỏa inv-040 (không ném).

**H8. Không đổi.** Khi không có bảng dự toán (hoặc mọi hạng mục chưa phân bổ): kết quả chat và tab y hệt trước T-159 (eval T-140 check 7, T-143 adv-01, inv-037..041 vẫn xanh). `GET/PUT /api/couples/:id/budget`, schema `budget.json`, `useBudget.js` và giao diện không đổi.

## Ràng buộc (vòi)
- Repo: `tohong-back` (chỉ back; front không đổi) · Nhánh: `t-159-ghep-vendor-theo-bang-du-toan` · Vùng (`area`): `planner/vendor/images`
- Bất biến đã đọc: `eval/invariants/_shared/`, `eval/invariants/planner/` (inv-001..007, front/admin không liên quan), `eval/invariants/planner/vendor/images/` inv-037..041. Spec này không vi phạm INV-037 (không mạng, vẫn có ứng viên), INV-038 (đúng pool + overlay), INV-039 (R8 sau MMR), INV-040 (không ném; H7 nêu rõ), INV-041 (H2). Không đề nghị đổi bất biến nào.
- Kiến trúc: dùng `makeStore`/`fileStore.js` hiện có; chat đã giữ `store` trong `contextBuilder`. Đọc bảng phải là một hàm thuần dùng chung hai đường để H4 không lệch giữa chat và tab (gợi ý, không bắt buộc cấu trúc).
- Không chạm: schema `budget.json`, route `/budget`, payment, auth, dữ liệu cá nhân mới, vendor, cam kết giá; không migration.
- Bậc đề xuất: B (logic nghiệp vụ, đọc dữ liệu người dùng có sẵn nhưng không ghi, không schema, đảo ngược bằng revert).

## Tiêu chí chấp nhận và eval
Chạy từ gốc `tohong-hq`; biến `TOHONG_BACK_REPO` (mặc định `/home/user/tohong-back`). Trạng thái hiện tại (chưa có code): 1, 3, 4, 5, 6, 7 đỏ; 2 và 8 xanh (là hàng rào chống hồi quy).
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Chat: hạng mục có `allocated_tr` > 0 thì lọc theo đúng số đó (triệu→VND, thập phân giữ nguyên), đổi phân bổ đổi kết quả; thứ tự tin nhắn > allocated > trường cũ > tổng×tỷ lệ | `bash eval/T-159/check_1_chat_dung_allocated.sh` |
| 2 | Chat: hạng mục chưa phân bổ (0, âm, null, chữ, thiếu, không bảng, bảng hỏng, reserve, hạng mục tự thêm) dùng tổng × tỷ lệ rồi mặc định như cũ | `bash eval/T-159/check_2_chua_phan_bo_nhu_cu.sh` |
| 3 | Chat: nới ×1,2 chỉ ở lọc, chấm điểm bằng ngân sách `allocated_tr` gốc; đủ 5 vendor thì không nới | `bash eval/T-159/check_3_chat_cham_diem_goc_noi_chi_o_loc.sh` |
| 4 | Tab (`/match`, `/:id`): chấm theo `allocated_tr` > 0, đổi phân bổ đổi điểm, không nới, không loại vendor; chưa phân bổ như cũ; trăng mật như cũ | `bash eval/T-159/check_4_tab_dung_allocated_khong_noi.sh` |
| 5 | Map hạng mục ↔ category đủ, một-một, mỗi category vendor đúng một hạng mục; hạng mục mới chưa map thì đỏ; mỗi category vendor ăn đúng hạng mục của nó | `bash eval/T-159/check_5_map_hang_muc_vendor.sh` |
| 6 | Số dùng = số GET `/budget` trả (co giãn theo tổng hồ sơ); hạng mục thiếu không bị điền sẵn/làm tròn | `bash eval/T-159/check_6_nguon_bang_dung_so_nguoi_dung_thay.sh` |
| 7 | Bảng lỗi/thiếu/R2 ném thì rơi về cách cũ không ném (chat và tab); đúng một lần đọc mỗi request ghép, không đọc ở request khác | `bash eval/T-159/check_7_bang_loi_khong_nem_va_chi_phi_doc.sh` |
| 8 | inv-037..041 xanh; không có bảng thì chat/tab y nguyên (T-140 check 7, T-143 adv-01) | `bash eval/T-159/check_8_inv_con_xanh_va_khong_bang_nhu_cu.sh` |

Eval dùng pool đông cứng `eval/T-140/fixtures/pool-frozen.json` và R2 giả trong bộ nhớ (`test/helpers/memoryBucket.js`), không mạng, không Google, không ghi vào repo back.

## Bất biến đề xuất (tầng 2)
Vùng `planner/vendor/images` (hoặc `planner/vendor/matching` nếu Spec critic thấy hợp hơn):
- **INV-G · map hạng mục ↔ category vendor luôn đủ và một-một**: nội dung `eval/T-159/check_5_map_hang_muc_vendor.mjs` (phần tĩnh + động). Sinh ra vì spec này làm cho mọi hạng mục `BUDGET_TEMPLATE` thành nguồn ngân sách; hạng mục mới quên map sẽ lặng lẽ không có hiệu lực.
- **INV-H · allocated_tr > 0 là nguồn ngân sách hạng mục của cả chat và tab, đọc lỗi không ném**: gộp phần cốt lõi của check 1 (một ca chat), check 4 (một ca tab), check 7 (bảng hỏng không ném). Giữ cho các việc sau (ví dụ đổi engine ghép) không bỏ rơi phân bổ của cặp đôi.
Cả hai chạy được không đối số, in `PASS`/`FAIL`.

## Không làm
- Không ghi `budget_breakdown`/`budget_by_category` vào hồ sơ; không đổi schema hay route `/budget`; không đổi UI bảng dự toán hay tab Vendor.
- Không sửa điểm lệch honeymoon (tỷ lệ 0% → chat 5%, tab trung tính); không đổi cách đọc số tiền trong tin nhắn; không đổi công thức `budgetScore`, trọng số, MMR, R8.
- Không dùng `reserve` làm nguồn nới ngân sách; không tính tổng các hạng mục con (`items`, `estimated_tr`) làm ngân sách; không đổi hạng mục tự thêm thành category vendor.
- Không cache bảng; không gọi mạng/LLM thêm; không chạm vendor, giá, cam kết với vendor.

## Câu hỏi mở
Không. (Giả định đã chốt kèm lý do: `allocated_tr = 0` là "chưa phân bổ", H3. Nếu Capu muốn "0 = không chi, không gợi ý hạng mục này" thì đổi spec, đổi eval 2 và 4.)
