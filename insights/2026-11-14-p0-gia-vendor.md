---
type: insight
task: T-160
date: 2026-11-14
by: insight
adr: ADR-089
confidence: medium (kết luận về N2) / low (kết luận về N1, vì N1 không chạy được)
---
# P0 đường ống giá vendor: 30 vendor, N1 và N2

## Tóm tắt (đọc phần này là đủ)

1. **N1 (website vendor) không đo được trong phiên này.** Mạng phiên chặn mọi website vendor. Đây là lỗi môi trường, không phải số đo, nên **không được ghi N1 = 0%**. N1 ghi là "chưa đo được".
2. **N2 (tìm kiếm + bài bên thứ ba) ra giá cho 0/30 vendor** sau cổng 5 kiểm. Cận trên 95% cho tỉ lệ thật khi quan sát 0/30 là 11,6% (Clopper-Pearson), tức N2 chỉ qua WebSearch gần như chắc chắn dưới 15%. Hạn chế: WebFetch bị chặn nên N2 không đọc được bài gốc, chỉ có bản tóm tắt của công cụ tìm kiếm.
3. **Điều kiện dừng (N1+N2 < 15%) chưa kết luận được bằng số đo.** Nhưng có một giới hạn cấu trúc: chỉ **143/867 vendor (16,5%) có website thật**. Để N1 riêng nó đạt 15% pool, 92% vendor có website phải đăng giá. Đề xuất ở cuối.
4. Cổng 5 kiểm hiện có hai lỗ hổng: **kiểm 3 (khung giá) vô hiệu** vì dữ liệu giá tham chiếu trong pool bị nhiễm (P95 decor = 4,4e11 VND), và **kiểm 1 không thể chạy khi chỉ có tóm tắt tìm kiếm**.

## Cách chọn mẫu (chạy lại được)

- Pool: `/home/user/tohong-back/lib/vendorPool.generated.js` (867 vendor, tất cả id `marry_*`), ghép với `/home/user/tohong/tools/scraper/output/HCMC/*/vendors.json` theo `id` (867/867 khớp). Website = `contact.website`. "Giá thật" = có `price_range` trong vendors.json (221/867 = 25,5%). Phần còn lại trong pool mang `priceMin/priceMax` mặc định theo hạng mục (ví dụ 5-15, 8-25), không phải giá thật.
- Phân loại website: `facebook.com|fb.com|fb.me|instagram|zalo|tiktok` là "chỉ mạng xã hội". Toàn pool: **143 website thật, 20 chỉ link Facebook/MXH, 704 không có.**
- Seed `random.Random(160)`. Mỗi nhóm có hạn ngạch theo hạng mục, sắp theo id rồi rút ngẫu nhiên, ưu tiên vendor chưa có giá thật; thêm 3 vendor có giá cũ mỗi nhóm để đối chiếu (6 tổng).
  - Nhóm có web (15): venue 3, photography 2, stationery 2, attire 2, jewelry, decor, honeymoon, ceremony, transport, makeup mỗi hạng mục 1.
  - Nhóm không web (15): venue 2, photography 2, stationery 2, decor 2, makeup 2, ceremony, attire, jewelry, honeymoon, transport mỗi hạng mục 1.
  - Hạn ngạch hơi lệch khỏi phân phối pool vì "trải đều hạng mục": makeup chỉ có 1 vendor có web trong cả pool.
- Mẫu nhóm có web nghiêng về venue so với pool (55/143 venue có web) và nhóm này chiếm 50% mẫu nhưng chỉ 16,5% pool. Tỉ lệ trên mẫu **không** suy ra được cho pool.

## Số đo

### Tỉ lệ ra giá (sau cổng 5 kiểm)

| Nguồn | 15 có web | 15 không web | 30 vendor |
| --- | --- | --- | --- |
| N1 website vendor | chưa đo được (0/15 truy cập được) | không áp dụng | chưa đo được |
| N2 WebSearch | 0/15 | 0/15 | 0/30 (cận trên 95%: 11,6%) |
| N1+N2 | chưa đo được; cận dưới 0/30 | | |

