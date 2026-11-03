#!/usr/bin/env python3
"""T-051 tiêu chí 5: ảnh tải lỗi (404, trả HTML, cụt, 500, quá chậm) giữ link cũ và có đếm; ảnh khác không bị ảnh hưởng; lần sau thử lại và tự khỏi.
Chạy: python3 eval/T-051/check_5_anh_loi.py --back /đường/dẫn/tohong-back. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")
def pool(fm):
    return standard_pool(fm) + [vendor("marry_ggg000000007", [fm.url("/bad/slow.jpg"), fm.url("/ok/late.jpg")])]
w = Work(pool)
try:
    p = w.mirror(back, ["--timeout", "1"])
    if p.returncode != 0: fail(f"mirror phải thoát 0 dù có ảnh lỗi, thấy {p.returncode}: {p.stderr[-200:]}")
    s = need_summary(p, "mirror")
    bad = BAD_URLS + ["/bad/slow.jpg", "/ok/late.jpg"]
    if s["failed"] != len(bad): fail(f"SUMMARY failed phải = {len(bad)}, thấy {s['failed']}")
    if s["ok"] != len(OK_URLS): fail(f"ảnh tốt phải xong hết ({len(OK_URLS)}), thấy ok={s['ok']}")
    ents = w.man()["entries"]
    reasons = {}
    for path in bad:
        e = ents[w.fm.url(path)]
        if e["status"] != "failed" or not e.get("reason"): fail(f"{path} phải failed kèm reason")
        reasons[path] = e["reason"]
    if len(set(reasons[x] for x in ("/bad/404.jpg", "/bad/html.jpg"))) < 2: fail("lý do 404 và HTML phải khác nhau: " + str(reasons))
    for line_url in (w.fm.url(x) for x in BAD_URLS):
        if not any(l.startswith("FAILED ") and line_url in l for l in p.stdout.splitlines()): fail("thiếu dòng 'FAILED <url> <lý do>' cho " + line_url)
    if w.fm.hits.get("/ok/flaky.jpg", 0) < 2: fail("ảnh trả 500 lần đầu phải được thử lại (retries=2)")
    if w.fm.hits.get("/bad/404.jpg", 0) != 1: fail("404 không được thử lại (chỉ lỗi 5xx/timeout/mạng mới thử lại)")
    for l in p.stdout.splitlines():
        pass
    # rewrite: ảnh lỗi giữ nguyên link cũ, đếm khớp
    r = w.rewrite(back)
    line = next((l for l in r.stdout.splitlines() if l.startswith("REWRITE ")), "")
    d = dict(kv.split("=") for kv in line.split()[1:]) if line else {}
    vs, _ = read_pool(w.pool)
    kept = [(v, u) for v, u in refs(vs) if not u.startswith(BASE_URL)]
    if len(kept) != int(d.get("kept_original", -1)): fail(f"kept_original={d.get('kept_original')} lệch số lượt ảnh giữ link cũ {len(kept)}")
    if not all(u.startswith(w.fm.origin) for _, u in kept): fail("ảnh giữ link cũ phải đúng URL gốc")
    # lần sau: nguồn sống lại -> chạy lại thử lại ảnh lỗi; ảnh đã ok không bị tải lại
    w.fm.late_ready = True; w.fm.hits.clear()
    s2 = need_summary(w.mirror(back, ["--timeout", "1"]), "mirror lần 2")
    if w.fm.hits.get("/ok/late.jpg", 0) != 1: fail("ảnh lỗi phải được thử lại ở lần chạy sau")
    if w.man()["entries"][w.fm.url("/ok/late.jpg")]["status"] != "ok": fail("ảnh /ok/late.jpg phải thành ok khi nguồn sống lại")
    if s2["new"] != 1: fail(f"lần 2 chỉ 1 ảnh khỏi, thấy new={s2['new']}")
    ok(f"{len(bad)} ảnh lỗi: giữ link cũ, có lý do, có đếm (SUMMARY/REWRITE), thử lại lần sau")
finally:
    w.stop()
