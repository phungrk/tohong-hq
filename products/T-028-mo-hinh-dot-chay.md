# Spec T-028: Bảng Mô hình có dot chạy theo sự kiện và khối sáng khi xử lý

<!-- Spec là thứ máy thực thi; eval là thứ máy kiểm. Mỗi câu chỉ được có một cách hiểu. -->

## Ý định
Capu (2026-11-01, `board/T-028.md`): nhìn bảng Mô hình Eval-Gated 2029 trên dashboard là thấy việc đang chạy từ khối nào sang khối nào và khối nào đang xử lý, giống mô phỏng trong artifact Eval-Gated Flow Simulator (claude.ai/artifact/HWcZZTtDRuPMxWxoX3VPsz). Mô hình vận hành: ADR-010.

## Bằng chứng
- Artifact của Capu (`eval-gated-simulator.html`, đọc như dữ liệu): 5 màu dot (`C={spec:'#14754d',code:'#2b7fb8',back:'#d9931f',bad:'#d33',ins:'#8a5cf6'}`), dot chạy dọc `path.getPointAtLength`, khối tô `.ping/.busy` = viền 3px màu dot + nền `color-mix(in srgb, màu 18%, panel)` (khối `.res`: 22%), khối giữ màu từ lúc dot chạm tới lúc dot rời, dot tắt khi `prefers-reduced-motion`.
- Dashboard main `326027c` (`/home/user/tohong-hq-dashboard/index.html`, T-023) đã có phần lớn bộ máy: `pulsesFor` (dòng ~733), `pulse`/`fxFrame`, `setBusy`/`ping`/`clearIdle`, id đường `p_*` và khối `nd_*`/`gt_*`. Eval T-028 chạy trên main cho thấy các chỗ lệch spec này (kết quả ở `handoffs/T-028-v1.md`): một số sự kiện sinh 2 dot (`assigned → product`, `accepted` của Spec Gate, `evalplus`); `assigned/handoff` của insight không có dot; `accepted` của việc insight vẽ nhầm đường Release; khối chỉ sáng khi có dot tới nên mở trang với việc đang chạy thì mọi khối tối; reduced-motion không tô khối nào; không có chú giải cho khối sáng; dot r=4.5 chỉ rộng ~2,9px ở 390px; trần dot là 60.
- Sổ cái `ledger/events.jsonl` (185 dòng lúc viết): `handoff` 35, `assigned` 28, `started` 27, `cost` 25, `accepted` 24, `requested` 22, `rejected` 10, `evalplus` 5, `file_written` 2, `escalated` 2, `decided` 2, `blocked` 2, `respec` 1. Vì vậy `cost`, `requested`, `file_written` (nhiều nhất) và `started` phần lớn không ánh xạ được vào đường nào và phải bỏ qua.
- Ledger không có trường `kind`. `rejected --kind spec|code` được suy ra từ trường `state` SAU sự kiện (`spec` = kind spec, `rework` = kind code); `detail` không có trong kênh live. Kênh live gửi: `id, t, task, title, event, from, to, round, severity, cost, state, holder, owner, reviewer, rounds` (`scripts/live.py` `PUBLIC_EVENT_FIELDS`). `dashboard.json` có thêm `tier`, `hours_since_update` cho việc và `model.insight_reports` (T-024).
- Chưa có số liệu người dùng về bảng này (Capu là người dùng duy nhất). Mọi ngưỡng số (trần 12 dot, 7–16px, 9px, 10 giây) là GIẢ ĐỊNH, tự tin ~60%; chúng được ghi thành số cụ thể để eval đo được, đổi số thì đổi cả eval.

