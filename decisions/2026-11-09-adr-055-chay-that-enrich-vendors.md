---
type: decision
id: ADR-055
date: 2026-11-09
decided_by: capu
tasks: [T-113, T-118]
---
# Capu duyệt chạy thật enrich toàn bộ vendor (T-113), trần $30

**Bối cảnh:** dry run trên nhánh sửa T-118 (run https://github.com/phungrk/tohong/actions/runs/42621680968, 0 request Google, $0): 799 vendor của 12 hạng mục trong pool; chi thật dự kiến $11,486, cận trên $20,728, trần $30 net (ADR-049), `within_cap=true`. Wedding planner (79) và other (81) ngoài pool, không chạy. Baseline ảnh tháng 11 là 1010 (ADR-053).

**Quyết định (Capu, 2026-11-09, "chạy"):** chạy thật `enrich-vendors.yml` với dry_run=false, budget_usd=30, categories=all, max_photos=2, cap_basis=net, include_non_pool=false — **sau khi** PR tohong#78 (T-118, bậc C) vào main.

**Không bao gồm:** self-merge. PR dữ liệu và PR pool của lần chạy do Capu merge (ADR-051 chỉ áp cho T-112). Hai PR phải merge liền nhau (INV-021/022).
