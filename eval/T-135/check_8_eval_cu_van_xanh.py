#!/usr/bin/env python3
"""T-135 tiêu chí 8: các eval cũ chạy workflow tohong mà spec này đổi CÓ CHỦ ĐÍCH vẫn xanh (không để T-135 phá việc đã xong, và không sửa eval cũ ngoài mục spec cho phép).
Nguyên văn, không tham số: T-110 check_8 (chuỗi resolve/enrich/refresh tốn <= 9 request), T-111 check_10 (enrich-vendors.yml), T-112 adv-06 (concurrency google-places), T-126 check_9, T-127 adv-02, T-129 check_5, T-134 adv-04.
Chỉ ĐƯỢC đổi (ghi ở spec, mục 'Tác động lên eval cũ'): T-129 check_5 mệnh đề add-paths của apply-admin-reviews.yml (nay gồm enrich-report.json); mọi đổi khác phải ghi decisions/.
Đỏ ở đây = T-135 làm hỏng hợp đồng cũ. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
E8 = ["T-110/check_8_han_muc_request.py", "T-111/check_10_workflow.py", "T-112/adv-06-workflow-concurrency-google-places.py", "T-126/check_9_ap_nguoc_tren_nhanh_pr_du_lieu.py",
      "T-127/adv-02-workflow-apply-review-rule-chay-that.py", "T-129/check_5_workflow_tohong.py", "T-134/adv-04-workflow-ap-dung-do-khi-apply-tu-choi.py"]
bad = []
for rel in E8:
    p = os.path.join(t.HQ, "eval", rel)
    if not os.path.isfile(p): bad.append("%s: không còn file (không được xoá eval cũ)" % rel); continue
    r = subprocess.run([sys.executable, p], env=dict(os.environ, TOHONG_REPO=t.TOHONG, **({"TOHONG_BACK_REPO": t.BACK} if t.BACK else {})), capture_output=True, text=True, timeout=600, cwd=os.path.join(t.HQ, "eval", os.path.dirname(rel)))
    if r.returncode != 0: bad.append("%s đỏ: %s" % (rel, (r.stdout.strip().splitlines() or [r.stderr[-150:]])[-1][:160]))
t.done(bad, "7 eval cũ chạy workflow tohong vẫn xanh sau thay đổi của T-135")