## Giả thuyết
Nếu mỗi sự kiện sổ cái thật chạy đúng một dot trên đúng đường và khối đang có việc tự sáng theo sổ cái thì Capu trả lời được "việc đang ở khối nào" bằng một cái nhìn vào bảng, không cần mở bảng Việc. Chỉ số: GIẢ ĐỊNH, không có số đo ngoài checklist nhìn `eval/T-028/checklist.md`. Chỉ số bảo vệ: 0 lỗi console; các bảng khác (Bản đồ luồng, nhân vật T-019) không đổi một byte.

## Hành vi (người dùng thấy gì)

### 1. Định nghĩa dùng chung
- **Khối** là phần tử `g` có id trong danh sách: `nd_intents` (Ý định), `nd_spec` (Spec Writer), `gt_spec` (Spec Gate), `nd_exec` (Agent code), `gt_code` (Code Gate), `nd_respec` (Spec rework), `nd_rework` (Code rework), `nd_capu` (Capu), `nd_kr` (Knowledge Reservoir), `nd_rel` (Release), `nd_prod` (Production), `nd_insight` (Insight), `src_data`, `src_inc`, `src_fb` (ba nguồn của Insight).
- **Việc** lấy từ danh sách việc đã gộp (`dashboard.json` + trạng thái nhận qua live, như `merged()` ở main). **Chủ việc** (owner) là trường `owner` của việc đó; việc chưa có trong `dashboard.json` thì dùng `owner` trong sự kiện live. Không biết chủ việc mà quy tắc cần chủ việc thì sự kiện bị bỏ qua (không ném lỗi).
- **Màu** gồm đúng 5 loại: `spec` `#14754d` (ý định, spec), `code` `#2b7fb8` (việc, code), `back` `#d9931f` (trả về, rework), `bad` `#d33` (lỗi, leo thang), `ins` `#8a5cf6` (eval sinh thêm, insight, đọc bể).
- **Dot** là một phần tử `circle` nằm trong `<g id="fx_f">` của `#model svg`, tâm chạy dọc đường `path` đã nêu, `fill` đúng màu của dòng ánh xạ. Một sự kiện có ánh xạ sinh **đúng một dot** (chuỗi nhiều đường thì dot đi lần lượt, mỗi lúc chỉ một dot hiện).
- **Sự kiện mới** là sự kiện (a) nhận qua kênh live sau khi trang đã vào trạng thái bình thường, hoặc (b) xuất hiện trong `dashboard.json` ở một lần tải sau lần tải đầu mà trước đó chưa từng thấy (khóa `ledger_id|task|event|t`). Sự kiện có sẵn lúc mở trang (trong `dashboard.json` lần đầu hoặc trong `snapshot` của kênh live) KHÔNG chạy dot. Một sự kiện đã chạy dot qua live rồi mới vào `dashboard.json` không chạy lần hai.

### 2. Bảng ánh xạ sự kiện sổ cái → đường → màu
Điều kiện chỉ dùng các trường: `event`, `from`, `to`, `state` (sau sự kiện), `round`, chủ việc, `tier` của việc. Dòng nào đầu tiên khớp thì dùng (các dòng không chồng nhau).

