# T-200 · Adversary kiểm mẫu quyết định Maps (trước khi ghi review)

Ngày: 2026-11-17 · Người kiểm: adversary · Nguồn: `rows.json`, `maps.jsonl`, `decisions.json`, `apply.cjs`, `applied.jsonl` trong scratchpad enrich của Insight; báo cáo `insights/2026-11-17-T-200-cap-nhat-vendor-theo-maps.md`. Mở lại Maps (chỉ đọc, Playwright, nghỉ ≥3 giây) cho 7 hàng nghi ngờ. Không gọi endpoint admin nào, không PUT, không chạy `apply.cjs`. Không chép SĐT hay email.

Eval chạy được: `eval/T-200/adv-01-quyet-dinh-cap-nhat.py` (đang RED: A 3, B 3, C 9, D 3, E, F, G).

## Kết luận

**Làm lại phần quyết định (redo), không chấp nhận nguyên trạng, không chấp nhận chỉ với danh sách loại trừ.**

- Lớp "tên hơi giống" (123 hàng, không phải 92) sai quá nhiều để vá bằng danh sách loại trừ: mẫu ngẫu nhiên 9/14 sai, 1/14 nghi ngờ. Rà cả 123 hàng trên giấy: khoảng 43 sai rõ, khoảng 30 nghi ngờ. **Chặn cả lớp này.**
- Lớp "tên giống, địa chỉ lệch" (188 hàng, không phải 219) phần lớn đúng: mẫu 1/12 sai, 3/12 nghi ngờ (chuỗi nhiều chi nhánh). Rà cả 188 hàng: khoảng 14 sai rõ. Chấp nhận được **sau khi** loại các hàng ở mục "Loại trừ bắt buộc" và vá các lỗ của luật.
- "Tên khác hẳn" là lớp bảo thủ: 2/10 bỏ sót (false negative) nhưng không gây hại.
- "Tỉnh khác HCM" 6/6 giữ lại đúng. Luật này **có lỗ**: sau sáp nhập 7/2025, Maps ghi "Hồ Chí Minh" cho cả Bình Dương và Bà Rịa-Vũng Tàu cũ. Có 9 hàng CẬP NHẬT lọt qua vì vậy, thêm 1 hàng ở Hà Nội lọt qua vì địa chỉ Maps rỗng.
- "Khớp sẵn": 4/4 đúng.

Lưu ý số đếm: Chief ghi 92 "hơi giống" và 219 "giống, lệch". `decisions.json` cho 123 và 188 (tổng vẫn 311). Số đúng là 123 và 188.

## Tỷ lệ lỗi theo tầng mẫu

| Tầng | Cỡ lớp | Mẫu | Đúng | Sai | Nghi ngờ | Tỷ lệ sai (mẫu) |
|---|---|---|---|---|---|---|
| CẬP NHẬT · tên hơi giống | 123 | 14 | 4 | 9 | 1 | 64% (71% nếu tính nghi ngờ) |
| CẬP NHẬT · tên giống, địa chỉ lệch | 188 | 12 | 8 | 1 | 3 | 8% (33% nếu tính nghi ngờ) |
| TÊN KHÁC HẲN (tìm false negative) | 378 | 10 | 8 | 2 FN | 0 | 20% bỏ sót, vô hại |
| TỈNH KHÁC HCM | 46 | 6 | 6 | 0 | 0 | 0% |
| KHỚP SẴN | 27 | 4 | 4 | 0 | 0 | 0% |
| Mẫu có chủ đích (do eval A/B bắt) | – | 6 | 0 | 6 | 0 | – |
| **Tổng** | | **52** | | | | |

Mẫu ngẫu nhiên lấy với seed 200, chia theo tầng. "Nghi ngờ" nghĩa là cùng thương hiệu nhưng khác chi nhánh, hoặc tên chung, không đủ bằng chứng là cùng cơ sở.

## Bảng mẫu

