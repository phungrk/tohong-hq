---
type: decision
id: ADR-060
date: 2026-11-11
decided_by: capu
tasks: [T-121, T-120]
---
# Capu duyệt chạy thật lượt "chạy lại theo tên" (T-120/T-121), ~$2,65

**Bối cảnh:** PR tohong#82 (T-121) đã merge. Dry run https://github.com/phungrk/tohong/actions/runs/42977555156: `RECHECK_SCOPE eligible=49 text_search=49 media_max=98 est_net_usd=2.646`. Tổng tháng 11 sau lượt này khoảng $12,9 / trần $30 (ADR-049).

**Quyết định (Capu, 2026-11-11: "Duyệt chạy thật 49 vendor, $2,65"):** chạy `enrich-vendors.yml` với dry_run=false, recheck_name_match=true, categories=all (quy ước ở T-121: luôn chạy mọi category để G6 hội tụ), budget_usd=30, max_photos=2, cap_basis=net, include_non_pool=false.

**Không bao gồm:** self-merge. Chief of Staff gửi Capu `name-match-accepted.csv` (49 dòng) để soát, rồi PR dữ liệu và PR pool do Capu merge liền nhau (INV-021/022).
