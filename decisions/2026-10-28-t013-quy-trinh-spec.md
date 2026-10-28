---
type: decision
id: ADR-003
date: 2026-10-28
decided_by: capu
tasks: [T-013]
---
# T-013: Chief of Staff chạy phần spec, Engineering chỉ hiện thực

**Quyết định:** Chief of Staff chạy `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` (kèm `/speckit-analyze` theo tiêu chí 1) trong repo `phungrk/tohong` ở phiên chính, rồi giao Engineering hiện thực theo `tasks.md`. Không sửa file agent để Engineering tự chạy skill.

**Nguồn:** Capu nhắn trong phiên 2026-10-28: "Chief of Staff chạy clariy -> tasks rồi giao Engineer".

**Lý do:** subagent `engineering` không có công cụ chạy skill (`.claude/agents/engineering.md`, dòng `tools:`); các lệnh `/speckit-…` chỉ có ở phiên chính.

**Hệ quả:** plan.md và tasks.md là sản phẩm của Chief of Staff, nên vẫn phải qua `reviewer` trước khi giao Engineering (giá trị 4).