| vendor id | Quyết định | Phán | Lý do (tên/địa chỉ marry so với Maps) |
|---|---|---|---|
| marry_34c9ef1ab79c | CẬP NHẬT · hơi giống | Đúng | Angel Áo cưới ↔ Áo cưới Angel; cùng số 300/27 Đội Cung |
| marry_0d345f4f1bfc | CẬP NHẬT · hơi giống | Đúng | Châu Âu Luxury, cùng tên công ty, cùng Bình Thạnh |
| marry_f867e5bb6a4c | CẬP NHẬT · hơi giống | **Sai** | VERA Studio (chụp ảnh) ↔ Vera Group; mở lại Maps: loại "Công ty đầu tư" |
| marry_6f379f36cf0d | CẬP NHẬT · hơi giống | **Sai** | Hộp Quà Việt (Bình Tân) ↔ Công Ty Quà Việt (Phổ Quang); tên chung, place này nằm ở đúng địa chỉ của vendor khác (Quà Xinh Shop) |
| marry_5fb18b1db188 | CẬP NHẬT · hơi giống | **Sai** | "Thiệp Sài Gòn" ↔ THIỆP CƯỚI SÀI GÒN; tên chung chung, khác số nhà, không có dấu hiệu cùng cơ sở |
| marry_6920b64d9fab | CẬP NHẬT · hơi giống | Đúng | Khách sạn Đệ Nhất, cùng đường Hoàng Việt |
| marry_ed3470998e8b | CẬP NHẬT · hơi giống | Đúng | Nhi Dip Bridal ↔ NHI DIP ATELIER, cùng thương hiệu |
| marry_9cf46ad5c263 | CẬP NHẬT · hơi giống | Nghi ngờ | Ivan Photography (Phú Nhuận) ↔ IVan wedding studio (Tân Phú); có thể không cùng cơ sở |
| marry_8a42325f3309 | CẬP NHẬT · hơi giống | **Sai** | Tên vendor là "TRANG SỨC CƯỚI" (chung chung) ↔ Trang Sức PA |
| marry_519c57e99ff1 | CẬP NHẬT · hơi giống | **Sai** | "công ty bảo ngọc" (Tân Bình) ↔ Cty TNHH Bảo Ngọc ở Long Hương (Bà Rịa cũ); tên chung, khác tỉnh cũ |
| marry_731197b3cd29 | CẬP NHẬT · hơi giống | **Sai** | "khanh" ↔ "An Khánh"; Maps không có địa chỉ |
| marry_1296bba6aaec | CẬP NHẬT · hơi giống | **Sai** | Tên mô tả dịch vụ ↔ một tiệm mâm quả ở Long Trường; không có tên riêng |
| marry_20c439a5ba07 | CẬP NHẬT · hơi giống | **Sai** | Đại Dương (18A Phan Văn Trị, Gò Vấp) ↔ nhà hàng Đại Dương, chỉ có plus code ở Tân Hiệp (mở lại Maps) |
| marry_be2e8bf08ebf | CẬP NHẬT · hơi giống | **Sai** | Thiệp Cưới Cherry ↔ CHERRY WEDDING STUDIO; Maps xếp loại "Trung tâm thông tin cho khách", khác quận |
| marry_f9fa3ba2636d | CẬP NHẬT · giống, lệch | Đúng | Trang trí Thảo Nguyên, Q6 → Bình Phú (cùng khu vực) |
| marry_9c10495f48eb | CẬP NHẬT · giống, lệch | Nghi ngờ | Nhị Gia (honeymoon) ↔ CTCP ĐT TM DV Nhị Gia; độ giống của matcher 0.24, không chắc cùng ngành |
| marry_76a63f87ed03 | CẬP NHẬT · giống, lệch | **Sai** | NTK MINH TUAN Nguyen (Q5) ↔ "MINH TUAN" ở Gò Vấp; khớp chuỗi con trên một tên người phổ biến |
| marry_ff5436fb350c | CẬP NHẬT · giống, lệch | Đúng | Cùng số 38 đường 77; "lệch" chỉ do đổi tên phường (vô hại) |
| marry_6d9c8636de49 | CẬP NHẬT · giống, lệch | Nghi ngờ | NHÀ HÀNG HOÀNG TY Bình Tân ↔ Hoàng Ty ở Võ Văn Tần Q3: chuỗi nhiều chi nhánh; với venue, đổi sang chi nhánh khác là sai |
| marry_bdc869daed80 | CẬP NHẬT · giống, lệch | Đúng | Flower Corner, đã chuyển địa chỉ |
| marry_0d9e3d48349b | CẬP NHẬT · giống, lệch | Đúng | Phạm Hiền, cùng số 57 đường 35 |
| marry_be9faf8448e5 | CẬP NHẬT · giống, lệch | Đúng | MABOO Studio, cùng thương hiệu, đã chuyển |
| marry_0050d6b64f35 | CẬP NHẬT · giống, lệch | Đúng | Áo cưới Paris, cùng số 145 đường 20 |
| marry_f8401af718cb | CẬP NHẬT · giống, lệch | Đúng | Thế giới trang sức (TSJ), cùng đường Trần Hưng Đạo |
| marry_09ce1e407efb | CẬP NHẬT · giống, lệch | Nghi ngờ | Mailisa Q3 ↔ Mailisa Gò Vấp: chuỗi, có thể là chi nhánh khác |
| marry_4939cb86145f | CẬP NHẬT · giống, lệch | Đúng | Hoa khô Iris, đã chuyển |
| marry_7ff0601693fc | TÊN KHÁC HẲN | Đúng | Sacoland ↔ COSACO |
| marry_c2ef83c22960 | TÊN KHÁC HẲN | **FN** | Buffalo Tours Agency ↔ Vietnam Buffalo Tours: cùng thương hiệu; trượt ngưỡng 0,666 < 0,67 |
| marry_a12073e6b34e | TÊN KHÁC HẲN | Đúng | Max Nguyen ↔ Phuong Nguyen |
| marry_40d8aad22865 | TÊN KHÁC HẲN | Đúng | Chinamay ↔ Chinese Mart 168 |
| marry_7eefb718ab2d | TÊN KHÁC HẲN | Đúng | Thuê Xe Sài Gòn Net ↔ cho thuê xe máy |
| marry_01f9ec664d3f | TÊN KHÁC HẲN | Đúng | TK Shop ↔ TỈN KIDS |
| marry_d75cc7b15bb2 | TÊN KHÁC HẲN | Đúng | Acaramia ↔ Thiệp cưới Lá |
| marry_893b821db892 | TÊN KHÁC HẲN | **FN** | KPrint ↔ In nhanh K-Print, **cùng 449/3 Sư Vạn Hạnh** (tách "K-Print" thành "k print") |
| marry_00a2e0014bb9 | TÊN KHÁC HẲN | Đúng | Floralista ↔ Silis Flower |
| marry_5888f617ef8e | TÊN KHÁC HẲN | Đúng | Xe cưới Trần Thế ↔ Mr.Vũ |
| marry_08b19775c6a6 | TỈNH KHÁC | Đúng (giữ) | IN THIỆP XINH Q10 ↔ Thiệp Xinh Hà Nội |
| marry_efb79a24f104 | TỈNH KHÁC | Đúng (giữ) | Flower Talk ↔ cửa hàng ở Georgia, Hoa Kỳ |
| marry_9713df01bc7d | TỈNH KHÁC | Đúng (giữ) | Tomei Tân Phú ↔ nhà máy Amata, Đồng Nai |
| marry_5af3bdcfd7e8 | TỈNH KHÁC | Đúng (giữ) | The Bridal Moment ↔ cửa hàng ở Singapore |
| marry_85fbc2bbc69f | TỈNH KHÁC | Đúng (giữ) | The Bridal Room ↔ cửa hàng ở Virginia, Hoa Kỳ |
| marry_4ee412eedc0c | TỈNH KHÁC | Đúng (giữ) | Emperor Cruises Q1 ↔ chi nhánh Nha Trang |
| marry_e5195afa3d09 | KHỚP SẴN | Đúng | Hý Bridal, cùng 281/13 Lê Văn Sỹ |
| marry_f7a78b786c97 | KHỚP SẴN | Đúng | Kami Anna, cùng 328A Nguyễn Sơn |
| marry_9248085ec553 | KHỚP SẴN | Đúng | Mốc Nguyễn Productions, cùng địa chỉ |
| marry_f28a16ece776 | KHỚP SẴN | Đúng | Will Love, cùng 215e4 Nguyễn Văn Hưởng |
| marry_93eb021e6491 | CẬP NHẬT · hơi giống | **Sai** | Dịch vụ cưới Ngọc Hằng ↔ Nhà hàng Ngọc **Trâm**; place này đã là của vendor full khác (eval A) |
| marry_d7737049911e | CẬP NHẬT · hơi giống | **Sai** | Áo dài Thảo **Vi** ↔ Thảo **Nguyên** Wedding; place đã là của vendor full khác (eval A) |
| marry_03ec553b9d5f | CẬP NHẬT · hơi giống | **Sai** | Thiệp Cưới Phúc An ↔ Nhà hàng Phúc An Khang; place đã là của vendor full khác (eval A) |
| marry_539ab2bcafd7 | CẬP NHẬT · hơi giống | **Sai** | Hoa Tuyết Nhiệt đới ↔ quán trà sữa (mở lại Maps: loại "Trà trân châu") |
| marry_592995d44c9f | CẬP NHẬT · giống, lệch | **Sai** | Thiên Tâm ↔ Thiền Tâm, nhà hàng chay (mở lại Maps); bỏ dấu làm hai tên trùng nhau |
| marry_4e55573d1ede | CẬP NHẬT · giống, lệch | **Sai** | THANH BẢO Q4 ↔ "P. Thanh Bảo", không có địa chỉ; place_id thuộc vùng Hà Nội, lọt luật tỉnh vì địa chỉ rỗng (eval B) |

