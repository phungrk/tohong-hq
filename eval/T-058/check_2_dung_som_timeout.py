#!/usr/bin/env python3
"""T-058 tiêu chí 2: nguồn treo (50/50 timeout): dừng sớm nhanh, mã 4, không thử lại timeout trong mẫu, không gọi URL thứ 51+, huỷ yêu cầu đang chạy, manifest/pool nguyên.
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_2_dung_som_timeout.py --back /home/user/tohong-back"""
import os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")

# A. 50 URL treo rồi 30 URL tốt. --timeout 1, 4 luồng: 13 đợt × 1 giây.
# Sau 50 URL treo có 2 entry ok (1 đã có file = reused, 1 thiếu file nhưng Pages giả có = restored): được xử lý bình thường trong lúc chờ mẫu.
e = Env(["/hang/%d" % i for i in range(50)] + ["/ok/r1.png", "/ok/r2.png"] + ["/ok/%d.png" % i for i in range(30)], hang_secs=4)
try:
    f1, f2 = "v/marry_0050-111111111111.webp", "v/marry_0051-222222222222.webp"
    write_manifest(e.manifest, {e.fk.url("/ok/r1.png"): ok_entry(f1), e.fk.url("/ok/r2.png"): ok_entry(f2)})
    os.makedirs(os.path.join(e.out, "v"), exist_ok=True); open(os.path.join(e.out, f1), "wb").write(WEBP)
    man0, pool0 = e.man_bytes(), e.pool_bytes()
    pr, lines, secs = e.stream(back, ["--timeout", "1", "--restore-from", e.fk.url("/webp")])
    d, _ = need_stop(type("P", (), {"returncode": pr.returncode, "stdout": "\n".join(l for _, l in lines), "stderr": pr.stderr.read()})(), e, 50, "timeout", pool0, man0)
    if (d.get("reused"), d.get("restored"), d.get("ok"), d.get("failed")) != ("1", "1", "2", "50"): fail("entry ok sau URL thứ 51 phải được xử lý trong lúc chờ mẫu: reused=1 restored=1 ok=2 failed=50, thấy " + str(d))
    if secs > 25: fail("dừng sớm mất %.1f giây: phải ≤ ceil(50/4)×timeout cộng vài giây (≤ 25 giây với --timeout 1)" % secs)
    hits = e.fk.paths_hit()
    for i in range(50):
        n = hits.count("/hang/%d" % i)
        if n != 1: fail("/hang/%d bị gọi %d lần: lỗi timeout trong mẫu không được thử lại (phải đúng 1)" % (i, n))
    if any(p.startswith("/ok/") and p not in ("/ok/r1.png", "/ok/r2.png") for p in hits): fail("URL thứ 51 trở đi bị gọi trước khi quyết định dừng")
    if os.path.exists(e.manifest): fail("dừng sớm không được tạo manifest")
    last = [x for x in progress_lines([l for _, l in lines])][-1]
    if (last[0], last[2], last[3], last[4]) != (52, 2, 50, {"timeout": 50}): fail("PROGRESS cuối phải done=52 ok=2 failed=50 (timeout=50): " + last[5])
finally:
    e.stop()

# B. huỷ yêu cầu đang chạy: entry ok cũ thiếu file ở đầu danh sách, khôi phục từ nguồn treo (--timeout 10, thử lại 2 lần = 30 giây nếu không huỷ);
#    50 URL 403 phía sau xong trong chốc lát -> phải thoát trong vài giây, không đợi yêu cầu khôi phục.
e = Env(["/ok/restore.png"] + ["/forbid/%d" % i for i in range(50)], hang_secs=40)
try:
    write_manifest(e.manifest, {e.fk.url("/ok/restore.png"): ok_entry("v/marry_0000-aaaaaaaaaaaa.webp")})
    man0, pool0 = e.man_bytes(), e.pool_bytes()
    t = time.time()
    p = e.mirror(back, ["--timeout", "10", "--restore-from", e.fk.url("/hang")], timeout=60)
    if time.time() - t > 12: fail("không huỷ yêu cầu khôi phục đang treo: thoát sau %.1f giây" % (time.time() - t))
    need_stop(p, e, 50, "http-403", pool0, man0)
finally:
    e.stop()
ok("50/50 timeout dừng sớm nhanh, không thử lại, không gọi URL 51+, huỷ yêu cầu treo")
