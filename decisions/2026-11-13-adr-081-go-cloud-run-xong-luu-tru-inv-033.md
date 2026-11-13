---
type: decision
id: ADR-081
date: 2026-11-13
decided_by: chief-of-staff
tasks: [T-144, T-140]
---
# T-140 bước 2 merge (tohong#97, tohong-back#53 — Capu "merge 97 và 53 luôn"); lưu trữ inv-033

1. `eval/invariants/planner/vendor/images/inv-033-file-matcher-dung-tap-id-pool.py` chuyển vào `_luu-tru/`: `matcher-data/vendors.json` đã bị xoá theo ADR-077, bất biến chỉ còn báo "chưa áp dụng". Không xoá, giữ lịch sử.
2. Eval tầng 1/3 của việc đã xong sẽ đỏ hoặc sai nghĩa sau merge (adversary T-144 liệt kê) — không chạy lại, coi là lỗi thời theo ADR-077: T-136 `check_a1..a4`, `check_b3_regen_ghi_file_matcher.sh`, `check_b4_workflow_dong_bo.py`; T-138 `adv-01`; T-135 `check_6`, `check_9`; T-080 `adv-03-matcher-service-dong-goi.sh`. Không sửa file nào.
3. Việc còn lại thuộc Capu: chạy khối lệnh dọn GCP trong mô tả tohong-back#53 sau khi deploy xanh (bước 4 gỡ binding gha-deployer mặc định để nguyên, đã comment).