| # | Sự kiện sổ cái và điều kiện | Đường (path id), theo thứ tự | Màu dot | Khối đích (cuối đường) |
| --- | --- | --- | --- | --- |
| M1 | `assigned`, `to=product` | `p_intent_spec` | spec | `nd_spec` (giữ) |
| M2 | `assigned`, `to=engineering` | `p_gate_exec` | code | `nd_exec` (giữ) |
| M3 | `assigned`, `to=insight` | `p_src1` | ins | `nd_insight` (giữ) |
| M4 | `started`, `from=engineering`, `round ≥ 1` | `p_rework_exec` | back | `nd_exec` (giữ) |
| M5 | `handoff`, `from=product` | `p_spec_gate` | spec | `gt_spec` (giữ) |
| M6 | `handoff`, `from=engineering` | `p_exec_gate` | code | `gt_code` (giữ) |
| M7 | `handoff`, `from=insight` | `p_insight_intent` | ins | `nd_intents` (nháy) |
| M8 | `accepted`, chủ việc `product` (Spec Gate qua) | `p_gate_kr` | spec | `nd_kr` (nháy) |
| M9 | `accepted`, chủ việc `engineering`, `tier=A` hoặc `tier` rỗng (Code Gate xanh, merge) | `p_gate_rel` rồi `p_rel_res` | code | `nd_rel` (giữ ở giữa), `nd_prod` (nháy) |
| M10 | `accepted`, chủ việc `engineering`, `tier=B` hoặc `C` (chờ Capu đọc diff) | `p_gate_capu` | code | `nd_capu` (giữ) |
| M11 | `accepted`, chủ việc `insight` | `p_insight_kr` | ins | `nd_kr` (nháy) |
| M12 | `rejected`, `state=spec`, chủ việc `product` (Spec Gate chặn) | `p_gate_respec` | back | `nd_respec` (giữ) |
| M13 | `rejected`, `state=spec`, chủ việc `engineering` (Code Gate báo spec lệch) | `p_gate_respec2` | back | `nd_respec` (giữ) |
| M14 | `rejected`, `state=rework`, chủ việc `engineering` (Code Gate báo code sai) | `p_gate_rework` | back | `nd_rework` (giữ) |
| M15 | `respec` | `p_respec_spec` | spec | `nd_spec` (giữ) |
| M16 | `evalplus` | `p_gate_kr2` | ins | `nd_kr` (nháy) |
| M17 | `escalated`, `to=capu` | `p_gate_capu` | bad | `nd_capu` (giữ) |
| M18 | `decided`, `state` sau sự kiện khác `done` (Capu quyết, việc làm tiếp) | `p_capu_exec` | back | `nd_exec` (giữ) |
| M19 | (không phải dòng sổ cái) `model.insight_reports` trong `dashboard.json` tăng so với lần tải trước | `p_src1` rồi `p_insight_intent` | ins | `nd_insight` (giữ ở giữa), `nd_intents` (nháy) |

**Bỏ qua (không dot, không lỗi console):** mọi dòng không khớp bảng trên. Gồm rõ ràng: `rejected` mà `state` sau sự kiện không phải `spec`/`rework` (lỗi `minor` có `state=review`; `state=escalated` vì dòng `escalated` đi liền sau đã vẽ; `state=rework` của việc product); `blocked`, `unblocked`, `cost`, `requested`, `file_written`, `board_edited_directly`; `decided` có `state=done`; `assigned` tới `chief-of-staff` hay bộ phận khác ngoài product/engineering/insight; `started` không phải của engineering hoặc `round=0`; `handoff` từ `chief-of-staff` hay bộ phận khác; `accepted` của việc `chief-of-staff` hoặc không biết chủ việc; `escalated` mà `to` khác `capu`. Các đường `p_kr_spec`, `p_kr_gate`, `p_res_insight`, `p_capu_res`, `p_src2`, `p_src3` không có sự kiện sổ cái tương ứng nên không bao giờ có dot (vẫn vẽ như hiện có).

### 3. Dot chạy thế nào
- Mỗi chặng (một đường) dot chạy từ đầu đường tới cuối đường trong 0,7 đến 2,8 giây (khuyến nghị 1,4). Khi khối nguồn không đang chờ dot khác, dot xuất hiện trong vòng 1,5 giây sau khi trang nhận sự kiện.
- Dot không rời một khối **giữ** sớm hơn 1,0 giây sau khi dot trước đó tới khối ấy; nếu chưa đủ thì dot chờ (đã hiện nhưng đứng ở đầu đường, hoặc chưa hiện).
- Kích thước hiển thị: đường kính 7 đến 16 px ở mọi bề ngang từ 320 đến 1920 px (nên bán kính trong hệ toạ độ SVG phải bù theo độ co của svg).
- Giới hạn: tại mọi thời điểm số `circle` trong `#fx_f` (kể cả dot đang chờ) không quá **12**. Sự kiện đến khi đã đủ 12 thì dot của nó bị bỏ, không xếp hàng. Dot xong thì phần tử bị gỡ; không có dot treo.
- Khung hình không bị giật: không có khoảng cách giữa hai khung hình liên tiếp quá 300 ms khi dồn 40 sự kiện cùng lúc.

