---
type: decision
id: ADR-122
date: 2026-11-17
decided_by: capu
tasks: [T-197]
---
# Capu cho merge ngay T-197 khi xong (bỏ cửa sổ 48 giờ bậc B)

Capu: "merge 197 luôn khi xong". T-197 (bậc B, bộ lọc Status ở bảng Enrich Google Maps) được Chief merge ngay khi adversary accept, gate GREEN, PR không xung đột và chỉ chứa thay đổi của việc. Các điều kiện khác của policy merge giữ nguyên; không áp cho việc khác.

## Phụ lục (2026-11-17)
Áp cho việc cài đặt T-199 (engineering, cùng ý định T-197).

## Bổ sung (2026-11-18): T-203
Capu: "merge 203 luôn khi xong". Việc bậc B, Capu bỏ cửa sổ 48 giờ. Chief merge khi việc engineering của T-203 qua Code Gate (adversary accept, gate GREEN, PR không xung đột, PR chỉ chứa thay đổi của việc).
