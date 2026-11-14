# Đề nghị sửa INV-013 (chỉ đề xuất; sửa bất biến phải qua Chief of Staff và ghi `decisions/`)

File: `eval/invariants/planner/vendor/images/inv-013-anh-google-co-ghi-cong.py`

**Phần chạy được: giữ nguyên.** INV-013 đo pool (410/410 ảnh Google có attribution) và đang xanh. Không sửa logic.

**Phần chú thích sai sự thật: sửa.** Docstring dòng 2 và dòng "Lý do" ghi "phungrk/tohong-front #64: PhotoCredit chỉ hiện khi ảnh có `attribution`" và "front (#64) không hiện gì khi thiếu attribution" như thể front đã hiện ghi công. Sự thật (T-156, kiểm 2026-11-14): #64 chưa merge (mergeable_state dirty), front `main` (e61ece5) không hiện tên tác giả ở bề mặt nào; INV-013 chỉ bảo đảm DỮ LIỆU có tên tác giả, không bảo đảm app HIỆN nó.

Đề nghị thay hai chỗ đó bằng:
- "Điều kiện cần (dữ liệu). Điều kiện đủ (app hiện tên tác giả ở mọi bề mặt) do bất biến `planner/front/vendor-images/inv-xxx-ghi-cong-hien-o-moi-be-mat` đo, có hiệu lực sau khi T-156 merge."
- bỏ cụm "như đã merge" / "(#64)" làm nguồn sự thật; trỏ tới T-156.

**Bổ sung (không sửa INV-013):** thêm bất biến mới `inv-xxx-ghi-cong-pool-ten-tac-gia-hop-le.py` (cùng thư mục) siết: tên không có khoảng trắng đầu/cuối hay ký tự điều khiển, dài <= 120, không phải nhãn chung chung ("Google Maps"…), host Google khớp `source`, ảnh không phải Google không mang attribution. Đã xanh trên pool thật.