Số lượt: 36 truy vấn WebSearch (30 vendor × truy vấn 1, thêm truy vấn 2 cho 6 vendor có tín hiệu: Hoàng Long, Victory, Tân Sơn Nhất, Hidden Mansions, Jolie Holie, Lynh Thùy). 0 bài được đọc nguyên văn.

### Vì sao N1 không chạy

- WebFetch `haydaymedia.vn`, `aodaihanh.com`, `quayphongsucuoi.vn`: `getaddrinfo ENOTFOUND` ("host nằm ngoài danh sách tên miền cho phép của phiên"). Theo hướng dẫn của công cụ tôi dừng sau 3 host, không thử thêm.
- Kiểm tra robots.txt bằng Bash cho 15 host: 8 host bị cổng 403 `CONNECT` (policy denial, ghi ở `/__agentproxy/status`), 7 host không phân giải được tên. Không host nào tải được. Không thử đường vòng.
- Cần: Capu cho phép 15 tên miền sau trong cấu hình mạng phiên, rồi chạy lại N1 (xem "Đề xuất"): idyatelier.vn, aodaihanh.com, lynhthuyplanner.com, liena.com.vn, tsttourist.com, winwinshop88.com, trungvostudios.com, haydaymedia.vn, linwedding.com, thiepcuoiforever.com, khungxinh.art, thuexegiatot.vn, nhahanghoanglong.com.vn, maihouse.com.vn, hiddenmansions.com.
- Hai host trong danh sách là tên miền không phân giải được từ bên ngoài phiên cũng có thể đã chết (ví dụ `lynhthuyplanner.com`, `linwedding.com`); chưa xác minh được vì không có DNS công khai.

### Tỉ lệ trượt từng kiểm

Chỉ có **9 con số ứng viên** xuất hiện trong kết quả tìm kiếm cho 30 vendor (số còn lại: không có con số nào gắn với vendor). Tôi chấm 9 số này theo từng kiểm. Mẫu rất nhỏ, đọc như minh hoạ chứ không phải ước lượng tỉ lệ.

| Kiểm | Trượt / 9 | Ghi chú |
| --- | --- | --- |
| 1 trích dẫn khớp chuỗi trang đã tải | 9/9 (không kiểm được) | Không có trang nào tải được. Quote chỉ nằm trong bản tóm tắt của WebSearch. Tôi coi "không kiểm được" là trượt. |
| 2 đúng vendor | 8/9 | Chỉ Hoàng Long (Foody) gần khớp (tên + 2 Lê Duẩn Q1), vẫn yếu vì pool trỏ `nhahanghoanglong.com.vn` còn Foody liệt kê "Hoàng Long 3" với tên miền `tieccuoihoanglong.com.vn`, chưa chứng minh cùng cơ sở. 8 số còn lại là giá của vendor khác hoặc sản phẩm khác (xem dưới). |
| 3 khung P5÷3..P95×3 | 2/9 | Chỉ trượt giá thấp bất thường (buffet 190k/người, makeup đi tiệc 300k). Xem "Kiểm 3 vô hiệu". |
| 4 đúng đơn vị | 5/9 | Phòng/đêm, buffet/người, nệm, khoảng giá không rõ bàn hay người (Hoàng Long), makeup đi tiệc. |
| 5 còn mới (≤180 ngày) | 2/9 chắc chắn cũ, 7/9 không có ngày | Menu Majestic PDF đường dẫn `2024/07` (cũ ~28 tháng), khuyến mãi Liên Á cũ. Còn lại không xác định ngày; theo chữ của luật "nếu xác định được ngày" thì qua, nhưng tôi không coi là bằng chứng. |

Chín con số: Hoàng Long 2,5-4,4 triệu (đơn vị không rõ); Majestic 9,6 triệu/bàn (khi tìm Mai House, sai vendor); Hidden Mansions 1.035.000 phòng/đêm (sai sản phẩm); Liên Á nệm 3,84-10,92 triệu (sai ngành); Victory buffet 190-200k/người (sai sản phẩm); Bonnie Makeup 3,5-6 triệu (sai vendor, khi tìm Hý Bridal); Aloha Studio 7,88 triệu (sai vendor, khi tìm JS FOTO); Mai Wedding Đà Nẵng 5,2 triệu (sai vendor và sai tỉnh, khi tìm LYN Wedding); makeup đi tiệc 300k (đánh giá người dùng, sai vendor).

