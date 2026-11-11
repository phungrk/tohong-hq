#!/usr/bin/env python3
"""T-126 tiêu chí 6 (áp ngược trên DỮ LIỆU THẬT: ảnh chụp 246 vendor có place_id Google ở tohong origin/main 62ee2f8 + PR #83 run 43026321789, đọc 2026-11-11; không do code sinh).
Snapshot eval/T-126/data_snapshot.json: {id, name, cats, place_id, ts, count (đã lưu; null = log không có rating), manual (có mục accept_place của Capu), pr83}.
Tham chiếu độc lập (tính ở đây từ snapshot, không từ code): hạ offline = ts >= 2026-11-08, (count null hoặc <= 1), không manual; cần xác nhận live = ts < 2026-11-08 và (count null hoặc <= 1), không manual; giữ = còn lại.
Khoá số thật: 246 vendor; 209 giữ; 2 duyệt tay (Én Banquet & Event Space, Thiskyhall, 0 đánh giá, ADR-048) giữ; 23 hạ offline (16 ở main + 7 trong PR #83, gồm
Thiệp cưới thơm ChIJMah3G9QodTERGCmJNNuiQ2Y và La Petite Epicerie Saigon ChIJm2jnlUbfdDER-LxA02bOZWc của Capu); 12 cần xác nhận live (6 lưu 1 + 6 không rating, cùng lần chạy 2026-06-16).
Dựng lại trạng thái "đã nhận" từ snapshot (địa chỉ gốc = địa chỉ Google; hai id chung place_id dùng chung một địa chỉ để G6 không can thiệp), chạy ĐÚNG lệnh CLI:
  (1) `--apply-review-rule` (0 request): đúng 23 id mất place_id, tập khớp tham chiếu, 7 id thuộc PR #83 gồm hai id Capu; 223 id còn lại y nguyên từng byte; sổ low-review-demoted.csv đúng 23 dòng.
  (2) `--confirm-review-count --dry-run`: REVIEW_SCOPE candidates=12 est_gross_usd=0.240.
  (3) chạy thật với Google giả (2 trong 12 nay có 3 đánh giá): đúng 12 Place Details (mask userRatingCount), 10 hạ, 2 giữ; tổng hạ = 33; ước chi gross $0,24 << phần trần còn lại ($30 - $12,60 = $17,40, ADR-061).
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
snap = json.load(open(os.path.join(k.HERE, "data_snapshot.json"), encoding="utf-8"))
V = snap["vendors"]
low = lambda v: v["count"] is None or v["count"] <= 1
off = {v["id"] for v in V if low(v) and not v["manual"] and v["ts"][:10] >= k.FRESH_FROM}
live = {v["id"] for v in V if low(v) and not v["manual"] and v["ts"][:10] < k.FRESH_FROM}
man = {v["id"] for v in V if low(v) and v["manual"]}
pr = {v["id"] for v in V if v["pr83"]}
CAPU = {"ChIJMah3G9QodTERGCmJNNuiQ2Y", "ChIJm2jnlUbfdDER-LxA02bOZWc"}
if (len(V), len(off), len(live), len(man), len(off & pr)) != (246, 23, 12, 2, 7) or {v["place_id"] for v in V if v["id"] in off & pr} < CAPU:
    t.fail("snapshot lệch số đã khoá: %d vendor, %d hạ offline, %d live, %d duyệt tay, %d offline thuộc #83" % (len(V), len(off), len(live), len(man), len(off & pr)))
addr_of_pid = {}
for v in V:
    addr_of_pid.setdefault(v["place_id"], k.ADDR % (100 + len(addr_of_pid)))
files = {}
for v in V:
    for c in v["cats"]:
        files.setdefault(c, []).append(k.matched(v["id"], v["name"], addr_of_pid[v["place_id"]], c, v["place_id"], v["ts"] if "." in v["ts"] else v["ts"] + ".000000", v["count"], cats=v["cats"], manual=v["manual"]))
root = k.seed(files)
acc = [v for v in V if v["manual"]]
root.set_overrides([t.entry(v["id"], "accept_place", place_id=v["place_id"], resolved=t.resolved(v["place_id"], k.pl(v["name"], addr_of_pid[v["place_id"]], v["place_id"], n=0)), reason="Capu duyệt tay (ADR-048)") for v in acc])
cats = "all"   # mọi category file (kể cả ngoài pool): áp ngược offline không tốn request
before = {(c, v["id"]): copy.deepcopy(v) for c, vs in files.items() for v in vs}
rc, out, calls = root.run(x.enrich_all(cats, extra=[k.APPLY]), x.fx({}, [], deny=True), key=False)
if rc != 0:
    t.fail("enrich %s thoát %d: %s" % (k.APPLY, rc, (out.strip().splitlines() or [""])[-1][:160]))
if calls:
    bad.append("áp ngược offline gọi Google %d lượt" % len(calls))
gone = {v["id"] for v in V} - k.ids_with_pid(root)
if gone != off:
    bad.append("tập bị hạ offline: %d id, mong 23; thừa %r, thiếu %r" % (len(gone), sorted(gone - off)[:3], sorted(off - gone)[:3]))
if {v["place_id"] for v in V if v["id"] in gone & pr} < CAPU:
    bad.append("hai vendor Capu (Thiệp cưới thơm, La Petite Epicerie Saigon) phải nằm trong tập bị hạ")
for (c, vid), v0 in before.items():
    if vid not in off and root.vendor(vid, c) != v0:
        bad.append("%s/%s: không thuộc diện hạ mà bản ghi đã đổi" % (c, vid))
for vid in sorted(off)[:23]:
    bad += k.demoted_state_ok(root, vid)
if sorted(r["id"] for r in k.report_rows(root)) != sorted(off):
    bad.append("%s mong đúng 23 id, thấy %d dòng" % (k.REPORT, len(k.report_rows(root))))
rcd, outd, callsd = root.run(x.enrich_all(cats, extra=[k.APPLY, k.CONFIRM, "--dry-run"]), x.fx({}, [], deny=True))
sc = x.kv(outd, "REVIEW_SCOPE")
if callsd or len(sc) != 1 or sc[0].get("candidates") != "12" or abs(float(sc[0].get("est_gross_usd", -1)) - 0.24) > 0.0006:
    bad.append("REVIEW_SCOPE mong candidates=12 est_gross_usd=0.240 với 0 lượt; thấy %r (%d lượt)" % (sc, len(callsd)))
grown = sorted(live)[:2]
PL = {}
for v in V:
    if v["id"] in live:
        PL[v["place_id"]] = k.pl(v["name"], addr_of_pid[v["place_id"]], v["place_id"], n=(3 if v["id"] in grown else min(v["count"] or 0, 1)))
shared = [p for p in {v["place_id"] for v in V if v["id"] in live} if sum(1 for v in V if v["place_id"] == p and v["id"] in live) > 1]
rcl, outl, callsl = root.run(x.enrich_all(cats, extra=[k.APPLY, k.CONFIRM]), x.fx(PL, []))
nd = [c for c in callsl if c["kind"] == "details"]
if rcl != 0 or len(callsl) != len(nd) or len(nd) != 12 or k.mask_of(callsl, "details") not in (["userRatingCount"], ["places.userRatingCount"]):
    bad.append("xác nhận live mong đúng 12 Place Details (mask userRatingCount), thấy %d lượt %r mask %r" % (len(callsl), sorted({c["kind"] for c in callsl}), k.mask_of(callsl, "details")))
gone2 = {v["id"] for v in V} - k.ids_with_pid(root)
if gone2 != off | (live - set(grown)) or len(gone2) != 33:
    bad.append("sau xác nhận live: mong 33 id đã hạ (23 + 10), 2 giữ vì nay có 3 đánh giá; thấy %d" % len(gone2))
if 12 * k.PD_USD > 30 - 12.60:
    bad.append("số học trần: 12 x 0,020 phải < 30 - 12,60")
t.done(bad, "dữ liệu thật: 23 vendor đọc mới <2 đánh giá hạ offline (gồm 2 vendor của Capu trong #83), 2 duyệt tay giữ, 12 đọc cũ xác nhận live bằng 12 Place Details ($0,24), 10 hạ + 2 giữ; 209 vendor >=2 đánh giá y nguyên")
