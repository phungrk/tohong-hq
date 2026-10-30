# Checklist phần nhìn T-020 (máy đọc được: mỗi dòng một câu có/không)

Vì sao cần checklist: bố cục có đẹp, nhân vật có "đúng vai", chữ có dễ đọc hay không không suy ra được từ DOM. Checklist chỉ **bổ sung** `eval/T-020/flow-fountain.js`; không dòng nào thay cho một eval tự động.

Cách mở: mở `index.html` của nhánh bằng một máy chủ tĩnh, nạp dữ liệu giả từ `--shots` (ảnh nằm ở `docs/screenshots/T-0xx/`), hoặc xem ảnh trực tiếp. Ảnh `all-*` là bộ dữ liệu đủ 8 trạng thái, 3 bậc.

## Tiêu chí 1 (insight)
- [ ] Mở `all-flow-wide.png`: nhân vật insight nhìn khác Capu, Chief of Staff, Product, Engineering, Reviewer ở một dấu hiệu rõ (ví dụ giọt nước hoặc dụng cụ bơm), cùng phong cách pixel art với các nhân vật khác? Có / không
- [ ] Ba bóng mờ Vendor Ops, Growth, Finance vẫn xám, nét đứt, dấu `?`? Có / không

## Tiêu chí 2 (nhãn vai)
- [ ] Mở `all-flow-narrow.png`: mọi tên và nhãn vai đọc được hết, không bị cắt ở mép, không chồng lên đường mũi tên đến mức không đọc được? Có / không
- [ ] Nhãn vai nhỏ hơn và nhạt hơn tên (tên vẫn là thứ nổi nhất)? Có / không

## Tiêu chí 3 (về spec)
- [ ] Mở `spec-flow-wide.png`: đường tím reviewer → product nhìn tách khỏi đường xanh (đang chạy) và đường đỏ (rework) bằng mắt thường, không nhầm màu? Có / không
- [ ] Nhân vật Product trông khác lúc làm việc bình thường (gợi ý "đang sửa"), khi xem hai ảnh `spec-flow-wide.png` và `doing-flow-wide.png`? Có / không

## Tiêu chí 4 (bậc)
- [ ] Mở `review-flow-wide.png`: nhãn bậc và `chờ anh merge` không đè lên tên nhân vật, không đè nhãn khác? Có / không (phần "gần đường nào" do `--criterion 11` kiểm, không kiểm bằng mắt)
- [ ] Ở `all-flow-narrow.png` (390px): nhãn `Về spec ×2`, `A·C`, `B·?`, `chờ anh merge` không che tên hay nhãn vai của vị trí nào? Có / không

## Tiêu chí 7 (cảnh báo)
- [ ] Mở `all-fountain-wide.png`: tầng Thân cột (tím) và Lưới lọc (cam) nhìn nổi hơn các tầng khác, và Phía Capu (đỏ) nhìn là loại cảnh báo khác? Có / không
- [ ] Nhãn `đứng yên n` và `về spec n` có khoảng cách, không dính vào nhau (ví dụ không đọc thành "đứng yên 2về spec 2")? Có / không
- [ ] Mở dashboard ở chế độ tối (prefers-color-scheme: dark): chữ và khung ba màu cảnh báo vẫn đủ tương phản trên nền tối? Có / không

## Tiêu chí 9 (390px)
- [ ] Mở `all-fountain-narrow.png`: sáu tầng đọc được theo đúng thứ tự (hàng 1: Máy bơm, Thân cột; hàng 2: Tia, Lưới lọc; hàng 3: Bể, Ống hồi), người xem hiểu được nước chảy theo chiều nào? Có / không
- [ ] Bảng trông như một cái đài phun (có hướng chảy từ Máy bơm tới Bể rồi quay lại), không chỉ là sáu ô số? Có / không

## Tiêu chí 10 (ảnh)
- [ ] Mô tả PR có nhúng ít nhất các ảnh `all-flow-wide.png`, `all-fountain-wide.png`, `all-flow-narrow.png`, `all-fountain-narrow.png`, và nêu đường dẫn thư mục `docs/screenshots/T-0xx/`? Có / không
- [ ] Trong ảnh `done-fountain-wide.png`, Bể hiện số 3 và số eval hồi quy; trong `new-fountain-wide.png` và `doing-fountain-wide.png` Bể không bị cảnh báo? Có / không

## Tiêu chí 11 (nhãn gắn với đường; bổ sung cho máy, sau T-021-D2)
- [ ] Mở `all-flow-narrow.png`: chỉ nhìn ảnh, không nhìn mã, chỉ ra đường của từng nhãn `A·C`, `B·?`, `chờ anh merge`, `Về spec ×2` (đường nối chính xác hai nhân vật nào). Kết quả có trùng `data-from`/`data-to` của nhãn đó không? Có / không
- [ ] Nhãn nào dùng đường dẫn (nét mảnh nối nhãn với đường) thì đường dẫn không cắt qua đường nào khác và không che tên hay nhãn vai? Có / không (bỏ qua nếu không nhãn nào dùng)