Bài học: **5/9 con số tìm thấy là giá của vendor khác với cùng từ khoá hạng mục.** Nếu bỏ kiểm 2, đường ống sẽ nạp giá sai cho vendor.

### Kiểm 3 vô hiệu (quan trọng cho P1)

Tính từ 221 giá thật trong pool (`price_range`, lấy trung điểm min/max, theo hạng mục và đơn vị), khung `P5÷3 .. P95×3`:

| Hạng mục (đơn vị) | n | P5 (VND) | P95 (VND) | Khung |
| --- | --- | --- | --- | --- |
| venue (per_table) | 53 | 2.000.000 | 100.000.000 | 0,67 triệu .. 300 triệu mỗi bàn |
| decor (package) | 30 | 554.500 | 440.406.400.272 | 0,18 triệu .. 1,3e12 |
| photography (package) | 32 | 1.000.000 | 209.214.175 | 0,33 triệu .. 628 triệu |
| makeup (package) | 29 | 4.099.800 | 360.780.430 | 1,37 triệu .. 1,08 tỉ |
| stationery (package) | 22 | 2.500 | 490.000.000 | 833 VND .. 1,47 tỉ |

Khung này rộng đến mức vô nghĩa: P95 decor là 440 tỉ VND và P5 stationery là 2.500 VND, tức dữ liệu tham chiếu đã bị nhiễm bởi giá sai (mức 15.000 "package" của Thiệp cưới Forever là giá một thiệp; venue 100 triệu/bàn rõ ràng là giá cả sự kiện). Mọi giá từ ~1 triệu đến ~300 triệu qua kiểm 3 ở hầu hết hạng mục. Tệ hơn: tính "khung" từ pool là vòng lặp tự tham chiếu, vì chính giá scrape sai là đầu vào của khung.

### Chất lượng dữ liệu website trong pool (phát hiện phụ, ảnh hưởng N1)

Website của vendor đến từ bước enrichment Google Maps với `confidence` thấp: 5/15 website của nhóm có web có confidence < 0,8 (IDY 0,5; Liên Á 0,414; Win Win 0,429; HayDay 0,615; LYN 0,741). Ví dụ `LOVIDOVI – Chụp ảnh cưới ở Paris` (không nằm trong mẫu) được gán `lavenderstudio.vn` với confidence 0,5 và tên khớp "Lavender Studio". Hệ quả: dù N1 chạy được, kiểm 2 (đúng vendor) sẽ trượt đáng kể với website confidence thấp; N1 phải lọc theo confidence trước. Thêm vào đó: `TRUNG VO Studio` (nhiếp ảnh gia) nằm ở hạng mục makeup; `Nệm Liên Á` và `Nệm Sài Gòn` (xưởng nệm, đoán, tự tin 60%) nằm ở decor. Hạng mục trong pool không đáng tin ở một số vendor.

### Thời gian và chi phí

- Thời gian: khoảng 30 phút đồng hồ (ước tính), phần lớn là 36 truy vấn WebSearch và chờ.
- Chi phí ngoài token: **$0** (không Google Places, không dịch vụ trả phí). Không cần `task.py cost`.
- Chi phí token: hook tự ghi, số của hook là số đúng. Ước tính của tôi: khoảng 36 kết quả tìm kiếm × ~3k token đọc vào, tổng ngữ cảnh khoảng 150k token; cỡ **$1-3 token** (tự tin thấp). Mỗi vendor ≈ $0,04-0,10 token. Trần $2 áp dụng cho khoản ngoài token (ADR-089), nên không vượt.
- Chi phí mỗi vendor cho N2-search: 1-2 truy vấn, không ra giá. Chi phí mỗi giá hợp lệ: không xác định (0 giá).

## Bảng 30 vendor

Ký hiệu: web = website thật (conf = confidence enrichment); "-" = không có. N1 "BLOCK" = host bị chặn, không đo được. N2 "0" = không có giá riêng của vendor (đã chạy 1 truy vấn trừ khi ghi 2). Kiểm trượt: K1..K5.

