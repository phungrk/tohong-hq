# Spec T-xxx: <tên ngắn>

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu.
     Viết eval CÙNG LÚC với spec, không viết sau khi có code. -->

## Ý định
<Một câu của Capu hoặc từ insight: ai, muốn gì, vì sao. Trỏ tới insights/… nếu có.>

## Bằng chứng
- <số liệu / truy vấn / insight> — hoặc "GIẢ ĐỊNH, tự tin ~N%"

## Giả thuyết
Nếu làm <X> thì <chỉ số Y> đổi <Z>. Chỉ số bảo vệ: <W không xấu đi>.

## Hành vi (người dùng thấy gì)
<Mô tả theo tình huống: khi … thì … Không mô tả cách cài đặt.>

## Ràng buộc (vòi)
- Repo: `phungrk/…` · Nhánh: `t-xxx-…` · Vùng (`area`): `front/vendor-list`
- Bất biến của vùng đã đọc: `eval/invariants/<area>/` — spec này không vi phạm INV-… (hoặc: đề nghị đổi INV-…, lý do)
- Kiến trúc / design system phải theo: <đường dẫn, quy ước>
- Không chạm: <payment / auth / schema / dữ liệu người dùng …>
- Bậc lưới lọc đề xuất: A | B | C — vì <lý do>

## Tiêu chí chấp nhận và eval
| # | Tiêu chí (có/không) | Eval (lệnh hoặc file chạy được) |
| --- | --- | --- |
| 1 | <…> | `cd tohong-front && npm test -- <tên>` |
| 2 | <…> | `python3 eval/T-xxx/check_2.py` |
| 3 | <…> | `eval/T-xxx/checklist.md` (chỉ khi không tự động được, ghi vì sao) |

## Bất biến đề xuất (tầng 2)
<Tính chất phải đúng mãi trong vùng sau khi spec này ship, viết được thành eval chạy được. Spec critic sẽ rút vào bể khi spec qua cổng. Không có thì ghi "không".>

## Không làm
<ranh giới phạm vi>

## Câu hỏi mở
<tối đa một câu cần Capu quyết; không có thì ghi "không">
