#!/usr/bin/env python3
"""T-126 tiêu chí 7 (bất biến cũ giữ nguyên; bất biến đề xuất INV-029 xanh sau khi áp ngược). OFFLINE.
A. Dữ liệu thật (tohong, nhánh main): INV-012..020 và INV-025..028 của planner/vendor/images chạy `python3 -I`, không tham số: tất cả PASS (T-126 không đề nghị sửa INV nào;
   sáu cổng và hàm chuẩn `reject_reason` KHÔNG đổi, nên INV-018 giữ). Không chạy INV-021/022 (đỏ vì PR pool của lượt trước, không liên quan T-126).
B. Repo tạm (parent=repo, tools/scraper là bản sao code thật) có 5 vendor đã nhận: 3 đọc mới (0, 1, 5 đánh giá), 1 đọc cũ lưu 1 (thật 4), 1 đọc cũ lưu 1 (thật 1).
   Trước áp ngược: bản nháp INV-029 (eval/T-126/inv-proposed-google-match-du-review.py) ĐỎ (đo được vi phạm, không "chưa áp dụng").
   Sau `--apply-review-rule --confirm-review-count`: INV-029 PASS (không "chưa áp dụng") và INV-028 PASS; vendor 5 đánh giá và vendor thật 4 đánh giá còn place_id, ba vendor còn lại không.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []


def run_inv(path, env=None):
    e = dict(os.environ)
    e.update(env or {})
    p = subprocess.run([sys.executable, "-I", path], cwd=t.HQ, env=e, capture_output=True, text=True, timeout=900)
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip().splitlines()[-1:] or [""]


allinv = t.inv_scripts(12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 26, 27, 28)
if len(allinv) != 13:
    t.fail("không đủ 13 bất biến INV-012..020, 025..028 (thấy %d)" % len(allinv))
for p in allinv:
    rc, last = run_inv(p)
    if rc != 0:
        bad.append("dữ liệu thật: %s: %s" % (os.path.basename(p), last[0][:140]))
A = k.ADDR
files = {"makeup": [k.matched("t126_z0", "Inv Zero Makeup", A % 70, "makeup", "Pz0", k.NEW_TS, None), k.matched("t126_z1", "Inv One Makeup", A % 71, "makeup", "Pz1", k.NEW_TS, 1),
                    k.matched("t126_z5", "Inv Five Makeup", A % 72, "makeup", "Pz5", k.NEW_TS, 5)],
         "photography": [k.matched("t126_o4", "Inv Old Four Photo", A % 73, "photography", "Po4", k.OLD_TS, 1), k.matched("t126_o1", "Inv Old One Photo", A % 74, "photography", "Po1", k.OLD_TS, 1)]}
PL = {"Po4": k.pl("Inv Old Four Photo", A % 73, "Po4", n=4), "Po1": k.pl("Inv Old One Photo", A % 74, "Po1", n=1)}
root = k.seed(files, parent="repo")
prop = os.path.join(k.HERE, "inv-proposed-google-match-du-review.py")
env = {"TOHONG_REPO": root.base}
rc, last = run_inv(prop, env)
if rc == 0 or "chưa áp dụng" in last[0]:
    bad.append("trước áp ngược INV-029 mong ĐỎ (có vendor giữ nhận khớp với <2 đánh giá), thấy rc=%d: %s" % (rc, last[0][:120]))
rc, out, calls = root.run(x.enrich_all("all", extra=[k.APPLY, k.CONFIRM]), x.fx(PL, []))
if rc != 0:
    t.fail("enrich %s %s thoát %d: %s" % (k.APPLY, k.CONFIRM, rc, (out.strip().splitlines() or [""])[-1][:160]))
for p in [prop] + t.inv_scripts(28):
    rc, last = run_inv(p, env)
    if rc != 0:
        bad.append("sau áp ngược: %s: %s" % (os.path.basename(p), last[0][:150]))
    elif "chưa áp dụng" in last[0]:
        bad.append("sau áp ngược: %s báo 'chưa áp dụng' (không đo được trên repo tạm)" % os.path.basename(p))
if k.ids_with_pid(root) != {"t126_z5", "t126_o4"}:
    bad.append("sau áp ngược mong chỉ z5 (5 đánh giá) và o4 (thật 4) còn place_id, thấy %r" % sorted(k.ids_with_pid(root)))
t.done(bad, "INV-012..020, 025..028 xanh trên dữ liệu thật; INV-029 (nháp) đỏ trước và xanh sau áp ngược trên repo tạm, INV-028 xanh")
