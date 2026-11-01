# T-037 checklist nhìn (máy không đo được "chữ gõ có hồn", "đuôi trỏ đúng nhân vật")

Lý do dùng checklist: các câu dưới đây là cảm nhận thị giác mà `eval/T-037/bam-nhan-vat-tom-tat.cjs` không đo được. Phần đo được (nội dung, thứ tự, tốc độ gõ, bấm lần hai, đóng, live, aria, cỡ chữ, không đè thân bot, bất biến) nằm trong `bash eval/T-037/run.sh <repo> --task T-037`; đừng lặp lại ở đây.

Cách kiểm chung: mở `index.html` của PR bằng trình duyệt tới bảng "Mô hình Eval-Gated 2029", hoặc mở các ảnh trong `docs/screenshots/T-037/`. Mỗi dòng trả lời có/không; một "không" thì ghi dòng đó vào defect (`--against` tiêu chí trong ngoặc).

1. Mở `dang-go-1280.png` và `dang-go-1280-sau.png`: chữ đang gõ dở, ảnh sau dài hơn ảnh trước, bong bóng đã có đủ khung từ đầu (không giãn ra lúc gõ)? ("có" là đạt) [tiêu chí 2, 6]
2. Bấm nhân vật thật trên trình duyệt: nhịp gõ nghe như đang gõ (đều, không khựng từng cụm), không giật khi trang có nhiều dot? ("có" là đạt) [tiêu chí 2]
3. Đuôi (mũi nhọn) của bong bóng chỉ đúng về nhân vật vừa bấm, kể cả khi bong bóng bị đẩy sang trái/phải/dưới vì sát mép? ("có" là đạt) [tiêu chí 4]
4. Bong bóng tóm tắt nhìn khác bong bóng sự kiện (to hơn, nhiều dòng) nhưng cùng bảng màu, không gây hiểu nhầm là sự kiện mới? ("có" là đạt) [tiêu chí 4]
5. Khi bong bóng tóm tắt che khối khác, bấm ra ngoài một lần là hết, không bị kẹt lại che bảng? ("có" là đạt) [tiêu chí 2]
6. `phong-to-390.png` và `toi-390.png`: chữ đọc được, bong bóng không tràn mép, nút `Thu nhỏ` không che chữ bong bóng? ("có" là đạt) [tiêu chí 4]
7. Nhân vật đang `give`/`take`/`wait` khi bấm vào: cử động vẫn mượt, bong bóng không làm nhân vật giật? ("có" là đạt) [tiêu chí 4]