### 4. Khối "đang xử lý" (khối sáng)
Khối **sáng** nghĩa là: đường viền 3px màu M và nền `color-mix(in srgb, M 18%, var(--panel))` (riêng `nd_kr` và `nd_prod`: 22%), như artifact. Khối **tắt** là kiểu mặc định hiện có. Khối sáng khi **A hoặc B**:

- **A. Sổ cái có việc ở khối đó** (không cần dot). Chỉ các khối sau có quy tắc này:

  | Khối | Có việc khi tồn tại việc thỏa | Màu khi chỉ có A |
  | --- | --- | --- |
  | `nd_spec` | chủ việc `product`, `state` ∈ {`doing`, `rework`} | spec |
  | `gt_spec` | chủ việc `product`, `state=review` | spec |
  | `nd_respec` | `state=spec` (mọi chủ việc) | back |
  | `nd_exec` | chủ việc `engineering`, `state=doing` | code |
  | `nd_rework` | chủ việc `engineering`, `state=rework` | back |
  | `gt_code` | chủ việc `engineering`, `state=review` | code |
  | `nd_capu` | `state=escalated` (mọi chủ việc), hoặc `state=done` với `tier` ∈ {B, C} và `hours_since_update < 48` | bad nếu có việc `escalated`, ngược lại code |
  | `nd_insight` | chủ việc `insight`, `state` ∈ {`doing`, `rework`} | ins |

  `hours_since_update` lấy từ `dashboard.json`; việc vừa đổi trạng thái qua live tính là 0. Việc `new`, `blocked`, việc của `chief-of-staff`, việc `done` bậc A hoặc quá 48 giờ không làm khối nào sáng. Các khối còn lại (`nd_intents`, `nd_kr`, `nd_rel`, `nd_prod`, `src_*`) không có quy tắc A.
- **B. Khối đang giữ dot.** Khối loại **giữ** (`nd_spec`, `gt_spec`, `nd_respec`, `nd_exec`, `nd_rework`, `gt_code`, `nd_capu`, `nd_rel`, `nd_insight`) sáng từ lúc dot **chạm** tới (cuối đường) cho tới lúc dot khác **rời** khỏi nó (đầu đường có khối đó làm khối nguồn) hoặc quá **10 giây** kể từ lúc dot chạm tới, cái nào đến trước. Khối loại **nháy** (`nd_intents`, `nd_kr`, `nd_prod`, `src_*`) sáng **0,6 giây** từ lúc dot chạm tới rồi tắt. Màu khi B là màu của dot vừa chạm tới.

Hệ quả (đều phải đúng): khi dot rời mà sổ cái không còn việc ở khối nguồn thì khối nguồn tắt ngay lúc dot rời; hai việc cùng trong một cổng, một việc đi ra thì cổng vẫn sáng (vì A); khối rảnh không tô; mở trang giữa lúc có việc đang chạy thì các khối có việc sáng ngay, không có dot nào. Khi vừa A vừa B thì lấy màu B cho tới khi B hết, sau đó về màu A.

### 5. Chú giải
Dưới bảng có chú giải (`#model .mlegend`) gồm 5 chấm màu, mỗi chấm kèm chữ: `ý định / spec`, `việc / code`, `trả về / rework`, `lỗi / leo thang`, `eval sinh thêm / insight / đọc bể`; và một câu có đúng cụm **"khối sáng"** và **"đang xử lý"**, nội dung: `Khối sáng = đang xử lý (có việc ở đó hoặc dot vừa tới)`. Dòng `#model-live` giữ như hiện có: kênh live bật thì chứa "trực tiếp", kênh live tắt thì chứa "sau mỗi lần tải".