| # | id | Tên | Hạng mục | Web (conf) | N1 | N2 | Trích dẫn / URL | Kiểm trượt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | marry_397a0fda8af0 | IDY Shoes | attire | idyatelier.vn (0,5) | BLOCK | 0 | Không có kết quả riêng của IDY Shoes | không có giá để kiểm |
| 2 | marry_9ce4d514cdca | Áo dài Hạnh | attire | aodaihanh.com (1,0) | BLOCK | 0 | Chỉ có "Áo dài Mỹ Hạnh" không địa chỉ, không giá | không có giá |
| 3 | marry_c09cd73df13e | Lynh Thùy Wedding Team | ceremony | lynhthuyplanner.com (1,0) | BLOCK | 0 (2 truy vấn) | Không có trang nào của vendor | không có giá |
| 4 | marry_a8277733eaef | Nệm Liên Á | decor | liena.com.vn (0,414) | BLOCK | 0 | Giá nệm "10.920.000 đ" (meta.vn, hàng dừng bán) là hàng khác | K2 K4 K5 |
| 5 | marry_48cb8b527494 | TST Tourist | honeymoon | tsttourist.com (1,0) | BLOCK | 0 | Không có kết quả riêng | không có giá |
| 6 | marry_d8ad8f8fd723 | Win Win Shop88 | jewelry | winwinshop88.com (0,429) | BLOCK | 0 | Không có kết quả riêng | không có giá |
| 7 | marry_34345968690c | TRUNG VO Studio | makeup (sai: là nhiếp ảnh gia) | trungvostudios.com (1,0) | BLOCK | 0 | Không có kết quả riêng | không có giá |
| 8 | marry_d7290a8429b6 | HayDay Media (có giá cũ 20 triệu/gói) | photography | haydaymedia.vn (0,615) | BLOCK | 0 | Không tìm thấy HayDay Media | không xác nhận được giá cũ |
| 9 | marry_63e4b58fbc42 | LYN Wedding | photography | linwedding.com (0,741) | BLOCK | 0 | Chỉ có "Mai Wedding" Đà Nẵng 5,2 triệu, vendor khác | K2 |
| 10 | marry_f99c545270d7 | Thiệp cưới Forever (có giá cũ 15.000/gói) | stationery | thiepcuoiforever.com (1,0) | BLOCK | 0 | toplist.vn liệt kê "thiepcuoiforever.com", không có giá | không xác nhận được; giá cũ nghi là giá/thiệp (K4) |
| 11 | marry_dfd0086a35aa | Khung Xinh - Nice Frames | stationery | khungxinh.art (1,0) | BLOCK | 0 | Không có kết quả riêng | không có giá |
| 12 | marry_db1b397c6543 | Công ty TNHH TM DV Nam Khôi | transport | thuexegiatot.vn (1,0) | BLOCK | 0 | mytour liệt kê "Nam Khoi Trading and Service", không giá | không có giá |
| 13 | marry_7e7e52545b79 | TT Hội Nghị - Tiệc Cưới Hoàng Long (giá cũ 3,19 triệu/bàn) | venue | nhahanghoanglong.com.vn (1,0) | BLOCK | ứng viên bị loại (2 truy vấn) | "2.500.000đ - 4.400.000đ" (Foody, 2 Lê Duẩn Q1), https://www.foody.vn/ho-chi-minh/hoang-long-le-duan, 2026-11-14; Foody ghi "không hoạt động mới hơn ba tháng" | K1 K2(yếu) K4 K5(không ngày). Khoảng giá có chứa 3,19 triệu cũ nhưng không chứng minh được. |
| 14 | marry_7e0c49db5e78 | Khách sạn Mai House Saigon | venue | maihouse.com.vn (1,0) | BLOCK | 0 | "VNĐ 9.600.000/bàn/10 khách" là của Majestic Saigon (majesticsaigon.com PDF 2024/07), không phải Mai House | K1 K2 K5 |
| 15 | marry_c526c6ff5908 | Hidden Mansions Saigon Resort | venue | hiddenmansions.com (1,0) | BLOCK | 0 (2 truy vấn) | "1.035.000 VND" là phòng/đêm (vietnambooking), không phải tiệc | K1 K4 |
| 16 | marry_02ee6ec7dfc5 | CHOU Bridal & Makeup | attire | - | không áp dụng | 0 | "ChouLe Makeup" khác tên, không giá | không có giá |
| 17 | marry_422d13c16d2a | Thanh Sang | ceremony | - | không áp dụng | 0 | Không có kết quả liên quan | không có giá |
| 18 | marry_1b43f1b53ae2 | Slow Florist | decor | - | không áp dụng | 0 | Chỉ "Slow Darling" Seattle | không có giá |
| 19 | marry_a611e7b4483b | Nệm Sài Gòn | decor | - | không áp dụng | 0 | Công ty nệm, không có giá trang trí | không có giá |
| 20 | marry_d1840d465c45 | Kỷ Nguyên Tourist | honeymoon | - | không áp dụng | 0 | Chỉ tour của đơn vị khác | không có giá |
| 21 | marry_d90dcc0c432c | Swarovski | jewelry | - | không áp dụng | 0 | Swarovski Việt Nam không có giá nhẫn cưới trong kết quả | không có giá |
| 22 | marry_c2e00a3e4b59 | JS FOTO (giá cũ 3 triệu/gói) | makeup | - | không áp dụng | 0 | Aloha Studio 7,88 triệu là vendor khác | K2 (với giá Aloha); giá cũ không xác nhận |
| 23 | marry_e5195afa3d09 | Hý Bridal | makeup | - | không áp dụng | 0 | Giá Bonnie Makeup 3,5-6 triệu là vendor khác | K2 |
| 24 | marry_acb7d31d070d | Jolie Holie (giá cũ 12,5-18 triệu/gói) | photography | - | không áp dụng | 0 (2 truy vấn) | Chỉ kết quả Mỹ/quốc tế cùng tên Jolie | không xác nhận giá cũ |
| 25 | marry_ec919a1c2724 | Áo cưới Giang Nguyễn | photography | - | không áp dụng | 0 | Chỉ "Áo cưới Nguyễn Giang" Hóc Môn, không giá | không có giá |
| 26 | marry_90708f68f8a7 | Quà Cưới Việt | stationery | - | không áp dụng | 0 | Chỉ bài ý tưởng quà cưới chung | không có giá |
| 27 | marry_98d310de0547 | FViet craft fan | stationery | - | không áp dụng | 0 | Không có giá của FViet | không có giá |
| 28 | marry_f7968722928f | Cho thuê xe Huy Hoàng | transport | - | không áp dụng | 0 | Huy Hoàng tìm thấy ở Hà Nội và Vũng Tàu, không phải TP.HCM | K2 |
| 29 | marry_dfe195d3f0f6 | Nhà hàng Khách sạn Victory Sài Gòn (giá cũ 2 triệu/bàn) | venue | - | không áp dụng | 0 (2 truy vấn) | Buffet "200k/người" (Foody) là sản phẩm khác | K4; giá cũ không xác nhận |
| 30 | marry_597d56365622 | Nhà hàng tiệc cưới Tân Sơn Nhất | venue | - | không áp dụng | 0 (2 truy vấn) | "bàn rẻ nhất 2tr" (bình luận Foody, không rõ địa chỉ) | K1 K2 K4 K5 |