## Loại trừ bắt buộc (dù làm lại theo cách nào)

1. **Eval A**: place_id của vendor full khác: marry_93eb021e6491, marry_d7737049911e, marry_03ec553b9d5f.
2. **Eval B**: Maps không có địa chỉ: marry_731197b3cd29, marry_4e55573d1ede, marry_3602b3130d1a.
3. **Eval C**: Maps ở Bình Dương hoặc Bà Rịa-Vũng Tàu cũ: marry_533f94f2e3a6 (Eden Plaza → Thuận Giao, venue), marry_d8fc3249b1d8, marry_8cd8ba7af7b4, marry_064945310cb7, marry_946e3434221d, marry_e6ac27ed220e, marry_7bf30963d4b2, marry_519c57e99ff1, marry_c84b93099d30. Các hàng cần xem tay vì địa danh mơ hồ: marry_a3fde388ddcb, marry_1a828b2beefd, marry_4473b3789318, marry_20c439a5ba07.
4. **Eval D**: nhiều vendor khác nhau cùng nhận một place: marry_aebb8c780604, marry_764efa6c15b7, marry_cba0811072c7 (ba dịch vụ bưng quả cùng về một tiệm); marry_dde837b453a0 (Nghệ Thuật Cưới ↔ Công Nghệ Cưới); marry_d4c29ea84bd7 (Độc Lạ ↔ Độc Đáo).
5. Venue thuộc chuỗi bị đổi sang chi nhánh khác: marry_6d9c8636de49 (Hoàng Ty), marry_a84d73bc78b2 (The Adora 198 Hoàng Văn Thụ → Adora Nguyễn Kiệm). Cần xem tay: marry_ae22b3a8f79b (Grand Palace → Mạc Đĩnh Chi).
6. Sai rõ trong lớp "giống", ngoài các hàng trên: marry_76a63f87ed03, marry_405f1ddd893f (Phương Flower → **Bốn** Phương Flower), marry_5f5dd0006968, marry_c34f73a04b85, marry_d48874283918, marry_19e0eb833c3e (Tổng cục du lịch Thái Lan → "Du Lịch Thái Lan"), marry_446b7cb6ef1a (Hồ Sơn Wedding → Son wedding), marry_592995d44c9f.

