# T-115 checklist MANUAL (Capu, iPhone Safari thật)

Lý do không tự động được: Chromium/Playwright không phân biệt `vh` với `svh/dvh` và không có thanh công cụ Safari thật; tiêu chí 6 chỉ chặn `vh/lvh` bằng kiểm tĩnh.

- [ ] Mở app trên iPhone Safari (thanh địa chỉ dưới), vào onboarding tới bước 2/3. Có thể mở thêm `?vvdebug=1` và chụp màn hình để ghi `innerHeight` thật (spec đang GIẢ ĐỊNH 664).
- [ ] Không cuộn: thấy thanh "BƯỚC 2 / 3" và tiêu đề mục "Số khách dự kiến" cùng hàng nút 80 đầu tiên, trọn vẹn, phía trên nút "Tiếp theo"? (có/không)
- [ ] Nút "Tiếp theo" không bị thanh Safari che và bấm được? (có/không)
- [ ] Vuốt lên trong vùng nội dung: tới được hết mục Số khách? (có/không)
