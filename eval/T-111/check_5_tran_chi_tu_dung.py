#!/usr/bin/env python3
"""T-111 tiêu chí 3 (trần $ CHO CẢ ĐỢT, tự dừng giữa chừng; v2 theo T-111-D1 B1, M2, M3). OFFLINE (Google giả). 8 vendor (4 venue, 4 wedding_attire), mọi vendor khớp, Google có 3 ảnh
(lấy 2): mỗi vendor tốn 1 Text Search + 2 media = $0,040 + $0,014 = $0,054 khi hết hạn mức miễn phí.
Công thức TÍCH LUỸ (spec "Công thức trần"): đã dùng = baseline + mọi log trong run-logs/*/<YYYYMM>*.log của THÁNG (T-106, T-110, T-111 đều tính), cộng request của lần này;
net = 0,040 x max(0, TS_cum + 50 - 1000) + 0,007 x max(0, PH_cum + 50 - 1000); so với --budget-usd cho CẢ ĐỢT, không cho riêng lần chạy. Trước mỗi request: ước tính sau request <= trần;
trước mỗi Text Search: ước tính sau (Text Search + max_photos media) <= trần. Mỗi request ghi NGAY một dòng `GOOGLE_REQUEST run=<id> kind=<search|details|media|geocode>` (flush, TRƯỚC khi gửi,
kể cả lượt lỗi/retry) và dòng cuối `GOOGLE_USAGE run=<id> …`; một run id có dòng REQUEST thì chỉ đếm REQUEST (không đếm đôi với USAGE).
Fixture quy ước: đã dùng 950 = hết hạn mức miễn phí hiệu dụng (1000 - biên 50), chi net bắt đầu từ 0.
A. Trần 0,30 net: đúng 5 vendor (5 x 0,054 = 0,27), 5 Text Search, 10 media, dòng BUDGET_STOP basis=net cap_usd=0.30 est_usd=0.27 next_category=wedding_attire, thoát 0, 3 vendor còn lại
   nguyên byte và không có dòng audit; GOOGLE_USAGE khớp; số dòng GOOGLE_REQUEST bằng số lượt thật.
B. Lưu stdout lần A thành log T-111 (như workflow tee). Chạy lại CÙNG trần 0,30: 0 lượt (đợt đã tiêu 0,27; vendor kế sẽ vượt), BUDGET_STOP processed=0 remaining=3. Chạy với trần 0,60:
   đúng 3 Text Search cho 3 vendor còn lại (0,27 + 0,162 = 0,432 <= 0,60), 0 lượt cho 5 vendor đã xong, KHÔNG đếm đôi (REQUEST và USAGE cùng run id chỉ tính một).
C. Trần > 30: thoát 2, BUDGET_CAP_TOO_HIGH, 0 lượt. Trần 30 được nhận.
D. Còn hạn mức miễn phí (không log): net 0,30 không dừng; `--cap-basis gross` cùng trần 0,30 dừng ở vendor thứ 5 (giá niêm yết, tích luỹ theo log của đợt T-110/T-111).
E. Log ở nhiều thư mục (T-106 600, T-110 350 text_search; baseline ảnh 950) đều cộng: dừng ở 5. Log THÁNG KHÁC (20261001-…) không cộng.
F. Lần chạy bị giết (fixture die_after=3, thoát 137 ở lượt Text Search thứ 4): stdout đã có đủ dòng GOOGLE_REQUEST (4 search đã ghi, kể cả lượt chết), và khi lưu làm log, lần chạy sau
   đếm chúng (baseline ts 946): với trần 0,30 chỉ làm 4 vendor tiếp (không phải 5 như khi log bị bỏ qua).
G. Log hỏng (không có GOOGLE_REQUEST lẫn GOOGLE_USAGE) trong run-logs/T-111: chạy thật bị từ chối (thoát 2, USAGE_LOG_UNREADABLE, 0 lượt); dry-run vẫn in và cảnh báo.
H. Đếm theo cặp (file, run_id), không theo file (D2 M2): một log có `GOOGLE_REQUEST`+`GOOGLE_USAGE` của run `ra1-enrich-x` (3 search) và một `GOOGLE_USAGE` của run `ra1-refresh-y` KHÔNG có
   dòng REQUEST (2 Place Details + 4 media, kiểu refresh_photos.py trong cùng job): cả hai đều được đếm (ảnh 944 + 6 = 950) nên trần 0,30 dừng ở 5 vendor; nếu USAGE của refresh bị bỏ vì "file có REQUEST" thì sẽ làm 6.
Spec: products/T-111-enrich-toan-bo-vendor.md, "Chi phí và trần". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
CATS = ["venue", "wedding_attire"]


def build(prime=None, **kw):
    vs = [x.V("c%d" % i, "Nhà hàng Cap%02d Sao" % i, i + 1, ("venue",) if i < 4 else ("attire",)) for i in range(8)]
    pl = {"P%d" % i: t.place(v["name"], x.GADDR % (i + 1), nphotos=3) for i, v in enumerate(vs)}
    rules = [("cap%02d sao" % i, ["P%d" % i]) for i in range(8)]
    r = t.Root({"venue": vs[:4], "wedding_attire": vs[4:]})
    if prime == "full":
        x.usage_logs(r, ts=950, baseline_photos=950)
    return r, x.fx(pl, rules, **kw), pl, rules


def done_ids(r):
    return {v["id"] for c in CATS for v in r.vendors(c) if t.has_pid(v)}


# A
r, FX, pl, rules = build("full")
snap = {v["id"]: dict(v) for c in CATS for v in r.vendors(c)}
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
ts, md = t.n_kind(calls, "search"), t.n_kind(calls, "media")
if rc != 0 or ts != 5 or md != 10:
    bad.append("A: mong thoát 0, 5 Text Search, 10 media; thấy rc=%d ts=%d media=%d" % (rc, ts, md))
if x.net_usd(ts, md, 950, 950) > 0.30 + 1e-9:
    bad.append("A: ước tính net sau khi dừng %.3f > trần 0.30" % x.net_usd(ts, md, 950, 950))
stop = x.kv(out, "BUDGET_STOP")
if len(stop) != 1 or stop[0].get("basis") != "net" or stop[0].get("cap_usd") != "0.30" or abs(float(stop[0].get("est_usd", "9")) - 0.27) > 0.011 or stop[0].get("next_category") != "wedding_attire":
    bad.append("A: dòng BUDGET_STOP sai, thấy %r" % stop)
ok = done_ids(r)
if len(ok) != 5:
    bad.append("A: mong 5 vendor đã xử lý có place_id, thấy %d" % len(ok))
for vid in [i for i in snap if i not in ok]:
    cat = "venue" if int(vid[1:]) < 4 else "wedding_attire"
    if r.vendor(vid, cat) != snap[vid] or vid in r.audit(cat):
        bad.append("A: vendor chưa xử lý %s bị đổi hoặc có dòng audit (phải nguyên vẹn để lần sau làm tiếp)" % vid)
if t.usage(out) != {"text_search": ts, "photo_details": 0, "photo_media": md}:
    bad.append("A: GOOGLE_USAGE %r không khớp lượt thật (ts=%d media=%d)" % (t.usage(out), ts, md))
if x.n_requests(out, "search") != ts or x.n_requests(out, "media") != md:
    bad.append("A: số dòng GOOGLE_REQUEST (search %d, media %d) không bằng lượt thật (%d, %d)" % (x.n_requests(out, "search"), x.n_requests(out, "media"), ts, md))
# B
x.save_log(r, "20261108-100000-run1.log", out)
rc, out2, calls2 = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
st2 = x.kv(out2, "BUDGET_STOP")
if t.n_kind(calls2, "search") or not st2 or st2[0].get("processed") != "0" or st2[0].get("remaining") != "3":
    bad.append("B: cùng trần 0,30 sau khi đợt đã tiêu 0,27: mong 0 lượt và BUDGET_STOP processed=0 remaining=3; thấy %d lượt, %r" % (t.n_kind(calls2, "search"), st2))
rc, out3, calls3 = r.run(x.enrich_all(CATS, budget="0.60", basis="net"), FX)
if t.n_kind(calls3, "search") != 3 or len(done_ids(r)) != 8:
    bad.append("B: trần 0,60 mong 3 Text Search cho 3 vendor còn lại và 8/8 có place_id (nếu đếm đôi REQUEST+USAGE chỉ còn 1); thấy %d lượt, %d vendor" % (t.n_kind(calls3, "search"), len(done_ids(r))))
# C
r, FX, *_ = build("full")
rc, out, calls = r.run(x.enrich_all("venue", budget="30.01"), FX)
if rc != 2 or calls or "BUDGET_CAP_TOO_HIGH" not in out:
    bad.append("C: trần 30,01 phải thoát 2 + BUDGET_CAP_TOO_HIGH + 0 lượt (rc=%d, %d lượt)" % (rc, len(calls)))
rc, out, calls = r.run(x.enrich_all("venue", budget="30"), FX)
if rc != 0 or not calls:
    bad.append("C: trần 30 phải được nhận (rc=%d, %d lượt)" % (rc, len(calls)))
# D
r, FX, *_ = build()
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 8 or t.n_kind(calls, "media") != 16 or x.kv(out, "BUDGET_STOP"):
    bad.append("D: còn hạn mức miễn phí, trần net 0,30 không được dừng (thấy %d Text Search, %d media)" % (t.n_kind(calls, "search"), t.n_kind(calls, "media")))
r, FX, *_ = build()
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="gross"), FX)
if t.n_kind(calls, "search") != 5 or not x.kv(out, "BUDGET_STOP") or x.kv(out, "BUDGET_STOP")[0].get("basis") != "gross":
    bad.append("D: trần gross 0,30 phải dừng ở vendor thứ 5 (thấy %d Text Search)" % t.n_kind(calls, "search"))
# E
r, FX, *_ = build()
x.usage_logs(r, ts=600, baseline_photos=950, name="T-106/20261108-040329-a.log")
x.usage_logs(r, ts=350, baseline_photos=950, name="T-110/20261108-050000-b.log")
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 5:
    bad.append("E: log T-106 (600) và T-110 (350) phải cộng thành đã dùng 950: mong dừng ở 5 Text Search, thấy %d" % t.n_kind(calls, "search"))
r, FX, *_ = build()
x.usage_logs(r, ts=950, baseline_photos=950, name="T-106/20261001-040329-a.log")
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 8:
    bad.append("E: log của tháng 10 không được tính vào tháng 11 (mong 8 Text Search, thấy %d)" % t.n_kind(calls, "search"))
# F
r, FX, pl, rules = build(die_after=3)
x.usage_logs(r, ts=0, baseline_ts=946, baseline_photos=950, name="T-106/20261108-040329-a.log")
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
ns = t.n_kind(calls, "search")
if rc == 0 or ns != 4 or x.n_requests(out, "search") != 4:
    bad.append("F: lần chạy bị giết (rc=%d) phải để lại đủ GOOGLE_REQUEST đã ghi trước khi chết: fake thấy %d search, stdout có %d dòng GOOGLE_REQUEST search" % (rc, ns, x.n_requests(out, "search")))
x.save_log(r, "20261108-110000-killed.log", out)
r2FX = x.fx(pl, rules)
rc, out2, calls2 = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), r2FX)
if t.n_kind(calls2, "search") != 4:
    bad.append("F: log của lần bị giết (4 search, %d media) phải được đếm: với trần 0,30 mong 4 Text Search tiếp, thấy %d (5 nghĩa là log bị bỏ qua)" % (x.n_requests(out, "media"), t.n_kind(calls2, "search")))
# G
r, FX, *_ = build("full")
x.save_log(r, "20261108-120000-broken.log", "noise\ndòng không có số đếm\n")
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
if rc != 2 or calls or "USAGE_LOG_UNREADABLE" not in out:
    bad.append("G: log hỏng phải khiến chạy thật bị từ chối (thoát 2, USAGE_LOG_UNREADABLE, 0 lượt): rc=%d, %d lượt" % (rc, len(calls)))
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net", extra=["--dry-run"]), x.fx({}, [], deny=True), key=False)
if rc != 0 or calls or "USAGE_LOG_UNREADABLE" not in out:
    bad.append("G: dry-run với log hỏng vẫn thoát 0, 0 lượt, nhưng phải in cảnh báo USAGE_LOG_UNREADABLE")
# H
r, FX, *_ = build()
x.usage_logs(r, ts=0, baseline_ts=947, baseline_photos=944, name="T-106/20261108-040329-a.log")
open(os.path.join(r.path, "run-logs", "T-111", "20261108-130000-run-5-enrich.log") if os.makedirs(os.path.join(r.path, "run-logs", "T-111"), exist_ok=True) is None else "", "w").write(
    "GOOGLE_REQUEST run=ra1-enrich-x kind=search\nGOOGLE_REQUEST run=ra1-enrich-x kind=search\nGOOGLE_REQUEST run=ra1-enrich-x kind=search\n"
    "GOOGLE_USAGE run=ra1-enrich-x text_search=3 photo_details=0 photo_media=0\n"
    "GOOGLE_USAGE run=ra1-refresh-y text_search=0 photo_details=2 photo_media=4\n")
rc, out, calls = r.run(x.enrich_all(CATS, budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 5:
    bad.append("H: đếm theo (file, run_id): USAGE của run refresh (6 ảnh) phải được cộng dù file có REQUEST của run khác: mong 5 Text Search, thấy %d" % t.n_kind(calls, "search"))
t.done(bad, "trần $ tích luỹ cho cả đợt: tự dừng đúng chỗ (5 vendor, 0,27 <= 0,30), lần sau cùng trần không tiêu thêm, tăng trần làm tiếp phần còn lại không đếm đôi; log nhiều việc cộng, tháng khác không; lần chạy bị giết vẫn được đếm; log hỏng từ chối chạy thật; trần > 30 bị từ chối")