6 vendor có giá cũ (8, 10, 13, 22, 24, 29): N2 không xác nhận cũng không bác bỏ ở 5/6; Hoàng Long là duy nhất có khoảng giá chứa giá cũ, nhưng không qua cổng.

## Kết luận theo điều kiện dừng

- Quy tắc: N1+N2 ra giá cho < 15% vendor thử thì không xây crawler, chuyển N3+N4.
- Số đo: N2 = 0/30. N1 = chưa đo. **Số đo hiện có không đủ để áp quy tắc dừng cho N1+N2.**
- Lập luận bù, không phải số đo: nếu giữ nguyên chiến lược "crawl website vendor", trần lý thuyết của N1 trên pool là 143/867 = 16,5% (cùng lúc mọi vendor có web đều có giá, điều này không xảy ra). Cần ≥ 92% website vendor có giá mới đạt 15%. Nhóm 20 vendor chỉ có Facebook thêm 2,3%, và chỉ xử lý được nếu được phép đọc Facebook (chưa có phép, ToS thường cấm).
- **Mức tự tin**: N2-search không đủ 15%: cao (~90%); N1 sẽ không đạt 15% pool: trung bình (~75%, dựa trên cấu trúc pool, không phải trên dữ liệu N1); kết luận chung "chuyển N3+N4": trung bình thấp (~65%) cho tới khi có số đo N1.

