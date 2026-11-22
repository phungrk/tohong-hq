# T-219: trích nguồn từ đề xuất của Capu (artifact PRAWcCf8L3ucY2t7XuCnLG)

Chief đọc artifact ngày 2026-11-22 và chép nguyên văn ba prompt cùng các số liệu chính. Product không đọc được artifact trong phiên của mình, nên dùng file này làm nguồn đối chiếu.

## Ba prompt (nguyên văn)
```
[1a — sinh lưới truy vấn, chạy 1 lần]
Bạn giúp tìm nhà cung cấp dịch vụ cưới ở TP.HCM trên Google Maps.
Với mỗi hạng mục sau: photography, venue, decor, attire, makeup, ceremony, jewelry, transport, stationery, honeymoon,
hãy viết 4 cách người Việt thường gõ để tìm loại dịch vụ đó (ví dụ "studio chụp ảnh cưới", "phóng sự cưới").
Không thêm địa danh. Trả về JSON: {"<hạng mục>": ["từ khoá", ...]}.

[1c — phân loại, mỗi lượt 50 nơi, không search]
Dưới đây là danh sách địa điểm từ Google Maps (id, tên, loại hình, địa chỉ).
Với mỗi địa điểm, xác định nó có phải nhà cung cấp dịch vụ cho đám cưới không, và thuộc hạng mục nào trong:
photography, venue, decor, attire, makeup, ceremony, jewelry, transport, stationery, honeymoon.
Chỉ dựa vào dữ liệu được đưa. Không chắc thì trả "unsure", không đoán.
Trả về JSON: [{"id": "...", "is_wedding_vendor": true|false|"unsure", "category": "...|null", "reason": "một câu"}].

[2 — enrich một vendor, bật Grounding with Google Search]
Tìm thông tin công khai về nhà cung cấp dịch vụ cưới sau:
tên: {name} · địa chỉ: {address} · website: {website} · hạng mục: {category}
Chỉ dùng nguồn chính thức của vendor (website, fanpage) cho giá. Giá từ bên thứ ba, giá cũ, giá của dịch vụ khác: bỏ, ghi lý do vào notes.
Nếu không chắc đây là cùng một vendor (tên trùng nhiều đơn vị, địa chỉ lệch): đặt same_vendor=false và để trống các trường khác.
Trả về JSON:
{"same_vendor": bool, "still_operating": true|false|"unknown", "category_correct": bool,
 "description": "≤ 220 ký tự, tiếng Việt, không quảng cáo",
 "price": {"min_vnd": số|null, "max_vnd": số|null, "unit": "package"|"per_table", "source_url": "...", "quote": "câu nguyên văn chứa giá"},
 "capacity": {"min": số|null, "max": số|null},
 "style_tags": [{"tag": "<1 trong 10 tag chuẩn>", "evidence": "câu nguyên văn", "source_url": "..."}],
 "phone": "...|null", "website": "...|null", "notes": "..."}
```

## Số liệu và giả định trong đề xuất
- **Lưới truy vấn:** 10 hạng mục × 4 từ khoá × 24 khu vực = 960 truy vấn, tối đa 2.880 lượt gọi. Số từ khoá và số khu vực là phỏng đoán.
- **Loại trùng:** so place_id, rồi `name_match.py` + địa chỉ, với 1.030 vendor đang có và 98 vendor đã gỡ.
- **Bước 1d:** dùng Place Details bậc Enterprise. Ảnh lấy bằng `refresh_photos.py` có sẵn.
- **Ước tính chi phí:**
  - Text Search Pro: 5.000 lượt miễn phí mỗi tháng.
  - Details Enterprise: 1.000 lượt miễn phí mỗi tháng.
  - Gemini grounding: 5.000 lượt miễn phí mỗi tháng.
  - Token: khoảng 5 USD cho 1.000 vendor (phỏng đoán).
  - Trần đề xuất: 10 USD mỗi tháng.
- **Xe hoa hiện có:** 39 vendor trong pool, 2 vendor có ảnh Google.
- **Đề xuất không định nghĩa "ngang AI Mode"** bằng con số. Định nghĩa trong spec T-219 là của Product, và cần Capu chốt.