## apply.cjs (đọc, không chạy)

| # | Vấn đề | Mức |
|---|---|---|
| 1 | Ghi nguyên tập `dec==='CẬP NHẬT'` của `decisions.json`: đúng 311 hàng, gồm cả các hàng sai ở trên. Không có allowlist, không có chế độ dry-run. | Chặn |
| 2 | **Đã xác nhận:** tập `done` lấy mọi id trong `applied.jsonl`, không xét `status`. 6 dòng 403 (b25635d69270, b92e8a86175d, 7e0c49db5e78, 32bd364757c4, 8a598c176efc, 6d9c8636de49) sẽ bị **bỏ qua** khi chạy lại. Cách sửa: chỉ tính dòng có `status===200` là đã xong, hoặc chuyển 6 dòng này sang file khác. | Cao |
| 3 | Không đọc lại hàng trước khi PUT. Luật "bỏ qua hàng có review/override" chỉ dựa vào ảnh chụp `rows.json` lúc 15:25; nếu hàng có review sau thời điểm đó, PUT sẽ ghi đè. | Cao |
| 4 | Hàng approvable gửi `{decision:'approve'}` không kèm `place_id`, nên server sẽ nhận ứng viên mà server đang giữ. Hiện ứng viên đó trùng place đã kiểm (`final_url` khớp `google.place_id` ở cả 311/311 hàng). Nếu matcher chạy lại trước khi ghi, server có thể approve một place khác với place đã kiểm. Nên luôn gửi `place_id`. | Trung bình |
| 5 | Ngưỡng dừng: dừng sau 6 lỗi liên tiếp (`errs>5`), bộ đếm về 0 sau mỗi lần 200. Lỗi xen kẽ thì không bao giờ dừng. Bước GET kiểm lại không tính "chưa thấy review" là lỗi. | Thấp |
| 6 | Không chặn cùng một `place_id` bị ghi cho nhiều vendor, kể cả place của hàng full. | Cao (eval A, D) |
| 7 | Script xác thực bằng token khách (`th_guest_token`) lấy từ trang công khai, và chỉ chạy được khi cờ ADMIN_OPEN bật. Đây là chạm ranh giới auth, quyết định bật cờ là của Capu. | Ghi nhận |
| 8 | `place_id` dùng đúng: lấy từ `rows[id].google.place_id`, khớp trang Maps đã đọc. Note chỉ chứa tên và địa chỉ Maps, không có SĐT. | Đạt |

