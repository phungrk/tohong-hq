# T-064 · adv-01 chạy được khi gate gọi không tham số

**Từ:** Chief of Staff · **Ngày:** 2026-11-05

`task.py evalplus` đăng ký `eval/T-064/adv-01.py` trần; `gate.py` (ADR-020) chạy file `.py` một từ bằng `python3 -I <file>` không tham số, nên adv-01 luôn `FAIL thiếu --back` dù code đúng.

Sửa đường tìm repo trong `eval/T-064/adv-01.py` (không đổi phép đo, không đổi ngưỡng): thiếu `--back` thì lấy `TOHONG_BACK_REPO`, rồi repo `tohong-back` nằm cạnh `tohong-hq`. Đã chạy không tham số trên nhánh PR (60bc7da): PASS. Trên code trước sửa (e532be9) adversary đã chứng minh đỏ.

Bài học quy trình: eval đăng ký qua `evalplus` phải chạy được bằng đúng chuỗi đăng ký. Adversary kiểm bằng `gate.py` trước khi chạy `evalplus`.
