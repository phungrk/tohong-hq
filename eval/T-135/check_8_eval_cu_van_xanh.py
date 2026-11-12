#!/usr/bin/env python3
"""T-135 tiêu chí 8: các eval cũ chạy workflow tohong mà spec này đổi CÓ CHỦ ĐÍCH vẫn xanh, và KHÔNG ai sửa eval cũ cho khớp code (ranh giới cứng; ADR-074).
(a) Ghim: sha256 của MỌI file eval T-129 (trừ gate-latest.json, __pycache__) và của 6 eval cũ khác (T-110 check_8, T-111 check_10, T-112 adv-06, T-126 check_9, T-127 adv-02, T-134 adv-04) phải đúng `pins_eval_cu.json`.
    Bản ghim của T-129/check_5 là bản Product sửa trong lượt spec rework (ADR-074: add-paths thêm đúng enrich-report.json, kèm hệ quả cơ học: main của bản sao thử có báo cáo tươi và tình huống E áp cả hai file).
    Đổi thêm bất kỳ file nào = đỏ, phải có decisions/ mới và Product đổi trước code.
(b) Chạy nguyên văn bảy eval (T-110 check_8, T-111 check_10, T-112 adv-06, T-126 check_9, T-127 adv-02, T-129 check_5, T-134 adv-04): thoát 0.
Hôm nay: (a) xanh, (b) T-129 check_5 ĐỎ (workflow chưa thêm enrich-report.json) và xanh khi code đúng spec.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import hashlib, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
E8 = ["T-110/check_8_han_muc_request.py", "T-111/check_10_workflow.py", "T-112/adv-06-workflow-concurrency-google-places.py", "T-126/check_9_ap_nguoc_tren_nhanh_pr_du_lieu.py",
      "T-127/adv-02-workflow-apply-review-rule-chay-that.py", "T-129/check_5_workflow_tohong.py", "T-134/adv-04-workflow-ap-dung-do-khi-apply-tu-choi.py"]
bad = []
pins = json.load(open(os.path.join(t.HERE, "pins_eval_cu.json"), encoding="utf-8"))
for rel, want in sorted(pins.items()):
    p = os.path.join(t.HQ, "eval", rel)
    if not os.path.isfile(p): bad.append("%s: eval cũ bị xoá/đổi tên (ghim sha256)" % rel); continue
    if hashlib.sha256(open(p, "rb").read()).hexdigest() != want: bad.append("%s: nội dung đổi so với bản ghim (sửa eval cũ phải có decisions/ và Product làm trước code, ADR-074)" % rel)
for rel in E8:
    p = os.path.join(t.HQ, "eval", rel)
    if not os.path.isfile(p): bad.append("%s: không còn file (không được xoá eval cũ)" % rel); continue
    r = subprocess.run([sys.executable, p], env=dict(os.environ, TOHONG_REPO=t.TOHONG, **({"TOHONG_BACK_REPO": t.BACK} if t.BACK else {})), capture_output=True, text=True, timeout=600, cwd=os.path.join(t.HQ, "eval", os.path.dirname(rel)))
    if r.returncode != 0: bad.append("%s đỏ: %s" % (rel, (r.stdout.strip().splitlines() or [r.stderr[-150:]])[-1][:160]))
t.done(bad, "eval cũ không bị sửa (sha256 đúng ghim) và 7 eval cũ chạy workflow tohong vẫn xanh sau thay đổi của T-135")