## Luật bổ sung (2) "Maps ở tỉnh khác HCM thì không ghi"

- Giả định HCM đúng với dữ liệu này: 868/870 địa chỉ marry kết thúc bằng Hồ Chí Minh. Hai hàng còn lại ở Hà Nội (marry_7ddd0ad6ed87 Pandora, KHỚP SẴN; marry_bdaa092102a7 DOJI, TÊN KHÁC HẲN), không hàng nào bị ghi.
- Nhưng cách cài có ba lỗ:
  (a) Từ 7/2025 Maps ghi "Hồ Chí Minh" cho Bình Dương và Bà Rịa-Vũng Tàu cũ (Thủ Dầu Một, Dĩ An, Thuận Giao, Tân Khánh, Vũng Tàu, Long Hương…). 9 hàng lọt qua vì vậy, xem eval C.
  (b) Địa chỉ Maps rỗng thì luật coi là "không khác tỉnh". 3 hàng lọt qua, trong đó một hàng ở Hà Nội, xem eval B.
  (c) Luật chỉ bật khi địa chỉ marry có chữ HCM, nên vendor ở Hà Nội không được bảo vệ.
- Đề xuất: so khớp vùng của marry và Maps theo **địa giới trước sáp nhập** (danh sách phường/xã cũ, hoặc mã bưu chính 75/79/82xxxx). Coi địa chỉ Maps rỗng hoặc chỉ có plus code là "không xác nhận", không ghi. Giữ nguyên lớp 46 hàng "tỉnh khác" như hiện tại: 6/6 mẫu là cơ sở khác hẳn (Mỹ, Singapore, Hà Nội…), ghi vào là sai.

## Khác

