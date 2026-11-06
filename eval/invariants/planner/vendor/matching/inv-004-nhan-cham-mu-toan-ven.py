#!/usr/bin/env python3
"""Nguồn: T-074 (spec products/T-074-bo-eval-top5.md v3, mục "Định dạng file nhãn", "Quy trình chấm mù" bước 6, "Bất biến đề xuất" 1;
quyết định Capu 2026-11-06 inbox/capu/T-074-dinh-nghia-phu-hop-va-cach-do.md; qua Spec Gate lần 3 2026-11-06, spec-critic; bản nháp ở D2).
INV-004 · Nhãn chấm mù của bộ đo matching luôn toàn vẹn:
  nếu eval/T-074/labels.json tồn tại thì
  (i)  nó là nhãn thật (is_sample = false): nhãn giả lập không bao giờ được đứng ở chỗ của nhãn thật;
  (ii) nó qua `node eval/T-074/match_eval.mjs --validate`: 3-5 người chấm id khác nhau, mỗi người external và khai
       saw_system_scores=false, touched_matching_weights=false; mỗi nhãn ghi một người chấm có trong graders; không nhãn trùng;
       không trường lạ (không dữ liệu cá nhân); profiles_sha khớp eval/T-074/profiles.json hiện tại (hồ sơ không bị sửa sau khi chấm).
  Không có labels.json: PASS "chưa có nhãn" (chưa có gì để hỏng).
Cố ý KHÔNG rút "không tụt so với baseline" thành bất biến: đó là ngưỡng chất lượng phụ thuộc phủ nhãn người, đổi pool (T-073)
có thể làm nó đỏ vì thiếu nhãn chứ không vì matching kém, và đỏ tầng 2 buộc spec rework cho việc không liên quan.
Chạy: python3 -I <file>. Thư mục bộ đo: T074_DIR (mặc định <sổ cái>/eval/T-074). Mã thoát 0 = đạt."""
import json, os, shutil, subprocess, sys

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
d = os.path.abspath(os.environ.get("T074_DIR") or os.path.join(HQ, "eval", "T-074"))
labels = os.path.join(d, "labels.json")
if not os.path.isfile(labels):
    print("PASS chưa có nhãn (eval/T-074/labels.json không tồn tại)"); sys.exit(0)

try:
    doc = json.load(open(labels, encoding="utf-8"))
except Exception as e:
    print(f"FAIL INV-004 không đọc được {labels}: {e}"); sys.exit(1)
if not isinstance(doc, dict) or doc.get("is_sample") is not False:
    print("FAIL INV-004 eval/T-074/labels.json phải là nhãn thật (is_sample=false); nhãn mẫu để ở file khác"); sys.exit(1)

node = shutil.which("node")
tool = os.path.join(d, "match_eval.mjs")
if not node or not os.path.isfile(tool):
    print("FAIL INV-004 có labels.json nhưng không kiểm được (thiếu node hoặc match_eval.mjs)"); sys.exit(1)
r = subprocess.run([node, tool, "--validate", labels], capture_output=True, text=True, timeout=120)
out = (r.stdout + r.stderr).strip()
if r.returncode != 0:
    print(f"FAIL INV-004 nhãn chấm mù không toàn vẹn:\n{out}"); sys.exit(1)
print(f"PASS INV-004 {out.splitlines()[-1] if out else ''}")
