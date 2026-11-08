---
type: decision
id: ADR-047
date: 2026-11-08
decided_by: chief-of-staff
tasks: [T-106, T-108]
---
# check_6 của T-106: vendor có cùng id ở nguồn venue được tính là venue

**Bối cảnh:** gate T-108 với PR phungrk/tohong-back#42 chỉ đỏ một mục, check_6 (`eval/T-106/check_6_pool_chi_doi_photos.py`: chỉ vendor venue được đổi, và chỉ photos/styles/tags). Mục đỏ là `marry_2650cc6ef8a1` (Silver Creek City Resort). Vendor này nằm trong cả file venue lẫn file honeymoon của tohong#72. Đợt enrich venue cập nhật `style_tags`, và vì `--styles-only` ghép theo id nên bản trong pool cũng đổi styles/tags.
- Nếu ghim styles cũ: check_6 xanh, nhưng INV-001 `planner/vendor/pool` (styles phải khớp văn bản nguồn) đỏ.
- Hai ràng buộc chỉ mâu thuẫn trên đúng 1 vendor này.

**Phân xử:**
1. INV-001 pool thắng, vì đây là bất biến của bể và styles phải khớp nguồn.
2. Ý định của check_6 là "không đụng vendor không phải venue". Một vendor có id xuất hiện trong nguồn venue cũng là venue, nên được đổi như venue.
3. Product sửa câu tương ứng trong spec T-106 và sửa check_6 để coi vendor có id nằm trong nguồn venue là venue. Mọi vendor khác giữ mức chặt gốc của check_6: không đổi trường nào. Không nới gì thêm.
4. Lỗi `generate-vendor-pool.js --styles-only` thoát khi pool nền còn vendor đã gỡ được tách thành việc riêng. Lần này 5 nhà hàng đóng cửa được gỡ thủ công, có ghi trong PR #42.