### 6. Các tình huống
- **Không có sự kiện:** không `circle` nào được tạo trong `#fx_f` (kể cả sau 7 giây); khối sáng/tắt chỉ theo A.
- **Tải lại trang (hoặc kênh live nối lại và gửi `snapshot`):** sự kiện cũ không phát lại thành dot. Khối có việc sáng ngay theo A.
- **Kênh live tắt hoặc mất:** vẫn đúng mọi thứ trên; dot chỉ đến từ sự kiện mới xuất hiện giữa hai lần tải `dashboard.json` (mỗi 60 giây); `#model-live` nói "sau mỗi lần tải".
- **`prefers-reduced-motion: reduce`:** không tạo `circle` nào. Mỗi sự kiện có ánh xạ coi như dot tới ngay: khối nguồn được nhả ngay, khối đích sáng ngay theo B (cùng thời lượng nháy 0,6 giây và giữ tối đa 10 giây; chuỗi M9/M19 thì khối giữa nháy 0,6 giây rồi khối cuối nháy 0,6 giây). Không có chuyển động nào khác thêm vào.
- **Màn hình 390px:** trang không cuộn ngang; svg rộng từ 300 đến 390px nằm trong khung nhìn; số đếm trên khối (`.n` của `nd_*`) hiển thị ≥ 9px; chú giải nằm trọn trong màn hình, chữ ≥ 11px; dot vẫn chạy đúng đường và đường kính 7–16px; khối sáng đúng như ở desktop.
- **Dữ liệu thiếu (không có `state`, không rõ chủ việc, việc không có trong `dashboard.json`, thiếu `model`):** không ném lỗi, bảng vẫn vẽ, sự kiện không đủ thông tin thì bỏ qua.

## Ràng buộc (vòi)
- Repo: `phungrk/tohong-hq-dashboard` · Nhánh: `t-028-mo-hinh-dot-chay` (Engineering điền) · Vùng (`area`): `dashboard/model`.
- Bất biến của vùng đã đọc: `eval/invariants/dashboard/model/` chưa tồn tại (chưa có bất biến cho vùng này; T-023 dùng vùng `hq/dashboard`, cũng chưa có thư mục bất biến). Spec này không mâu thuẫn bất biến nào. Bất biến `eval/invariants/front/layout/` thuộc repo `tohong-front`, không áp dụng cho repo dashboard.
- Kiến trúc: giữ nguyên một file `index.html` tĩnh, d3 như hiện tại. Không thêm thư viện, không thêm yêu cầu mạng tới host ngoài {cdnjs d3, fonts Google, raw.githubusercontent.com, tohong-live}, không âm thanh. Không đổi schema `dashboard.json` (chỉ đọc các trường đã xuất ở T-024). Không sửa Bản đồ luồng và nhân vật (T-019), không sửa `tests/characters.js`.
- Thay đổi so với T-023 (đây là các chỗ spec này cố ý đổi): một sự kiện một dot (T-023 bắn 2–5 dot); khối sáng theo sổ cái (T-023 chỉ sáng khi có dot); trần dot 12 (T-023: 60); reduced-motion tô khối (T-023: không làm gì); dot bù kích thước; thêm chú giải khối sáng; bỏ `clearIdle` (thay bằng quy tắc A+B và trần 10 giây). `tests/model.js` (T-023) phải vẫn xanh; nếu một ý của nó mâu thuẫn với spec này thì trả về `spec`, không sửa test cho khớp code. Các eval đối kháng `eval/T-023/adv-02.sh` (S6, S7, S9) và `adv-03.sh` (S10, S11) mô tả hành vi nhiều dot của T-023 và sẽ đỏ nếu chạy lại sau khi T-028 merge: việc đó của Chief of Staff phân xử (ghi `decisions/`), không phải của Engineering.
- Không chạm payment, auth, DB, dữ liệu người dùng. Không gửi gì ra ngoài.
- Bậc lưới lọc đề xuất: **A** (đúng bậc Capu đặt): UI tĩnh, eval tự động phủ 9/10 tiêu chí, phần nhìn có checklist.
- Chạy eval cần Playwright (`NODE_PATH=$(npm root -g)`) và d3 cục bộ (`D3=/đường/dẫn/d3.min.js`, cdnjs có thể bị chặn trong sandbox).

