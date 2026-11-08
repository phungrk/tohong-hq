# Spec T-102: Thí nghiệm có đo Graphify cho Engineering trên tohong-front

## Ý định
Capu (2026-11-08) muốn biết bằng số đo, không bằng lời hứa, Graphify (github.com/Graphify-Labs/graphify) có làm Engineering tốn ít token hơn khi làm việc trên `tohong-front` không, đủ để quyết dùng tiếp hay bỏ. Đây là thí nghiệm có đo, chưa phải tính năng: không có thay đổi hành vi nào cho cặp đôi dùng app.

## Bằng chứng
- README Graphify (đọc 2026-11-08, https://github.com/Graphify-Labs/graphify): mã nguồn được phân tích cục bộ bằng tree-sitter, không dùng LLM; tài liệu, PDF, ảnh được gửi tới model của trợ lý AI qua skill; `--code-only` bỏ tài liệu và media; `GRAPHIFY_BACKEND=none` tắt backend LLM; mỗi truy vấn ghi vào `~/.cache/graphify-queries.log` (tắt bằng `GRAPHIFY_QUERY_LOG_DISABLE=1`); `graphify install` đăng ký skill ở hồ sơ người dùng, `--project` cài vào repo hiện tại; `graphify hook install` cài git hook; PreToolUse hook có thể ở chế độ chặt từ chối một số Read/Grep; `graphify uninstall [--purge]` gỡ. README nói không có telemetry và không liệt kê đủ file bị ghi: **phần này là điều phải đo, không phải điều đã biết** (tự tin README đúng ~70%).
- Số liệu tohong-front (đo 2026-11-08, `git ls-files`): 64 file trong `src/`, `.env` không được git theo dõi, ảnh chụp màn hình nằm ở `docs/screenshots/`; quét email/số điện thoại/khoá bí mật trên cây của ba commit cơ sở cho kết quả sạch sau khi bỏ các giá trị thử nghiệm `a@b.vn`, `b@c.vn`, `ten@email.com` (`eval/T-102/check_6_khong_du_lieu_nguoi_dung.py`).
- Đơn giá: `scripts/pricing.json` (claude-sonnet-5-5: input 2.0, cache_write_5m 2.50, cache_read 0.10, output 10.0 USD/MTok).
- Đoán, tự tin ~40%: Graphify giảm token đọc file của Engineering ở repo 64 file; repo nhỏ nên lợi ích có thể nhỏ hơn chi phí thêm (skill, hook, truy vấn đồ thị). Vì vậy mới đo.

## Giả thuyết
Nếu Engineering làm cùng một việc front trong một worktree có đồ thị Graphify (bản B) thay vì không có (bản A) thì **$/việc giảm >= 20%**. Chỉ số bảo vệ: tỷ lệ gate xanh ở lần đầu không thấp hơn và số lần trả việc trung bình không cao hơn.

## Hành vi (người dùng thấy gì)
"Người dùng" ở đây là Capu và Chief of Staff, đọc một báo cáo. Cặp đôi dùng app không thấy gì khác.

### 1. Điều kiện tiên quyết về số đo
Số token lấy từ sự kiện `cost` (`scripts/cost.py`). Hook này hiện không ghi được ở phiên cloud và **T-101 đang sửa** (board/T-101.md, state: doing). Quy tắc:
- T-101 `done` trước khi bắt đầu đo: lấy từ sự kiện `cost` (trường `source` của lượt = `cost_event`).
- T-101 chưa xong: lấy thẳng `usage` trong transcript bằng `python3 scripts/cost.py report <transcript.jsonl>` (chỉ in, không ghi sổ cái), gộp theo `message.id` như `cost.py` đã làm, cộng cả transcript subagent nếu có (`source` = `transcript`).
- Lượt đo chạy trong thư mục scratchpad, ngoài `tohong-hq`, nên hook dự án không nạp cho chúng. Vì vậy mỗi lượt đo **luôn** đọc transcript của chính lượt đó (`~/.claude/projects/<slug-của-worktree>/\*.jsonl`) và `$/lượt` tính theo `scripts/pricing.json`; hai nguồn không bao giờ cộng chồng.

### 2. Cách cài Graphify khoanh vùng (ADR-035)
Mọi thứ nằm dưới một thư mục thí nghiệm `<scratchpad>/t102/`. Ghi nhận của người cài (Engineering) vào `insights/T-102-runs/install-manifest.json`: `scratch_root`, `experiment_dir`, `paths_written` (mọi đường dẫn mới sau khi cài, lấy bằng so sánh trước/sau trên `$HOME`, `tohong-hq`, `tohong-front` gốc), `mode`, `backend`, `query_log_disabled`, `query_log_existed_before`, `teardown_done`.
- Công cụ: môi trường ảo Python riêng `<exp>/venv` (`python3 -m venv`, `pip install graphifyy`). **Không** dùng `uv tool install`/`pipx install` (cài toàn cục), **không** chạy `graphify install` không kèm `--project` (ghi vào hồ sơ người dùng `~/.claude`/`~/.agents`), **không** chạy `graphify hook install` (git hook nằm trong `.git/hooks` dùng chung của tohong-front gốc, vì worktree chia sẻ `.git`).
- Worktree: `git -C /home/user/tohong-front worktree add --detach <exp>/wt-<task>-<arm>-r<n> <base_sha>` cho **từng lượt** (mới tinh mỗi lượt, không dùng lại). `node_modules` liên kết mềm tới của tohong-front gốc, chỉ đọc; eval chạy qua helper vite có cache riêng (T-077, đã xong). Graphify chỉ cài ở bản B, bằng `graphify claude install --project` trong chính worktree đó: skill và hook PreToolUse nằm ở `.claude/` của worktree và biến mất cùng worktree. Chế độ mặc định của hook, **không** chế độ chặt (chặt đổi hành vi đọc/grep, làm A/B không còn là "Graphify như người dùng cài mặc định").
- Biến môi trường mọi lượt B: `GRAPHIFY_BACKEND=none`, `GRAPHIFY_QUERY_LOG_DISABLE=1`; dựng đồ thị bằng chế độ chỉ-mã (`--code-only`); `.graphifyignore` loại `docs/`, `public/`, `dist/`, `node_modules/`, `*.md`, ảnh.
- Không cài vào `tohong-hq`, `~/.claude`, `.claude/settings*` dùng chung, `CLAUDE.md`; không đụng `tohong-front` gốc ngoài việc tạo/gỡ worktree.
- Gỡ sạch (cuối thí nghiệm, bắt buộc): `graphify uninstall --purge` trong từng worktree còn lại, `git worktree remove --force` + `git worktree prune`, xoá `<exp>/`, xoá `~/.cache/graphify-queries.log` nếu do thí nghiệm tạo, đặt `teardown_done: true`. Bản gỡ sạch là trạng thái máy, được kiểm bằng quét thật.

### 3. Graphify gửi gì qua Claude
Phải nêu trong mục "Dữ liệu gửi đi" của báo cáo, theo từng loại:
- Mã nguồn (`src/`, `scripts/`, `*.js`, `*.jsx`): phân tích cục bộ bằng tree-sitter theo README, **không** gửi để dựng đồ thị. Bản B ở `--code-only` + `GRAPHIFY_BACKEND=none`.
- Tài liệu và ảnh (`README.md`, `DESIGN.md`, `docs/screenshots/*.png`, `public/*.png`): ở chế độ đầy đủ README nói sẽ gửi tới model của trợ lý qua skill. Thí nghiệm loại hết bằng `--code-only` và `.graphifyignore`, nên **không gửi**.
- Kết quả truy vấn đồ thị (mã nguồn và quan hệ giữa các hàm) quay lại ngữ cảnh của agent: giống mọi lệnh Read/Grep, nằm trong phiên Claude của lượt đo và được tính vào token của lượt đó.
- Nhật ký truy vấn cục bộ (`~/.cache/graphify-queries.log`): tắt; kiểm bằng `query_log_disabled` và quét thật.
- Cam kết cần xác nhận lúc chạy: báo cáo ghi kết quả của một lượt dựng đồ thị thử có theo dõi mạng/tiến trình (không có kết nối ra ngoài ngoài phiên Claude). Nếu quan sát khác README, báo cáo ghi rõ và thí nghiệm dừng, `task.py block`.

### 4. Xác nhận không có dữ liệu người dùng thật
tohong-front là mã giao diện: không có `.env`, không có bản ghi người dùng; chỉ có giá trị thử nghiệm (`a@b.vn`...). Eval quét cây git của mỗi commit cơ sở (trừ `docs/`, `public/`, `*.md`, ảnh, `package-lock.json`): không email thật, không số điện thoại VN, không chuỗi giống khoá bí mật (`sk-`, `pk_live_`, JWT, `AKIA`), không file `.env*`. Ảnh chụp màn hình trong `docs/screenshots/` bị loại khỏi Graphify; chưa kiểm nội dung ảnh (ghi ở rủi ro). Dữ liệu thật chỉ có ở tohong-back và Postgres; thí nghiệm không dùng chúng: các eval front trong danh sách chạy với dữ liệu giả của chính eval.

### 5. Thiết kế A/B
Bốn việc front đã xong (`eval/T-102/tasks.json`, khoá cùng ngưỡng). Mỗi việc chạy lại từ **commit cha** của PR đã merge (`base_sha`), có spec và eval sẵn. Cùng loại (một repo React, thay đổi giao diện/logic ở `src/`), khác cỡ: T-060 nhỏ (6 file, CSS/className), T-050 vừa (4 file, +108/-44), T-046 vừa (6 file code, +156/-29). T-068 dự phòng, thay một việc lõi khi việc đó không chạy lại xanh được ở bản A (một lượt A chưa từng xanh trong 3 lần = việc hỏng, thay, ghi lý do).
- **Một lượt** = một tiến trình `claude -p` mới, cwd là worktree, model ghim `claude-sonnet-5-5` ở mọi lượt, cùng tệp prompt (tiêu đề + nội dung spec + danh sách lệnh eval với `<WT>` thay bằng worktree + câu "đừng dùng git log/show/diff/branch để xem lịch sử, chỉ làm trên cây hiện tại"), cùng lệnh, cùng giới hạn lượt/thời gian. Bản B **không** có câu hướng dẫn Graphify nào thêm: skill/hook là phần can thiệp, agent tự quyết dùng hay không.
- **Trả việc**: sau khi agent báo xong, harness chạy toàn bộ eval của việc; nếu có đỏ, harness trả nguyên văn đầu ra đỏ vào cùng phiên (tối đa 3 lần trả). `returns` = số lần trả; `gate_green_first` = true nếu eval xanh hết ở lần báo xong đầu tiên.
- **Ma trận**: 3 việc lõi x 2 bản x tối thiểu 2 lần lặp = 12 lượt; xen kẽ A,B,B,A,... (thứ tự đảo mỗi việc) để triệt trôi theo thời gian; lượt chạy tuần tự, không song song (cache và tải CPU). Bốn việc nếu ngân sách cho phép: 16 lượt.
- **Chỉ số mỗi lượt** (một tệp `insights/T-102-runs/<task>-<A|B>-r<n>.json`): `tokens` {input, cache_read, cache_write, output}, `usd`, `gate_green_first`, `returns`, `wall_s` (phụ, không dùng quyết), `model`, `source`, `seq`, `base_sha`, `start_tree_sha`, `started_at`, `git_history_peek`; bản B thêm khối `graph` {tree_sha, built_at, build_tokens, refresh_count, files_changed_after_last_refresh}. Dựng đồ thị chỉ-mã tốn 0 token LLM; nếu `build_tokens` > 0 thì cộng vào `tokens` của lượt B.
- **Ngưỡng (khoá trước khi chạy)**: `eval/T-102/thresholds.json`, sha256 `11818599e5af07c36e846d22cd14db063815553c10a04f54d55d8fec70440bbc`, `locked_at` 2026-11-08T08:00. Chỉ số chính: với mỗi việc lấy trung vị $ của B chia trung vị $ của A; trung bình các tỉ lệ; giảm = 1 − trung bình.
  - **ADOPT**: giảm >= 20%, VÀ B rẻ hơn A ở >= 2/3 số việc (làm tròn lên), VÀ gate không xấu đi (tỷ lệ xanh lần đầu của B >= của A, số lần trả trung bình của B <= của A, gộp mọi lượt).
  - **DROP**: giảm < 5%, HOẶC gate xấu đi (dù giảm bao nhiêu).
  - **INCONCLUSIVE**: các trường hợp còn lại (giảm 5% đến dưới 20%, hoặc không đủ số việc rẻ hơn). Thêm đúng một lần lặp cho mọi ô rồi tính lại, một lần; vẫn INCONCLUSIVE thì khuyến nghị **không cài**.
  - Ô có (max−min)/trung vị > 30% thì phải có lần lặp thứ 3 cho ô đó trước khi tính.
  - Sửa ngưỡng sau khi có lượt đo nào = thí nghiệm làm lại từ đầu, ghi `decisions/`.
- **Giảm nhiễu**: cùng model, cùng prompt, tối thiểu 2 lần lặp mỗi ô, trung vị thay vì trung bình, xen kẽ thứ tự, worktree mới mỗi lượt, tuần tự, ghép cặp theo việc (so B với A của chính việc đó), ngưỡng nhiễu 30% buộc thêm lần lặp. Lượt mà agent chạy `git log`/`git show`/`git diff` tới commit sau `base_sha`/`--all`/nhánh khác (đọc nghiệm đã merge) bị đánh `git_history_peek: true`, loại, chạy lại; kiểm bằng quét transcript.
- **Ngân sách**: board đặt $5. Lượt thử (pilot) = việc nhỏ nhất T-060, hai bản, một lần lặp, chạy trước. Nếu $ pilot x số lượt dự kiến (12) > $5 (`pilot_stop_usd`) thì dừng, `task.py escalate` xin Capu nâng ngân sách (tiền: hỏi trước) hoặc chấp nhận thiết kế rút gọn 3 việc x 2 bản x 1 lần lặp (6 lượt) với kết luận gắn nhãn "độ tin cậy thấp". Không tự chi quá ngân sách.

### 6. Rủi ro đồ thị cũ
Đồ thị lỗi thời trái "Sổ cái là sự thật" và làm bản B sai/đắt oan. Biện pháp bắt buộc:
- Dựng đồ thị mới từ cây sạch đúng `base_sha` ở **đầu mỗi lượt B** (không dùng lại đồ thị lượt trước); `graph.tree_sha` phải bằng `git rev-parse <base_sha>^{tree}`.
- Làm mới (`graphify update .`, cục bộ, không LLM) trước mỗi lần harness trả việc và trước lần chạy eval: `refresh_count` >= 1 + `returns`.
- Ghi `files_changed_after_last_refresh` = số file agent sửa sau lần làm mới cuối, để báo cáo nêu mức cũ trong lúc làm (agent sửa file rồi hỏi đồ thị thì thấy bản cũ của file đó; đây là chi phí thật của Graphify và nằm trong số đo).
- Báo cáo có mục riêng "Đồ thị cũ" nêu: số lần làm mới, thời gian làm mới, và với kết luận ADOPT, đề xuất cách giữ đồ thị mới trong dùng thật (không bật git hook toàn cục).

### 7. Đầu ra
`insights/T-102-graphify-do-token.md` (mẫu insight của tuần, dùng tiếng Việt), có các mục (tiêu đề chứa đúng cụm): **Khuyến nghị**, **Thiết kế**, **Kết quả**, **Ngưỡng**, **Cách cài**, **Gỡ**, **Đồ thị cũ**, **Dữ liệu gửi đi**, **Nguồn số đo**, **Rủi ro**; một dòng riêng `KẾT LUẬN: ADOPT|DROP|INCONCLUSIVE` (đúng bằng kết quả tính từ hồ sơ + ngưỡng) và một dòng `KHUYẾN NGHỊ: …`. Báo cáo kèm bảng token/$ từng lượt và từng việc. Hồ sơ lượt chạy nằm ở `insights/T-102-runs/`. Quyết dùng tiếp là của Capu: báo cáo chỉ khuyến nghị.

## Ràng buộc (vòi)
- Repo: **không sửa repo code**. Thí nghiệm chạy trên worktree của `phungrk/tohong-front` ở scratchpad, tách khỏi nhánh `main`; không đẩy nhánh, không tạo PR. Việc ghi sổ cái nằm ở `tohong-hq`: `insights/T-102-graphify-do-token.md`, `insights/T-102-runs/`, `eval/T-102/harness/` (mã chạy lượt, chỉ cho thí nghiệm này). Không sửa `scripts/`, `.claude/`.
- Vùng (`area`): `planner/front`. Bất biến đã đọc: `eval/invariants/_shared/` (INV-001 không secret trong repo, INV-002 sổ cái đọc được), `eval/invariants/planner/` (INV-001..004 vite dev chỉ qua helper, cache riêng): spec này không vi phạm; mọi lượt đo dựng vite chỉ qua helper `eval/_lib/vite_dev.cjs`. Bất biến `planner/front/*` kiểm hành vi code front, không áp cho thí nghiệm này vì không có thay đổi vào `main` của front.
- Không chạm: payment, auth, DB, dữ liệu người dùng, dịch vụ trả phí ngoài chi phí token.
- Bậc đề xuất: B (đúng board) — không đổi sản phẩm; mô hình tiền (token) nằm trong ngân sách $5, vượt thì leo thang.

## Tiêu chí chấp nhận và eval
Mọi eval đọc hồ sơ và trạng thái máy; **không** đo cách cài đặt. Trước khi thí nghiệm chạy, các eval đỏ (FAIL, thoát 1); ERROR/ngoại lệ mới là lỗi eval. Riêng 6 quét được ngay (kết quả quét xanh, FAIL chỉ vì manifest chưa có).
| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Hồ sơ đủ: báo cáo có đủ 10 mục; 3-4 việc, mỗi việc cả hai bản; mỗi lượt đủ trường (4 loại token, usd, gate lần đầu, số lần trả, nguồn số đo); usd khớp token x `pricing.json` (lệch <= 1%) | `python3 eval/T-102/check_1_ho_so.py` |
| 2 | Graphify chỉ nằm trong scratchpad: mọi đường dẫn ghi nằm dưới `scratch_root`; quét thật không dấu vết trong `tohong-hq/{.claude,scripts,templates,CLAUDE.md,handbook,routines,.github}`, `~/.claude` (trừ `projects/`), `~/.claude.json`/rc, `tohong-front/{.git/hooks,.git/config,cây làm việc}`, công cụ toàn cục uv/pipx, PATH | `python3 eval/T-102/check_2_khoanh_vung.py` |
| 3 | Gỡ sạch: `teardown_done`, thư mục thí nghiệm không còn, `git worktree list` của tohong-front không còn mục scratchpad, lệnh/tiến trình `graphify` không còn, nhật ký truy vấn không còn nếu do thí nghiệm tạo | `python3 eval/T-102/check_3_go_sach.py` |
| 4 | Ngưỡng viết trước: băm `thresholds.json` khớp băm `11818599e5af07c36e846d22cd14db063815553c10a04f54d55d8fec70440bbc` trong spec này; mọi lượt có `started_at` > `locked_at`; mục Ngưỡng của báo cáo nhắc 20%, 5%, 30% | `python3 eval/T-102/check_4_nguong_truoc.py` |
| 5 | Kết luận cơ học: dòng `KẾT LUẬN` của báo cáo = kết quả tính lại từ hồ sơ + ngưỡng; có `KHUYẾN NGHỊ` (không ADOPT thì nói rõ không cài/dùng) | `python3 eval/T-102/check_5_ket_luan.py` |
| 6 | Không dữ liệu người dùng bị gửi đi: manifest `mode=code-only`, `backend=none`, `query_log_disabled=true`; cây git ở mọi commit cơ sở không có email thật, số điện thoại VN, khoá bí mật, `.env*` | `python3 eval/T-102/check_6_khong_du_lieu_nguoi_dung.py` |
| 7 | Giảm nhiễu: một model (`claude-sonnet-5-5`) mọi lượt; >= 2 lượt mỗi ô; xen kẽ A/B; ô rộng > 30% có lần lặp thêm; không lượt nào nhìn lịch sử git | `python3 eval/T-102/check_7_giam_nhieu.py` |
| 8 | Đồ thị không cũ: `start_tree_sha` đúng cây của `base_sha`; bản B có `graph.tree_sha` = cây đó, `refresh_count` >= 1 + trả việc, `build_tokens` là số; bản A không có đồ thị | `python3 eval/T-102/check_8_do_thi_cu.py` |

Dạng eval: script (dạng 2), vì đối tượng kiểm là hồ sơ và trạng thái máy. Eval đọc số đã đo, không tự đo token, nên tiêu chí "token thật sự được đo từ nguồn đúng" dựa vào `source` và việc tái tính usd (tiêu chí 1); độ tin cậy của chính transcript là giả định.

## Bất biến đề xuất (tầng 2)
Đề xuất cho `eval/invariants/_shared/` (Spec critic cân nhắc rút vào bể): "Công cụ ngoài thử nghiệm không để lại dấu vết trong cấu hình dùng chung" — dạng `check_2` rút gọn: quét `tohong-hq/.claude`, `scripts`, `CLAUDE.md`, `~/.claude` (trừ `projects/`), `tohong-front/.git/hooks` không chứa tên công cụ thử nghiệm đã được khoanh vùng. Chưa chắc nên là bất biến vĩnh viễn (mỗi thử nghiệm sau tên khác); ghi nhận để critic quyết, tự tin ~50%.

## Không làm
- Không cài Graphify cho mọi agent, không cài vào `tohong-hq`/sổ cái/`~/.claude`/cấu hình dùng chung.
- Không gửi dữ liệu người dùng thật qua Graphify; không dùng chế độ đầy đủ (tài liệu, ảnh) của Graphify.
- Không bật `graphify hook install` (git hook), không dùng chế độ chặt Read/Grep.
- Không sửa code front trên `main`, không mở PR, không đẩy nhánh của tohong-front.
- Không đổi ngưỡng sau khi có số; không đo cách cài đặt Graphify như một sản phẩm.
- Không quyết thay Capu việc dùng tiếp: chỉ khuyến nghị.

## Câu hỏi mở
Ngân sách $5 của board có đủ không? Nếu lượt thử T-060 cho thấy 12 lượt vượt $5, Capu chọn: nâng ngân sách, hay chấp nhận 6 lượt (1 lần lặp mỗi ô) với kết luận độ tin cậy thấp. (Quyết ở lượt pilot, không chặn việc giao Engineering.)
