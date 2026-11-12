---
type: decision
id: ADR-071
date: 2026-11-12
decided_by: capu
tasks: [T-126, T-127, T-130]
---
# Capu duyệt chạy thật xác nhận live 13 vendor (Place Details userRatingCount)

Dry run https://github.com/phungrk/tohong/actions/runs/43234706518: `REVIEW_SCOPE candidates=13 details_count=13 est_gross_usd=0.260 est_net_usd=0.000`. Capu 2026-11-12: "đã merge 88. chạy". Chạy `enrich-vendors.yml` dry_run=false, apply_review_rule=true, confirm_review_count=true, categories=all, budget_usd=30 (ADR-049). C-1 đã là False (T-130, #87): nơi đóng cửa vĩnh viễn thì gỡ. PR dữ liệu và PR pool do Capu merge.