## Hợp đồng quan sát (để eval đọc được; không ép cách cài đặt)
| Phần tử | Nội dung |
| --- | --- |
| Bảng | `#model`, svg là `#model svg` |
| Khối | `g` có id như mục 1; hình chính của khối là con trực tiếp đầu tiên kiểu `rect` (khối chữ nhật) hoặc `circle` (cổng); "sáng" đo bằng `stroke-width` tính ra (computed) ≥ 2,5px, `stroke` và `fill` tính ra khớp mục 4 |
| Đường | `path` có id `p_*` trong `#model svg` (id giữ nguyên như main) |
| Lớp dot | `<g id="fx_f">`; mỗi dot là `circle` con, hiện khi `opacity` tính ra > 0,05 |
| Chú giải | `#model .mlegend`; chấm là phần tử rộng ≤ 16px có `background-color`; dòng trạng thái kênh `#model-live` |
| Số đếm | `.n` trong `#nd_exec` |

## Tiêu chí chấp nhận và eval
Lệnh chung (cwd `/home/user/tohong-hq`): `bash eval/T-028/run.sh <thư-mục-repo-dashboard>`; thêm `--criterion N` để chạy một tiêu chí. In từng dòng `PASS/FAIL Cn …` rồi `PASS` hoặc `FAIL …`, mã thoát 0/1. Dữ liệu và kênh live đều giả.

| # | Tiêu chí (có/không) | Eval |
| --- | --- | --- |
| 1 | Với từng dòng M1–M18, một sự kiện live tương ứng sinh đúng một dot, đi từ đầu tới cuối đúng đường (hoặc chuỗi đường) ghi trong bảng, mỗi chặng 0,7–2,8 giây, dot hiện trong 1,5 giây; M19 và sự kiện mới giữa hai lần tải (kênh live tắt) cũng có dot; 18 loại sự kiện "bỏ qua" không sinh dot nào | `bash eval/T-028/run.sh <repo> --criterion 1` |
| 2 | Màu của mọi dot đúng cột "Màu dot" (đo `fill` tính ra) | `… --criterion 2` |
| 3 | Khối sáng đúng quy tắc mục 4: khối đích sáng đúng màu, viền 3px, nền 18% (22% với `nd_kr`/`nd_prod`) lúc dot chạm; nháy thì tắt sau 0,6 giây; giữ thì còn sáng, tắt tối đa 10 giây (M3); khối nguồn tắt khi dot rời và sổ cái hết việc; hai việc trong cổng; khối có việc sáng không cần dot; khối rảnh không tô; dot rời không sớm hơn 1,0 giây sau lúc dot trước tới | `… --criterion 3` |
| 4 | Có chú giải đủ 5 chấm màu có chữ và câu có "khối sáng" và "đang xử lý" | `… --criterion 4` |
| 5 | Không dot khi không có sự kiện (7 giây, kể cả có sự kiện cũ trong `dashboard.json` và `snapshot`); không phát lại sự kiện cũ; sự kiện đã qua live không chạy lần hai khi vào `dashboard.json`; dồn 40 sự kiện thì ≤ 12 `circle`, vẫn có dot, không giật, sạch sau khi xong; `#model-live` đúng với kênh bật/tắt | `… --criterion 5` |
| 6 | `prefers-reduced-motion: reduce`: không `circle` nào; khối vẫn sáng theo A và theo B (đích sáng, nguồn nhả, nháy rồi tắt) | `… --criterion 6` |
| 7 | 390px: không cuộn ngang, svg 300–390px trong màn hình, số đếm ≥ 9px, chú giải trong màn hình chữ ≥ 11px, dot đúng đường và đường kính 7–16px, khối sáng; ở 1280px dot cũng 7–16px | `… --criterion 7` |
| 8 | 0 lỗi console/pageerror trong toàn bộ eval; chỉ một thẻ script ngoài (d3 cdnjs); không link ngoài mới; mọi request mạng chỉ tới host đã có | `… --criterion 8` |
| 9 | Mọi phần ngoài `#model` (Bản đồ luồng, nhân vật T-019, các bảng khác) giống hệt bản đối chứng (`BASE_REF`, mặc định merge-base với `origin/main`) dưới cùng dữ liệu | `… --criterion 9` |
| 10 | Thư mục `docs/screenshots/T-028/` của repo dashboard, đã commit ở `HEAD`, có đủ 9 ảnh PNG: `idle`, `lit-by-state`, `dot-spec`, `dot-code`, `dot-back`, `dot-bad`, `dot-ins`, `reduced-motion`, `phone-390` (`phone-390.png` rộng đúng 390px). Tạo bằng `bash eval/T-028/run.sh <repo> --shots <repo>/docs/screenshots/T-028` | `… --criterion 10` |
| (nhìn) | Phần máy không đo được: dot có "chạy mượt, dễ theo dõi", màu viền/nền dễ phân biệt, chú giải dễ hiểu, dark mode, 390px đọc thoải mái | `eval/T-028/checklist.md` (checklist, vì cảm nhận thị giác không đo được bằng máy) |

