# ADR-012 · Issue và Project board là mặt kính; sổ cái là sự thật

**Ngày:** 2026-11-04 · **Người quyết:** Capu ("ok, pilot thử") · **Trạng thái:** pilot trên T-063 / issue #11

## Bối cảnh

Capu đề xuất vòng đời: ý định → file + issue → Chief of Staff đọc issue để giao → PR link issue → PR merge thì issue đóng. Review (phiên 2026-11-04): nhu cầu đúng (hộp thư ý định, PR trỏ về việc, tín hiệu xong), nhưng "file đồng thời issue" tạo hai nguồn sự thật, issue không có máy trạng thái, và "merge = xong" sai với mô hình eval-gated (xong = adversary chấp nhận; việc spec không có PR).

## Quyết định

1. **Sổ cái là sự thật duy nhất.** Chỉ `task.py` đổi trạng thái. Lý do (2029): sự thật phải là thứ máy kiểm được luật, nằm trong tay agent (file, không API), chỉ ghi thêm và có lịch sử đầy đủ.
2. **Issue là mặt kính, và là chủ của ý định gốc.** Capu viết ý định vào issue (điện thoại). Chief of Staff tạo việc bằng `task.py new --issue N`. Workflow `mirror-issue` phản chiếu đúng bốn mốc lên issue: ① nhận, ② qua Spec Gate, ③ qua Code Gate, ④ xong — và đóng issue khi sổ cái ghi `done`. Escalated / done bậc C → gán Capu. Không có chiều ngược.
3. **PR ghi `Refs`, không ghi `Closes`.** Đóng issue là hệ quả của `done`, không của merge.
4. **GitHub Project là Kanban cho điện thoại**, đồng bộ một chiều từ sổ cái (`mirror_project.py`, chạy trong Actions vì Projects v2 chỉ có GraphQL). Kéo thẻ không có hiệu lực; lần sync sau kéo về. Cột: Ý định · Spec · Spec Gate · Code · Code Gate · Chờ Capu · Bị chặn · Xong. "Chờ Capu" = escalated + done bậc C + done bậc B trong 48h.
5. **Dashboard giữ vai trạng thái sống** (mô hình, bể, nhân vật). Project không làm sâu bằng dashboard.

## Hệ quả

- `task.py`: trường `issue`, `new --issue`, `evals --replace`.
- `scripts/mirror_issue.py` + `.github/workflows/mirror-issue.yml` (trạng thái ở nhánh `mirror-state`).
- `scripts/mirror_project.py`: chạy khi có `secrets.PROJECTS_TOKEN` (PAT scope `project`) và `vars.PROJECT_NUMBER`; Capu tạo Project và trường (Status với 8 option trên, Bậc, Vùng, Vòng, Cổng) một lần.
- Eval `eval/T-063/eval-mirror.py` kiểm 4 mốc, đóng khi done, không ghi sổ cái.
- Sau pilot: nếu 4 mốc quá ồn hay quá ít, chỉnh `milestone()` — không thêm chiều ngược.