## Đề xuất cho P1/P2

1. **Quyết một việc cho Capu (rẻ nhất): có chạy lại N1 hay không.** Mở 15 tên miền ở trên trong mạng phiên, chạy lại chỉ phần N1 trên 15 vendor có web (WebFetch, không tốn ngoài token, ước tính ~$0,5 token). Nếu N1 ra giá cho ≥ 8/15 vendor có web qua cổng thì crawler theo website có ý nghĩa cho **venue và photography** (hai nhóm có nhiều web nhất); nếu < 4/15 thì chuyển N3+N4. Mặc định nếu không mở mạng: chuyển N3+N4.
2. **Nguồn đáng thử cho P1** (từ những gì xuất hiện thật): PDF menu tiệc cưới của khách sạn (Majestic, IHG) có giá theo bàn; trang danh sách toplist.vn/mytour.vn có bảng giá cho một số tiệm makeup (Bonnie, PhatDao); Foody có khoảng giá cho nhà hàng nhưng thiếu đơn vị. Các nguồn này giá tốt nhất cho venue và makeup, hiếm cho decor, honeymoon, stationery, ceremony.
3. **Siết kiểm 2**: bắt buộc khớp tên miền hoặc (tên + địa chỉ/quận), và vendor có website confidence < 0,8 thì bỏ khỏi N1 hoặc gắn cờ "cần xác minh".
4. **Sửa kiểm 3**: tham chiếu phải là giá đã làm sạch (bỏ giá dưới 10.000 VND hoặc trên 1e10, loại `unit` sai), hoặc dựa trên mốc cố định theo hạng mục do người đặt. Khung hiện tại không loại được gì.
5. **Siết kiểm 1 và kiểm 5**: quote chỉ tính khi từ trang đã tải; ngày không xác định được thì không qua với nguồn bên thứ ba (chỉ cho qua nếu đến từ domain chính thức của vendor).
6. **Siết kiểm 4**: bác bỏ khoảng giá không ghi đơn vị (Foody "2.500.000đ - 4.400.000đ").
7. Dọn dữ liệu trước P1: sửa hạng mục sai (TRUNG VO, Nệm Liên Á, Nệm Sài Gòn) và giá cũ nghi sai đơn vị (Thiệp cưới Forever 15.000/gói). Có thể xem `insights/2026-11-06-lech-gia-scrape-vs-pool.md` đã ghi lệch giá.

## Nên đo thêm

- Event hoặc báo cáo cho biết người dùng nhấp vào vendor không có giá thật (74,5% pool mang giá mặc định) để biết thiếu giá có gây mất chuyển đổi hay không. Hiện chưa đo, không có truy vấn PostHog nào trong báo cáo này.

## Ràng buộc đã tuân thủ

Không gọi Google Places hay API Google trả phí. Không liên hệ vendor. Không đăng hay gửi gì ra ngoài. Không ghi `vendors.json`, không sửa repo sản phẩm. Không chạy git trong tohong-hq. Không dùng đường vòng khi host bị chặn.

<details><summary>Lệnh đã dùng (chạy lại được)</summary>

- Ghép pool + scraper, đếm website: `python3 -I merge.py` (đọc `GENERATED_VENDOR_POOL` bằng `json.loads` phần mảng, ghép `id` với `tools/scraper/output/HCMC/*/vendors.json`).
- Chọn mẫu: `random.Random(160)`, hạn ngạch hạng mục như trên, ưu tiên `price_range` rỗng, thêm 3 vendor có giá mỗi nhóm.
- Khung giá: `P5, P95` bằng nội suy tuyến tính trên trung điểm `(min_vnd+max_vnd)/2` theo `(category, unit)`.
- Robots: `urllib.robotparser` trên 15 host (kết quả: 8 host 403 CONNECT, 7 host không phân giải).
- N2: 36 lệnh WebSearch với mẫu `<tên> <hạng mục> giá` và `<tên> bảng giá`.
- Kết quả trung gian nằm ở thư mục tạm của phiên, không đưa vào repo.
</details>
