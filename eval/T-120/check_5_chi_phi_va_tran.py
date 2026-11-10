#!/usr/bin/env python3
"""T-120 tiêu chí 5 (chạy lại tốn bao nhiêu và không vượt trần). OFFLINE (Google giả, dữ liệu thật của run 42635049304). Đơn giá như T-111: Text Search $0,040, ảnh (media) $0,007 mỗi request.
  (a) `enrich.py ... --recheck-name-match --dry-run`: 0 lượt Google, không file nào đổi, in ĐÚNG MỘT dòng
      `RECHECK_SCOPE eligible=<n> text_search=<n> media_max=<n> est_gross_usd=<x> est_net_usd=<y>` với eligible=49, text_search=49 (mỗi vendor đủ điều kiện 1 lượt, không lượt 2),
      media_max=98 (49 x max_photos=2), est_gross_usd = 0,040 x 49 + 0,007 x 98 = 2,646 (sai số 0,01), 0 <= est_net_usd <= est_gross_usd;
  (b) chạy thật với `--cap-basis gross --budget-usd 1.0`: tổng đơn giá (GOOGLE_USAGE: 0,040 x text_search + 0,007 x photo_media) <= 1,0, đã làm được ít nhất 10 vendor, chưa hết 49;
      vendor chưa làm y nguyên (còn low_confidence, 0 lượt);
  (c) lưu log lần (b) như workflow rồi chạy tiếp với `--budget-usd 30`: không hỏi lại vendor đã làm; cộng hai lần đúng 49 lượt Text Search và 98 media, tổng gross <= 2,70; đủ 49 vendor được nhận;
  (d) ước tính trong spec: gross 2,646 cộng chi net đã có 10,21 USD < trần 30 USD (kiểm số học trên hằng số của spec).
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
t, x = h.t, h.x
bad = []
root, rows, FX, dropped = h.prepare()
el, _ = h.ref_eligible(rows)
want = {r["id"] for r in el}
tree0 = root.tree()
rc, out, calls = root.run(h.recheck_argv(rows, extra=["--dry-run"]), FX, timeout=900)
if rc != 0:
    t.fail("--dry-run thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))
sc = x.kv(out, "RECHECK_SCOPE")
if calls:
    bad.append("--dry-run gọi Google %d lượt" % len(calls))
if root.tree() != tree0:
    bad.append("--dry-run làm đổi file")
if len(sc) != 1:
    bad.append("mong đúng 1 dòng RECHECK_SCOPE, thấy %d" % len(sc))
else:
    d = sc[0]
    try:
        if (int(d["eligible"]), int(d["text_search"]), int(d["media_max"])) != (49, 49, 98):
            bad.append("RECHECK_SCOPE eligible/text_search/media_max mong 49/49/98, thấy %s/%s/%s" % (d["eligible"], d["text_search"], d["media_max"]))
        g, n = float(d["est_gross_usd"]), float(d["est_net_usd"])
        if abs(g - 2.646) > 0.01 or not (0 <= n <= g + 1e-9):
            bad.append("est_gross_usd mong 2,646 (0,040 x 49 + 0,007 x 98), thấy %s; est_net_usd %s phải trong [0, gross]" % (g, n))
    except (KeyError, ValueError) as e:
        bad.append("RECHECK_SCOPE thiếu/sai trường: %r" % (e,))
rc1, out1, calls1 = root.run(h.recheck_argv(rows, budget="1.0", extra=["--cap-basis", "gross"]), FX, timeout=900)
x.save_log(root, "run-recheck-1.log", out1)
u1 = t.usage(out1) or {}
cost1 = 0.04 * u1.get("text_search", 0) + 0.007 * u1.get("photo_media", 0)
if cost1 > 1.0 + 1e-9 or not (10 <= u1.get("text_search", 0) < 49):
    bad.append("trần gross 1,0: chi %.3f, text_search=%s; mong <= 1,0 và 10 <= text_search < 49" % (cost1, u1.get("text_search")))
done1 = {k[1] for k, a in h.all_audit(root).items() if a.get("status") == "enriched"}
if not done1 <= want or len(done1) != u1.get("text_search"):
    bad.append("sau lần 1: %d vendor được nhận (mong <= tập 49 và bằng số lượt %s)" % (len(done1), u1.get("text_search")))
rc2, out2, calls2 = root.run(h.recheck_argv(rows), FX, timeout=900)
x.save_log(root, "run-recheck-2.log", out2)
u2 = t.usage(out2) or {}
tot_ts, tot_md = u1.get("text_search", 0) + u2.get("text_search", 0), u1.get("photo_media", 0) + u2.get("photo_media", 0)
if (tot_ts, tot_md) != (49, 98) or u2.get("text_search") != 49 - u1.get("text_search", 0):
    bad.append("sau hai lần: mong tổng 49 Text Search / 98 media và lần 2 chỉ làm phần còn lại; thấy %d/%d, lần 2 text_search=%s" % (tot_ts, tot_md, u2.get("text_search")))
repeat = [q for q in x.queries(calls2) if any(h.fold(r["name"]) in h.fold(q) for r in el if r["id"] in done1)]
if repeat:
    bad.append("lần 2 hỏi lại vendor đã được nhận ở lần 1 (%d lượt)" % len(repeat))
got = {k[1] for k, a in h.all_audit(root).items() if a.get("status") == "enriched"}
if got != want:
    bad.append("sau hai lần: tập được nhận %d, mong 49" % len(got))
if not (2.646 + 10.21 < 30):
    bad.append("số học trần: 2,646 + 10,21 phải < 30")
t.done(bad, "chạy lại ước tính 49 Text Search + 98 ảnh = $2,646 gross; dry-run in RECHECK_SCOPE; trần chặn đúng, tiếp tục không đếm đôi")
