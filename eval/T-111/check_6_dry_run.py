#!/usr/bin/env python3
"""T-111 tiêu chí 1 và 3 (dry-run in con số trước). OFFLINE. Fixture: 20 vendor venue + 20 vendor wedding_attire (trong pool) + 5 vendor category `other` ngoài pool + 1 dòng audit no_match cũ.
`enrich.py ... --dry-run`: 0 lượt Google (fixture deny), không cần khoá, không đổi byte nào trong output/, thoát 0. In:
  DRY_RUN_SCOPE category=<c> … (xem check_1) ; DRY_RUN_COST text_search=<n> photo_requests=<n> expected_net_usd expected_gross_usd upper_net_usd upper_gross_usd cap_usd basis
  DRY_RUN_PLAN category=<c> cum_expected_usd=<x> (tích luỹ theo thứ tự chạy, theo cơ sở của --cap-basis)
  DRY_RUN_VERDICT basis cap_usd expected_usd upper_usd within_cap=<true|false> stops_after=<category|none>
Công thức (thực, không làm tròn giữa chừng): N = vendor trong phạm vi (eligible trong pool; +ngoài pool khi --include-non-pool); retry_only = dòng no_match cũ.
  expected: text_search = N x (1 + 0,15) + retry_only ; photo_requests = N x 0,60 x max_photos.   upper: text_search = N + ceil(N x 0,30) + retry_only ; photo_requests = N x max_photos.
  net/gross theo giá 0,040 / 0,007; net TÍCH LUỸ cùng công thức check_5 (đã dùng 950 trong fixture); gross của ĐỢT chỉ cộng log T-110/T-111 (fixture không có). stops_after = category CUỐI CÙNG mà số tích luỹ expected <= trần ("none" nếu ngay category đầu đã vượt).
Mong đợi: số trong DRY_RUN_COST, DRY_RUN_PLAN, DRY_RUN_VERDICT khớp công thức (sai số 0,01 $, 1 lượt); trần 1,50 (hết hạn mức miễn phí) cho stops_after=venue; trần 30 cho none;
`--include-non-pool` thêm đúng 5 vendor ngoài pool vào phạm vi. Spec: products/T-111-enrich-toan-bo-vendor.md, "Dry-run". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []


def build():
    a = [x.V("v%02d" % i, "Nhà hàng Vee%02d Sao" % i, i + 1, ("venue",)) for i in range(20)]
    b = [x.V("w%02d" % i, "Áo cưới Wee%02d Sao" % i, i + 1, ("attire",)) for i in range(20)]
    o = [x.V("o%02d" % i, "Dịch vụ Oh%02d Sao" % i, i + 1, ("other",)) for i in range(5)]
    old = x.V("old1", "Nhà hàng Cũ Mèm Lắm", 90, ("venue",))
    r = t.Root({"venue": a + [old], "wedding_attire": b, "other": o})
    r.write("venue/enrichment-audit.json", [{"vendor_id": "old1", "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None}])
    x.usage_logs(r, ts=950, baseline_photos=950)
    return r


def run(r, cap, basis, extra=()):
    before = r.tree()
    rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire", "other"], budget=cap, basis=basis, extra=["--dry-run"] + list(extra)), x.fx({}, [], deny=True), key=False)
    if rc != 0:
        bad.append("dry-run thoát %d: %s" % (rc, out.strip().splitlines()[-1:] or ""))
    if calls:
        bad.append("dry-run gọi Google (%d lượt)" % len(calls))
    if r.tree() != before:
        bad.append("dry-run đổi file trong output/")
    return out


def model(n_by_cat, retry_only, cap, basis, photos=2):
    cum_ts = cum_ph = 0.0
    stops, cum = "none", {}
    first = True
    for c, n in n_by_cat:
        ts = n * 1.15 + (retry_only if first else 0)
        ph = n * 0.60 * photos
        first = False
        cum_ts += ts
        cum_ph += ph
        usd = x.net_usd(cum_ts, cum_ph, 950, 950) if basis == "net" else x.gross_usd(cum_ts, cum_ph)
        cum[c] = usd
        if usd <= cap + 1e-9:
            stops = c
    return cum, stops, cum_ts, cum_ph


r = build()
out = run(r, "1.50", "net")
cost = (x.kv(out, "DRY_RUN_COST") or [{}])[0]
cum, stops, ts, ph = model([("venue", 20), ("wedding_attire", 20), ("other", 0)], 1, 1.5, "net")
N, RO = 40, 1
exp_ts, exp_ph = N * 1.15 + RO, N * 0.60 * 2
up_ts, up_ph = N + math.ceil(0.30 * 20) * 2 + RO, N * 2
chk = {"text_search": exp_ts, "photo_requests": exp_ph}
for k, v in chk.items():
    if abs(float(cost.get(k, -99)) - v) > 1:
        bad.append("DRY_RUN_COST.%s = %s, công thức %s" % (k, cost.get(k), v))
for k, v in (("expected_net_usd", x.net_usd(exp_ts, exp_ph, 950, 950)), ("expected_gross_usd", x.gross_usd(exp_ts, exp_ph)),
             ("upper_net_usd", x.net_usd(up_ts, up_ph, 950, 950)), ("upper_gross_usd", x.gross_usd(up_ts, up_ph))):
    if abs(float(cost.get(k, -99)) - v) > 0.011:
        bad.append("DRY_RUN_COST.%s = %s, công thức %.3f" % (k, cost.get(k), v))
plan = {d.get("category"): d for d in x.kv(out, "DRY_RUN_PLAN")}
for c in ("venue", "wedding_attire"):
    if c not in plan or abs(float(plan[c].get("cum_expected_usd", -99)) - cum[c]) > 0.011:
        bad.append("DRY_RUN_PLAN %s cum_expected_usd = %s, công thức %.3f" % (c, plan.get(c, {}).get("cum_expected_usd"), cum[c]))
ver = (x.kv(out, "DRY_RUN_VERDICT") or [{}])[0]
if ver.get("stops_after") != "venue" or ver.get("within_cap") != "false" or ver.get("basis") != "net":
    bad.append("DRY_RUN_VERDICT trần 1,50: mong stops_after=venue within_cap=false basis=net, thấy %r" % ver)
sc = {d.get("category"): d for d in x.kv(out, "DRY_RUN_SCOPE")}
if sc.get("other", {}).get("not_in_pool") != "5" or sc.get("other", {}).get("in_pool") != "0" or sc.get("venue", {}).get("retry_only") != "1":
    bad.append("DRY_RUN_SCOPE: mong other not_in_pool=5 in_pool=0, venue retry_only=1; thấy %r" % {k: sc.get(k) for k in ("other", "venue")})
out = run(build(), "30", "net")
v2 = (x.kv(out, "DRY_RUN_VERDICT") or [{}])[0]
if v2.get("within_cap") != "true" or v2.get("stops_after") not in ("none", "wedding_attire", "other"):
    bad.append("DRY_RUN_VERDICT trần 30: mong within_cap=true, thấy %r" % v2)
out = run(build(), "30", "net", ["--include-non-pool"])
sc2 = {d.get("category"): d for d in x.kv(out, "DRY_RUN_SCOPE")}
if sc2.get("other", {}).get("in_scope") != "5":
    bad.append("--include-non-pool: other.in_scope mong 5, thấy %r" % sc2.get("other", {}).get("in_scope"))
out = run(build(), "0.50", "gross")
v3 = (x.kv(out, "DRY_RUN_VERDICT") or [{}])[0]
cg, sg, *_ = model([("venue", 20), ("wedding_attire", 20), ("other", 0)], 1, 0.5, "gross")
if v3.get("basis") != "gross" or v3.get("stops_after") != sg:
    bad.append("DRY_RUN_VERDICT gross 0,50: mong stops_after=%s, thấy %r" % (sg, v3))
t.done(bad, "dry-run 0 lượt, không đổi file, in phạm vi/chi phí kỳ vọng và cận trên/kế hoạch tích luỹ/kết luận đúng công thức; trần 1,50 dừng sau venue; --include-non-pool thêm 5 vendor")
