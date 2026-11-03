# T-051 · Checklist cho Capu (tiêu chí 12): deploy thật lên Cloudflare Pages

Vì sao là checklist: cần tài khoản Cloudflare thật, token thật và đường ra marry.vn từ GitHub Actions; phiên cloud không có và không được đặt secret thay Capu. Mọi phần còn lại đã có eval tự động (run.sh, 11 tiêu chí).
Mỗi dòng trả lời có/không. Hướng dẫn từng bước nằm ở `scripts/vendor-images/README.md` của tohong-back (tiêu chí 7 kiểm file này có đủ).

Trước khi chạy
1. Có project Pages tên `tohong-img` kiểu Direct Upload (Cloudflare dashboard > Workers & Pages) không? Mở Pages > tohong-img, thấy tên đúng và loại "Direct Upload".
2. Repo `phungrk/tohong-back` có hai secret `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` không? Mở Settings > Secrets and variables > Actions, thấy đúng hai tên (không cần thấy giá trị).
2b. Settings > Actions > General > Workflow permissions của `phungrk/tohong-back`: đã chọn "Read and write permissions" và bật "Allow GitHub Actions to create and approve pull requests" chưa? (Mặc định tắt; chưa bật thì lần chạy deploy=true sẽ deploy xong rồi đỏ ở bước mở PR.)
3. Token chỉ có quyền "Cloudflare Pages: Edit" cho đúng một tài khoản, không có quyền khác (không phải Global API Key) không? Mở Cloudflare > My Profile > API Tokens, xem token.
4. Địa chỉ `https://tohong-img.pages.dev` trùng với địa chỉ Cloudflare cấp cho project không? Nếu Cloudflare cấp tên khác (vd tohong-img-abc.pages.dev), điền đúng địa chỉ đó vào ô `base_url` khi chạy workflow.

Chạy lần 1 (Actions > Mirror vendor images > Run workflow, deploy = false, tức chỉ tải + chuyển + báo cáo)
5. Workflow chạy xong màu xanh, không đỏ không? Mở trang run.
6. Phần Summary của run có dòng `SUMMARY total=… ok=… new=… reused=… restored=… failed=…` không? Có `total` gần 2.467 (số URL ảnh duy nhất lúc viết spec) không?
7. `failed` nhỏ hơn 5% `total` không? Nếu lớn hơn, đọc các dòng `FAILED <url> <lý do>`: toàn `http-403` nghĩa là marry.vn chặn cả GitHub Actions; dừng ở đây và báo Chief of Staff (không tự thử cách khác).
8. Artifact của run có `manifest.json` và `vendorPool.generated.js` (đã thay URL) không? Tải về, mở manifest: có `"baseUrl": "https://tohong-img.pages.dev"` (hoặc địa chỉ ở dòng 4) không?
9. Số file trong thư mục ảnh dưới 19.000 và không file nào quá 25MB không? Workflow tự dừng và ghi rõ nếu vượt; không có dòng dừng nghĩa là đạt.

Chạy lần 2 (deploy = true)
9b. Repo không còn PR nào mở từ nhánh `vendor-images/run-…` chưa merge không? Còn thì merge hoặc đóng nó TRƯỚC khi deploy lại (deploy thay cả site; PR cũ chưa merge sẽ trỏ tới file không còn trên Pages). Workflow cũng tự từ chối chạy khi còn PR như vậy: thử thì thấy lời nhắn nêu số PR.
10. Workflow xanh và log có đúng một lệnh `pages deploy` tới project `tohong-img` không? Log không in giá trị token hay account id (tìm chuỗi token, không thấy)?
11. Mở `https://tohong-img.pages.dev/v/<tên-file-bất-kỳ-trong-manifest>` trong trình duyệt: thấy ảnh, trình duyệt báo loại `image/webp`, chiều rộng không quá 800px không? (DevTools > Network > chọn ảnh.)
12. Phản hồi của ảnh có `Cache-Control: public, max-age=31536000, immutable` không?
13. So một ảnh với bản gốc trên marry.vn (URL gốc ở manifest, mở bằng máy Capu): cùng một ảnh, cùng hướng, không bị cắt/lật không? Thử 3 ảnh, trong đó 1 ảnh dọc.
14. Bấm Run workflow lần nữa (deploy = true) không đổi gì: `SUMMARY` có `new=0` và `failed` bằng lần trước không? Ảnh ở bước 11 vẫn mở được không?

Gộp vào app
15. Mở PR tohong-back mang pool đã thay URL + `manifest.json` (Capu duyệt diff hành vi trong handoff rồi tự merge; bậc C). PR không chứa file ảnh, không chứa secret không? (Tab Files changed: không có .webp/.jpg/.png.)
16. Sau khi deploy tohong-back: mở app, vào chat chọn một hạng mục vendor để ra danh sách gợi ý. DevTools > Network lọc `marry.vn`: không có yêu cầu nào tới marry.vn cho ảnh đã mirror; ảnh hiện từ `tohong-img.pages.dev` không? Với ảnh còn trong danh sách lỗi (nếu có), thẻ hiện nền gradient mặc định, không khung ảnh vỡ không?
17. Mở màn "Vendor đã lưu" và một hạng mục trong Ngân sách (vendor đã lưu từ trước T-051 trên máy Capu): DevTools > Network lọc `marry.vn`: không có yêu cầu nào; ảnh hiện từ `tohong-img.pages.dev`; mở Application > Local Storage `th_vendors_*`: nội dung cũ vẫn nguyên (còn URL marry.vn trong đó là đúng) không?
18. Tải lại 3 lần: không lần nào có ảnh vỡ không?