- **SĐT trong báo cáo:** `insights/2026-11-17-T-200-cap-nhat-vendor-theo-maps.md` có 3 hàng mà địa chỉ marry dính SĐT và website (rác khi cào dữ liệu). Báo cáo ghi "không chép SĐT", nên điều này trái với chính báo cáo (eval G). Đây là số máy doanh nghiệp, không phải dữ liệu người dùng, nhưng phải xoá đi.
- Heuristic tên có hai lỗi gốc: bỏ dấu làm trùng các tên khác nhau (Thiên/Thiền, Đất/Đạt, Thủy/Thùy), và so tập từ nên không xét thứ tự từ (Anh Thủy ↔ Thùy Anh, Giang Nguyễn ↔ Nguyễn Giang). STOP còn chứa "cong", nên "Ngọc Huy" khớp "Công Huy".

## v3 (2026-11-17, sau handoff T-200-v3)

- Máy: adv-01 A-G PASS 7/7, adv-02 H-P PASS 9/9 (T200_ENRICH_DIR = scratchpad enrich, exit 0 cả hai). File eval không đổi.
- Diff allowlist v2 → v3: 160 → 133; -28 (13 cờ cứng: 8 hàng sai + 5 plus code, đều đã ra; 9 loại Maps ngoài lĩnh vực; 6 nghi vấn sang Capu), +1 (marry_34c9ef1ab79c Angel: cùng 300/27 Đội Cung, Maps "Studio nhiếp ảnh", đúng). Không hàng nào đổi place_id; không trùng place_id.
- 7 hàng "hơi giống" tự ghi (34c9ef1ab79c, 307ad7997ec3, 8ae5897ca010, bea9ab3d1195, 64c75b8f7958, 95d8ba0d9af5, a7faac51a257): cả 7 cùng số nhà và đường, loại Maps thuộc lĩnh vực cưới. Đúng 7/7.
- Mẫu mới: 25 hàng tự ghi ngẫu nhiên (seed 3317), loại trừ mọi id đã kiểm ở v1/v2 (`scratchpad/adv_sample.json` và các id ghi trong file này). Mở Maps chỉ đọc (Playwright, nghỉ 3-4,5 giây) cho 21 hàng nghi ngờ hoặc không có loại Maps. Kết quả: 22 đúng, 0 sai, 3 nghi ngờ:
  - marry_64d17055f76e La Petite Epicerie Saigon: trang Maps không có loại, không có website, không có đánh giá; Bình Thạnh → Long Bình (Thủ Đức cũ). Tên giống hệt và riêng biệt nhưng không xác nhận được là cùng cơ sở.
  - marry_2fbaeb858da9 MyMy Makeup: Q2 → Bàu Cát 7, Tân Bình; tên riêng nhưng phổ biến.
  - marry_6ea9dccba2f8 CuuLong Jewelry: quầy Vincom → cửa hàng 25 Trần Bình Trọng (cùng thương hiệu, khác điểm bán; không phải venue).
- 9 hàng tự ghi không có loại Maps: 5 khách sạn/venue (Bình Quới 2, Mai House, MerPerle, Silver Creek, cùng địa chỉ hoặc đường đổi tên; trang khách sạn không hiện nút loại), Pepi (cùng 15 Thống Nhất), HayDay Media (có website riêng), Áo Dài Duly, Chi Bridal: đúng hoặc chấp nhận được; La Petite Epicerie là nghi ngờ ở trên.
- Rà giấy 34 hàng có loại Maps lạ (Văn phòng công ty, sô cô la, tráng miệng, du lịch, bán buôn...): không thấy lớp sai có hệ thống; "stationery" của marry gồm cả quà cưới (sô cô la, tráng miệng), nên các loại này khớp.
- apply.cjs: chỉ dry-run (offline, exit 0, "sẽ PUT 133 hàng"); applied.jsonl, allowlist.json, decisions.json không đổi (md5). Thử 5 input phá trên bản sao: id Capu chèn tay, đổi place_id, trùng id/place_id, allowlist rỗng, dòng 200 có err trong applied.jsonl. Cả 5 bị chặn hoặc xử lý đúng.
- Không có SĐT/email trong allowlist.json, capu_quyet.json, báo cáo insight, handoff v3.
- Ước tính sai trong 133: 0 sai rõ; tối đa khoảng 1-3 hàng nghi ngờ (≤ 2,3%), không thành lớp có hệ thống. **Chấp nhận.**