## Bất biến đề xuất (tầng 2)
Vùng `dashboard/model`, mỗi cái viết được thành eval chạy được từ các ca của `eval/T-028/model-dots.cjs`:
1. **Không dot giả:** mở bảng với dữ liệu bất kỳ và không có sự kiện mới thì không `circle` nào xuất hiện trong `#fx_f` (ca S2).
2. **Trần dot:** không bao giờ quá 12 `circle` trong `#fx_f`, và `#fx_f` rỗng sau khi mọi dot xong (ca B1, B4).
3. **Dot trên đường:** mọi dot nằm trên một đường `p_*` của `#model svg` và có `fill` thuộc đúng 5 màu `#14754d #2b7fb8 #d9931f #d33 #8a5cf6`.
4. **Không kẹt sáng:** khối không có việc theo sổ cái và không nhận dot trong 10 giây thì tắt (ca M3 và S4).
5. **Reduced-motion không chuyển động:** `prefers-reduced-motion: reduce` thì không `circle` trong `#fx_f` (ca RM2).
6. **Không cuộn ngang ở 390px** của trang dashboard (ca P1).

## Không làm
- Mô phỏng giả lập theo tham số như artifact (thanh trượt tốc độ, KPI, chế độ Scrum, tạo sự kiện giả).
- Đổi schema `dashboard.json` hay `export_dashboard.py` (muốn có sự kiện cho các đường chưa có dot thì tách việc riêng ở `tohong-hq`).
- Âm thanh. Làm lại T-021 (đang dừng). Sửa Bản đồ luồng, nhân vật T-019, bảng Việc.
- Sửa các eval T-023 (việc đã đóng).

## Câu hỏi mở
Các đường `p_kr_spec` và `p_kr_gate` (đọc bể), `p_res_insight` (sự cố → Insight) và `p_capu_res` (Capu merge bậc C) hiện không có dòng sổ cái nào tương ứng nên sẽ không bao giờ có dot; Capu có muốn tạo thêm sự kiện sổ cái cho chúng (một việc riêng ở `tohong-hq`) không, hay để vậy? Nếu không trả lời, spec giữ nguyên như trên.
