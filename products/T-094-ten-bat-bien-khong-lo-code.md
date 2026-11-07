# Spec T-094: Tên bất biến trong drawer không bao giờ là dòng code hay đường dẫn máy

## Ý định
Capu (qua T-094): tên bất biến xuất công khai luôn là mô tả, không bao giờ là dòng code hay đường dẫn máy, kể cả khi file bất biến viết lạ.

## Bằng chứng
- `eval/T-093/adv-01-ten-file-la.py` + ghi chú adversary T-093: bước 1b của `products/T-092-knowledge-reservoir-drawer.md` mục A ("dòng đầu tiên >= 50 ký tự") có thể nhặt `r = subprocess.run(...)` hoặc dòng có `/home/...` vào `dashboard.json --public`. Đã lộ một lần: ADR-032 (`decisions/2026-11-07-adr-032-chu-mo-ta-inv-011.md`, INV-011 chứa `handoffs/`). Bể hiện sạch chỉ nhờ quy ước ADR-032 (phụ thuộc người viết).
- Đo 2026-11-07 bằng exporter hiện tại (`scripts/export_dashboard.py`, `kr_name`, cả nhánh này lẫn `origin/main`: giống nhau, PR #30 đã vào): 119 file `inv-*`; 0 tên chứa `/home/`, `/root/`, `/tmp/`, `handoffs/`; 0 tên là dòng code. Ảnh chụp tên: `eval/T-094/ten-hien-tai.json`.
- Lỗi thứ hai (đọc `build_model`): file `inv-*` nằm ngay dưới `eval/invariants/` cho `area = "."` (từ `relative_to`), `url = .../eval/invariants/./inv-x`, `path = eval/invariants/./inv-x`. Hôm nay bể không có file ở gốc (đo bằng `ls`), nên chưa lộ.
- Mức tự tin: 90% (đã chạy exporter thật trên bể thật và trên fixture).

## Giả thuyết
Nếu chặn dòng code/đường dẫn máy ngay ở quy tắc tên thì bản `--public` không còn phụ thuộc người viết tuân ADR-032; chỉ số bảo vệ: tên của 119 bất biến thật không đổi một ký tự, INV-009 và INV-017 xanh.

## Hành vi (người dùng thấy gì)
Sửa **mục A của T-092** ở đúng chỗ dưới; mọi chữ khác của T-092 mục A giữ nguyên. Áp dụng cho `name` trong `model.invariant_list` ở cả bản thường và `--public`.

### A. "Dòng code" và "đường dẫn máy" (đo được)
Sau khi làm sạch dòng (T-092: bỏ khoảng trắng, `#`/`//`/ba dấu nháy ở đầu và ba dấu nháy ở cuối), một chuỗi `s` (đã bỏ khoảng trắng hai đầu) là **không dùng được làm tên** khi thỏa **bất kỳ** điều nào sau (so khớp chữ thường/hoa đúng như viết, trừ khi ghi khác):
1. **Đường dẫn máy** (ở bất kỳ vị trí): chứa một trong `/home/`, `/root/`, `/tmp/`, `/Users/`, `/var/`, `/opt/`, `handoffs/`, `C:\`.
2. **Bắt đầu bằng ký hiệu code:** ký tự đầu là một trong `$ { } | & ! < > @ ; \ ^ ~ / % * +`. (Cố ý KHÔNG có dấu nháy ngược, `(`, `[`, `"` ở đây cho chuỗi có chữ có dấu: mô tả hợp lệ của bể bắt đầu bằng chúng, vd `` `capu_queue` không… `` và `(a) bản --public…`; xem điều 9.)
3. **Kết thúc bằng `{`.**
4. **Chứa toán tử/cấu trúc shell hay code** (ở bất kỳ vị trí): `$(`, `${`, ` && `, ` || `, ` == `, ` != `, ` === `, ` !== `, `=>`, `->`, `>&`, `2>`. **Hệ quả đã biết:** văn xuôi viết mũi tên ASCII (`đỏ -> rework`) bị loại và rơi bước kế; chấp nhận vì spec chọn chặt có chủ ý (fixture inv-170). 0 tên thật hôm nay dính.
5. **Bắt đầu bằng từ khoá/lệnh code** viết **thường** đúng như sau, theo sau là hết chuỗi hoặc một trong khoảng trắng, `(`, `[`, `{`, `:`, `;`, `=`, `.`, `-`: `import from def class return if elif else for while with try except finally raise assert print exit const let var function await async set export source cd echo python python3 node bash npm git grep curl fi done exec mkdir rm cp mv cat sed awk jq printf npx readonly declare local esac yield lambda trap touch chmod eval unset shift ls`. Từ đầu toàn chữ HOA (vd `INV`) không tính.
   **Từ dễ trùng văn xuôi** `test case then do pass find sort head tail true false diff command`: chỉ tính khi sau nó là hết chuỗi, hoặc `;`, hoặc (sau khoảng trắng) một ký tự `- " $ / . [ ( '`, hoặc một từ khoá của danh sách trên. Nên `test -f x`, `do echo hi`, `case "$1" in`, `command -v git`, `pass` bị loại, còn `do lỗi mạng nên…`, `test thử khi…`, `case khác xảy ra…` giữ nguyên.
6. **Gán:** chuỗi **bắt đầu** khớp một trong (regex Python, `re.match`, không cần khớp tới cuối):
   - `[A-Za-z_][A-Za-z0-9_.\[\]'"]*\s*(?:[-+*/|&%]|\*\*|//)?=(?!=)\s*\S` (vd `r = subprocess.run(…)`, `x += 1`);
   - gán nhiều biến `[A-Za-z_][\w.]*(?:\s*,\s*[A-Za-z_][\w.]*)+\s*=(?!=)` (vd `back, front = …`, `T, G, X = (…)`);
   - gán có kiểu `[A-Za-z_]\w*\s*:\s*[A-Za-z_][\w\[\], .]*=(?!=)` (vd `x: int = 5`).
7. **Gọi hàm:** chuỗi khớp `^[A-Za-z_][A-Za-z0-9_.]*\(.*\)\s*;?$` (cả dòng, vd `print(x)`); **hoặc** bắt đầu bằng `[A-Za-z_][A-Za-z0-9_.]*\(` và (toàn ký tự ASCII, hoặc số `(` nhiều hơn số `)`, hoặc kết thúc bằng `(`): lệnh gọi viết nhiều dòng như `L.task("new", "--title", "x",`. KHÔNG dùng quy tắc "kết thúc bằng dấu phẩy" (loại nhầm 8 tên thật).
8. **Pipe:** chứa ` | ` mà từ đầu tiên sau nó là một từ trong điều 5 (kể cả nhóm dễ trùng) hoặc `wc tr cut xargs tee uniq sh`, **và** (chuỗi toàn ASCII, hoặc bắt đầu bằng từ khoá điều 5). Vd `cat x | sed -n 1,12p | grep -c area` bị loại; câu tiếng Việt trích `` `pgrep x | xargs kill` `` (tên thật INV-010 planner/vendor/images) giữ nguyên.
9. **Dạng dữ liệu/mã khác, chỉ cho chuỗi toàn ASCII:** khớp `^"[\w.-]+"\s*:` (khoá JSON), hoặc `^[a-z_]+:\s*[\["{]` (`sources: [...]`), hoặc `^\S+\)\s*,?$`, hoặc `\)\s*;\s*\S` (hai lệnh một dòng), hoặc bắt đầu bằng `"` hay `(`, hoặc số `)` nhiều hơn số `(`.

Cài đặt tham chiếu độc lập: `looks_like_code` trong `eval/T-094/namerule2.py`. Quy tắc chọn **chặt** có chủ ý: thà bỏ nhầm một dòng mô tả lạ (rơi xuống bước kế, tên vẫn đọc được) còn hơn để lọt dòng code. Đã kiểm: 119 mô tả thật của bể đều không bị loại (tên không đổi); quét mọi dòng >= 50 ký tự trong 12 dòng đầu của mọi file `inv-*` thì không còn dòng ASCII nào trông như code mà không bị loại (chỉ còn gạch đầu dòng văn xuôi `- …`).

### A'. Sửa đổi (T-099): chú thích cuối dòng
Bổ sung mục A; mọi điều 1-9 giữ nguyên chữ. Lý do: Code Gate T-097 (`eval/T-097/adv-01-code-kem-chu-thich-tieng-viet.py`) tìm được dòng gọi hàm kèm chú thích tiếng Việt (vd `sys.path.insert(0, …)  # …`, `env.pop("X", None)  # …`, `subprocess.run([…])  # …`; thật trong `eval/T-072/lib/run_py.py`, `eval/T-063/eval-mirror.py`) không thỏa điều 7 (không còn toàn ASCII, ngoặc không cân) và thành `name`.

Trước khi xét một chuỗi `s` theo điều 1-9, **tách chú thích cuối dòng**: quét `s` từ trái sang phải, giữ trạng thái "trong chuỗi nháy": gặp `"` hoặc `'` ngoài chuỗi thì mở chuỗi; chuỗi đã mở **chỉ đóng bởi đúng loại nháy đã mở nó** (mở bởi `"` thì chỉ `"` đóng, `'` bên trong bị bỏ qua; mở bởi `'` thì chỉ `'` đóng, `"` bên trong bị bỏ qua); **không xét dấu thoát `\`** (`\"` không đặc biệt); chuỗi chưa đóng thì cho tới hết `s` vẫn là "trong chuỗi" và không có điểm tách. **"Khoảng trắng" trong mục này chỉ là dấu cách (U+0020) hoặc tab (U+0009), tức `[ \t]`**, áp dụng cho cả khoảng trắng đứng trước dấu và khoảng trắng đứng sau dấu; NBSP (U+00A0) và mọi ký tự trắng khác (`\r`, U+3000, ...) **không** là khoảng trắng ở đây và không bao giờ tạo điểm tách. Điểm tách là **vị trí của ký tự `[ \t]` đầu tiên** thỏa cả ba: ngoài chuỗi nháy; ngay sau nó là `#` hoặc `//`, rồi một ký tự `[ \t]` nữa (vd `# `, `#<TAB>`, `// `); phần đứng trước nó có ít nhất một ký tự không thuộc `[ \t]`. Chỉ điểm tách đầu tiên được dùng, các điểm sau bỏ qua. `head` = phần trước điểm tách, bỏ các `[ \t]` ở cuối. Không có điểm tách thì không có `head`.
- Nếu `s` thỏa điều 1-9 (như cũ), `s` không dùng được làm tên.
- Nếu không, và có `head` mà `head` thỏa điều 1-9, thì **cả dòng `s` là code**, không dùng được làm tên (rơi bước kế như mọi ứng viên bị loại ở mục B).
- Chỉ `head` được xét lại; điều kiện 1-9 không đổi và không xét lại lần nữa trên phần chú thích.

Ca biên (đo được):
- Dòng chỉ là chú thích (`# mô tả …`, `// mô tả …`): dấu ở đầu đã bị bước làm sạch của T-092 bỏ; không có ký tự không trắng đứng trước nên không tách; xử lý như cũ.
- Dấu dính chữ, thiếu khoảng trắng ở một trong hai phía (`C#`, `#3`, `a#b`, `https://x`, `x //y`) không phải điểm tách. `a // b` và `a # b` (khoảng trắng cả hai phía) LÀ điểm tách.
- `head` không thỏa mục A (vd `hàm f(x) # ghi chú`, `ngôn ngữ C # và …`) thì cả dòng không bị loại bởi điều khoản này.
- Dấu trong chuỗi nháy (`print("a # b")` hay `x = "a // b"`) không phải điểm tách; nháy lẻ trong văn xuôi (`don't … # …`) làm không tách: hệ quả chọn có chủ ý, chỉ làm quy tắc nhẹ tay hơn (dòng giữ nguyên như điều 1-9 cũ).
- Chỉ tách chú thích ĐẦU TIÊN; phần sau nó không xét.

Cài đặt tham chiếu: `strip_trailing_comment` và `looks_like_code` trong `eval/T-094/namerule2.py`. Fixture thêm vào bảng B (`eval/T-094/check.py`, tên mong đợi viết tay): inv-147..150 (bốn dòng code kèm chú thích tiếng Việt: `sys.path.insert`, `env.pop`, `subprocess.run`, `await page.goto(…); //`) -> dòng mô tả sạch kế tiếp; inv-165 (`C#`, `#3`) và inv-166 (`hàm f(x) # ghi chú …`) -> nguyên văn đuôi.

### B. Quy tắc tên mới (thay "Một quy tắc duy nhất, thử lần lượt" của T-092)
Giữ nguyên làm sạch, bước 1, 2, 3 và phần "Sau khi có `name`" của T-092, **thêm hai điều**:
- Mỗi **ứng viên** (đuôi ở 1a; dòng ≥ 50 ký tự ở 1b; chữ sau `·` ở bước 2) phải **không** rơi vào mục A, kiểm trên ứng viên **trước** khi cắt ở ". " và trước khi cắt 140 ký tự.
  - 1a: đuôi bị loại thì **bỏ cả bước 1, sang bước 2** (không thử 1b).
  - 1b: dòng bị loại thì **bỏ qua dòng đó, thử dòng ≥ 50 ký tự kế tiếp** trong 12 dòng; hết thì sang bước 2. (Cùng cách `chỉ xanh` đang bị bỏ qua.)
  - 2: chữ sau `·` bị loại thì sang bước 3 (không thử dòng `INV-…` khác).
- **Bước 4:** nếu bước 3 cho chuỗi rỗng (tên file không có slug, vd `inv-111.sh`), `name` = tên file (`inv-111.sh`). Tên không bao giờ rỗng, không bao giờ rơi vào mục A (slug và tên file chỉ có chữ, số, `-`, `_`, `.`, và `inv-<số>.sh` không bắt đầu bằng từ khoá).

Hệ quả: `name` không bao giờ chứa `/home/`, `/root/`, `/tmp/`, `handoffs/`, `C:\`, và không bao giờ là một dòng thỏa mục A. `source` giữ nguyên.

**Bảng fixture** (`eval/T-094/check.py --criterion 1` dựng đúng các file này, tổng 43 file trong sổ cái tạm (37 + 6 của T-099); tên mong đợi viết tay):

| File | Nội dung chính | `name` mong đợi | Vì sao |
| --- | --- | --- | --- |
| inv-101-bo-qua-dong-code.py | `Bất biến hq/x · nguồn: T-001 (…).` rồi `r = subprocess.run([...], …)` (>= 50 ký tự), rồi mô tả | chữ mô tả (tới ". ") | 1b bỏ dòng gán (mục A.6) |
| inv-102-het-dong-code.py | như trên, chỉ có `ROOT = Path(…)…` rồi `INV-102 · Mô tả ở bước hai` | `Mô tả ở bước hai` | 1b hết dòng -> bước 2 |
| inv-103-mot-a-la-code.py | `Bất biến (hq/x): r = subprocess.run(…)` + dòng văn xuôi dài + `INV-103 · Mô tả bước hai ba` | `Mô tả bước hai ba` | 1a bị loại -> bước 2, không nhặt dòng văn xuôi |
| inv-104-co-duong-dan-may.sh | `Bất biến: chạy trong /home/user/…` | `co duong dan may` | A.1; bước 2 không có -> slug |
| inv-105-handoffs-trong-ten.sh | `Bất biến: đọc handoffs/T-001-v1.md …` | `handoffs trong ten` | A.1 |
| inv-106-tmp-root-roi-xuong.sh | dòng mô tả dài chứa `/tmp/` và `/root/`, rồi mô tả sạch | mô tả sạch | A.1 ở 1b -> dòng kế |
| inv-107-lenh-shell.sh | `source "$HERE/…" && …`, `if [ -f … ]; then …`, `set -u`, rồi mô tả | mô tả | A.4, A.5 |
| inv-108-doi-chung-ngoac-bang.sh | `Bất biến: số lưu (amt) = số ở dòng khoản; tổng khớp` | nguyên văn đuôi | đối chứng: `=` và `(` trong mô tả KHÔNG bị loại |
| inv-109-doi-chung-backtick.sh | `` Bất biến: `capu_queue` không… `` | nguyên văn đuôi | đối chứng: dấu nháy ngược đầu dòng không bị loại |
| inv-110-dong-inv-la-code.sh | `INV-110 · x = f(y)` | `dong inv la code` | bước 2 bị loại -> slug |
| inv-111.sh | `Bất biến: cd /root/work && python3 run.py` | `inv-111.sh` | bước 4 (tên file) |
| inv-112-doi-chung-mo-ta-co-slash.sh | `Bất biến: scripts/export_dashboard.py không sập…` | nguyên văn đuôi | đối chứng: đường dẫn repo (không phải đường dẫn máy) được phép, như INV-004/005 hq/dashboard hôm nay |
| inv-130..148 (19 file) | mỗi file một dòng code giữa dòng nguồn và một dòng mô tả sạch >= 50 ký tự: `exec node "$HERE/lib/loc_inv.cjs" --repo "$REPO" --check kr-sum` (dòng chuẩn của bể); `back, front = …`; `T, G, X = (…)`; `count: int = …`; `L.task("new", …,` và `result = run_checks(a, b,` (gọi nhiều dòng); `cat … \| sed … \| grep …`; `sed … \| awk … \| jq …`; `mkdir … && printf …`; `rm -rf …`; `npx playwright test …`; `local out; out=$(…)…`; `test -f … \|\| { … }`; `case "$1" in …`; `f = lambda …`; `command -v node …`; ba dòng văn xuôi có `/Users/`, `/var/`, `/opt/` | dòng mô tả sạch | điều 1, 4-9 |
| inv-160..164 (5 file) | văn xuôi tiếng Việt: `do lỗi mạng…`, `test thử khi…`, `case khác xảy ra…`, câu trích `` `pgrep x \| xargs kill` ``, `số lượng (a = 1, b = 2)…` | nguyên văn đuôi | đối chứng: không bị loại |
| inv-170-mui-ten-trong-van-xuoi.sh | `Bất biến: đỏ -> rework, xanh -> merge theo bậc của việc` | `mui ten trong van xuoi` | hệ quả đã biết của điều 4 |

### C. File bất biến ở gốc `eval/invariants/`
File thường `inv-*` nằm ngay dưới `eval/invariants/` (không thư mục con):
- `area` = `_root` (không phải `.`). Mọi `area` trong `model` khớp `^(_shared|_root|[a-z0-9_-]+(/[a-z0-9_-]+)*)$`; không bao giờ `.`, rỗng hay có `..`.
- `url` = `https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/<tên file>` (không `/./`, không `//` sau `https://`); `path` (chỉ không `--public`) = `eval/invariants/<tên file>`. File ở vùng con giữ như T-092.
- `invariants["_root"]` đếm chúng; `invariants_total` = tổng = `len(invariant_list)` như cũ. Thứ tự: `_shared` đầu, rồi các vùng khác tăng dần theo chuỗi (nên `_root` đứng trước `hq/…`, `planner/…`).
- Bộ lọc sản phẩm (T-041 H2) không đổi: `_root` không thuộc `_shared` hay sản phẩm nào, nên chỉ tính ở "Tất cả".

### D. Bể thật
Tên của mọi file `inv-*` hiện có (119 ở 2026-11-07) **không đổi một ký tự**. Bảng so sánh trước/sau = `eval/T-094/ten-hien-tai.json`: 119 dòng, `sua_co_chu_y` = `{}` (0 ca sửa có chủ ý: không bất biến nào hôm nay có tên là code hay đường dẫn máy). Ai cần sửa có chủ ý thêm vào `sua_co_chu_y` kèm lý do, qua Chief of Staff. File mà 12 dòng đầu đổi sau ngày chụp bị bỏ khỏi so sánh (vẫn phải qua mục A).

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq` · Nhánh: `t-094-…` · Vùng: `hq/dashboard/model`. Chạm `scripts/export_dashboard.py` (`kr_name`, `build_model`) và nếu cần `eval/T-092/namerule.py` (Engineering không sửa eval để khớp code; `namerule.py` là eval T-092: để nguyên, T-094 dùng `namerule2.py`).
- Bất biến đã đọc: `_shared/`, `hq/`, `hq/dashboard/` (INV-001..016, trong đó INV-009 "bản công khai không rò"), `hq/dashboard/model/`. Không vi phạm; INV-017 (chờ ở `eval/T-092/bat-bien-cho-merge/`) so `invariants` với số đếm theo `relative_to` (gốc = "."); xem "Câu hỏi mở".
- Không chạm: payment, auth, DB, dữ liệu người dùng, trang `index.html`.
- Bậc đề xuất: A (exporter thuần, eval tự động phủ hết).

## Tiêu chí chấp nhận và eval
Board ghi một tiêu chí gồm bốn ý 1)-4); mỗi ý một eval:
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | `name` của mọi fixture bảng B đúng từng ký tự, cả có và không `--public`; không tên nào chứa `/home/`, `/root/`, `/tmp/`, `handoffs/` | `cd /home/user/tohong-hq && python3 eval/T-094/check.py --criterion 1` |
| 2 | File ở gốc `eval/invariants`: `area` = `_root`, `url`/`path` không có `/./`, đếm và thứ tự đúng, cả hai chế độ | `cd /home/user/tohong-hq && python3 eval/T-094/check.py --criterion 2` |
| 3 | Tên 119 bất biến thật không đổi so với `ten-hien-tai.json` (trừ `sua_co_chu_y`); mọi tên không là code/đường dẫn máy và khớp `namerule2.py` | `cd /home/user/tohong-hq && python3 eval/T-094/check.py --criterion 3` |
| 4 | INV-009 và INV-017 xanh | `cd /home/user/tohong-hq && D3=${D3:-/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js} bash eval/T-094/check4.sh` (INV-009 cần `D3` và node; `check4.sh` còn tự tìm `d3.min.js` nếu `D3` thiếu) |

Hiện: 1 đỏ, 2 đỏ (đúng kỳ vọng, chưa có code), 3 xanh (phải xanh trước và sau), 4 xanh.

## Bất biến đề xuất (tầng 2)
INV-đề-xuất (hq/dashboard/model): "`name` trong `dashboard.json` (cả hai chế độ) của mọi file bất biến, trên bể thật, không chứa `/home/`, `/root/`, `/tmp/`, `handoffs/` và không thỏa mục A; mọi `area` khớp regex mục C." Dạng chạy được: tiêu chí 3 rút gọn (không cần ảnh chụp) -> `eval/T-094/check.py --criterion 3` phần property. Spec-critic rút khi spec qua cổng.

## Không làm
Không đổi `source`, không đổi thứ tự/đếm của T-092 ngoài `_root`, không sửa file bất biến hiện có, không đổi trang `index.html` (drawer đọc `name` như cũ).

## Câu hỏi mở
Không. INV-017 (`eval/invariants/hq/dashboard/inv-017-so-be-khop-file-that.py`) tính vùng bằng `relative_to`, nên file ở gốc mang vùng `"."` và sẽ đỏ với `_root`. Chief of Staff sửa INV-017 (ánh xạ `"."` thành `"_root"`, bỏ chữ "chờ merge" ở đầu file) qua `decisions/` cùng lúc merge code T-094; spec-critic và Engineering không tự sửa. Hôm nay bể không có file ở gốc nên INV-017 vẫn xanh.

## Đã sửa ở rework 1 (T-094-D1)
Mục A điều 5-9 viết lại: thêm `exec`, `command` + các lệnh cat/sed/awk/jq/mkdir/rm/printf/npx/test/local/case/then/do/pass/lambda…; gán nhiều biến và gán có kiểu; gọi hàm nhiều dòng; pipe; `/Users/ /var/ /opt/`; điều 6 ghi "bắt đầu khớp". Lý do: định nghĩa đóng 7 điều cũ để lọt `exec node "$HERE/…"` (dạng chuẩn của 80 file bể) và 3 dạng khác, ba cách cài đặt cho ba tên khác nhau. Fixture tăng từ 12 lên 37.

## Đã sửa ở T-099
Bổ sung mục A' (chú thích cuối dòng) sau lỗi hổng Code Gate T-097 tìm thấy; điều 1-9 và mọi chữ khác không đổi. Câu cũ cho hai cách hiểu: điều 7 và 9 xét cả dòng kể cả phần chú thích, nên dòng code + chú thích tiếng Việt vừa không-ASCII vừa lệch ngoặc không bị bắt. Bảng fixture B tăng thêm 6 file; số 37 ở bảng thành 43.
