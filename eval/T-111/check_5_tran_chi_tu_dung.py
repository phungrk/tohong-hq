#!/usr/bin/env python3
"""T-111 tiêu chí 3 (trần $ cứng, tự dừng giữa chừng). OFFLINE (Google giả). 8 vendor (4 venue, 4 wedding_attire), mọi vendor khớp, Google có 3 ảnh (lấy 2): mỗi vendor tốn
1 Text Search + 2 media = $0,040 + $0,014 = $0,054 khi hết hạn mức miễn phí. Công thức trần (spec "Chi phí"): ước tính net = 0,040 x max(0, text_search - free_ts) + 0,007 x max(0, photo - free_photo),
free = max(0, 1000 - đã dùng trong tháng - 50), đã dùng = baseline + mọi GOOGLE_USAGE trong run-logs/*/<YYYYMM>*.log của THÁNG đó. Trước mỗi request: ước tính sau request <= trần;
trước mỗi Text Search: ước tính sau (Text Search + max_photos media) <= trần.
A. Hết hạn mức (baseline ảnh 1000, log text_search 1000), trần 0,30 net: đúng 5 vendor được xử lý (5 x 0,054 = 0,27; vendor thứ 6 sẽ vượt), 5 Text Search, 10 media, dòng
   BUDGET_STOP basis=net cap_usd=0.30 est_usd=0.27 next_category=wedding_attire, thoát 0, 3 vendor còn lại KHÔNG đổi một byte và không có dòng audit; dữ liệu 5 vendor đã xử lý được lưu.
B. Chạy lại với cùng hạn mức: chỉ 3 vendor còn lại được tìm (3 Text Search), 0 lượt cho 5 vendor đã xử lý (không làm lại).
C. Trần > 30: thoát 2, in BUDGET_CAP_TOO_HIGH, 0 lượt. Trần 30 được nhận.
D. Còn hạn mức miễn phí (không log): trần net 0,30 không dừng (8 Text Search + 16 media trong hạn mức); `--cap-basis gross` cùng trần 0,30 dừng ở vendor thứ 5 (giá niêm yết bất kể miễn phí).
E. Log nằm ở nhiều thư mục việc (T-106: 600, T-110: 400 text_search) đều được cộng; log của THÁNG KHÁC (tên 20261001-…) không được cộng.
GOOGLE_USAGE (dòng cuối) khớp số lượt thật. Spec: products/T-111-enrich-toan-bo-vendor.md, "Chi phí và trần". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []


def build(logs=True):
    vs = [x.V("c%d" % i, "Nhà hàng Cap%02d Sao" % i, i + 1, ("venue",) if i < 4 else ("attire",)) for i in range(8)]
    pl = {"P%d" % i: t.place(v["name"], x.GADDR % (i + 1), nphotos=3) for i, v in enumerate(vs)}
    rules = [("cap%02d sao" % i, ["P%d" % i]) for i in range(8)]
    r = t.Root({"venue": vs[:4], "wedding_attire": vs[4:]})
    if logs == "full":
        x.usage_logs(r, ts=1000, baseline_photos=1000)
    return r, x.fx(pl, rules), pl, rules


def done_ids(r):
    return {v["id"] for c in ("venue", "wedding_attire") for v in r.vendors(c) if t.has_pid(v)}


# A
r, FX, pl, rules = build("full")
before = {c: r.tree() for c in ("a",)}
snap = {v["id"]: dict(v) for c in ("venue", "wedding_attire") for v in r.vendors(c)}
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"], budget="0.30", basis="net"), FX)
ts, md = t.n_kind(calls, "search"), t.n_kind(calls, "media")
if rc != 0 or ts != 5 or md != 10:
    bad.append("A: mong thoát 0, 5 Text Search, 10 media; thấy rc=%d ts=%d media=%d" % (rc, ts, md))
est = x.net_usd(ts, md, 1000, 1000)
if est > 0.30 + 1e-9:
    bad.append("A: ước tính net sau khi dừng %.3f > trần 0.30" % est)
stop = x.kv(out, "BUDGET_STOP")
if len(stop) != 1 or stop[0].get("basis") != "net" or stop[0].get("cap_usd") != "0.30" or abs(float(stop[0].get("est_usd", "9")) - 0.27) > 0.011 or stop[0].get("next_category") != "wedding_attire":
    bad.append("A: dòng BUDGET_STOP sai, thấy %r" % stop)
ok = done_ids(r)
if len(ok) != 5:
    bad.append("A: mong 5 vendor đã xử lý có place_id, thấy %d" % len(ok))
rest = [i for i in snap if i not in ok]
for vid in rest:
    cat = "venue" if int(vid[1:]) < 4 else "wedding_attire"
    if r.vendor(vid, cat) != snap[vid] or vid in r.audit(cat):
        bad.append("A: vendor chưa xử lý %s bị đổi hoặc có dòng audit (phải nguyên vẹn để lần sau làm tiếp)" % vid)
u = t.usage(out)
if u != {"text_search": ts, "photo_details": 0, "photo_media": md}:
    bad.append("A: GOOGLE_USAGE %r không khớp lượt thật (ts=%d media=%d)" % (u, ts, md))
# B
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"], budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 3 or len(done_ids(r)) != 8:
    bad.append("B: lần 2 mong 3 Text Search cho 3 vendor còn lại và 8/8 có place_id; thấy %d lượt, %d vendor" % (t.n_kind(calls, "search"), len(done_ids(r))))
# C
r, FX, *_ = build("full")
rc, out, calls = r.run(x.enrich_all("venue", budget="30.01"), FX)
if rc != 2 or calls or "BUDGET_CAP_TOO_HIGH" not in out:
    bad.append("C: trần 30,01 phải thoát 2 + BUDGET_CAP_TOO_HIGH + 0 lượt (rc=%d, %d lượt)" % (rc, len(calls)))
rc, out, calls = r.run(x.enrich_all("venue", budget="30"), FX)
if rc != 0 or not calls:
    bad.append("C: trần 30 phải được nhận (rc=%d, %d lượt)" % (rc, len(calls)))
# D
r, FX, *_ = build(False)
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"], budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 8 or t.n_kind(calls, "media") != 16 or x.kv(out, "BUDGET_STOP"):
    bad.append("D: còn hạn mức miễn phí, trần net 0,30 không được dừng (thấy %d Text Search, %d media)" % (t.n_kind(calls, "search"), t.n_kind(calls, "media")))
r, FX, *_ = build(False)
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"], budget="0.30", basis="gross"), FX)
if t.n_kind(calls, "search") != 5 or not x.kv(out, "BUDGET_STOP") or x.kv(out, "BUDGET_STOP")[0].get("basis") != "gross":
    bad.append("D: trần gross 0,30 phải dừng ở vendor thứ 5 (thấy %d Text Search)" % t.n_kind(calls, "search"))
# E
r, FX, *_ = build(False)
x.usage_logs(r, ts=600, baseline_photos=1000, name="T-106/20261108-040329-a.log")
x.usage_logs(r, ts=400, baseline_photos=1000, name="T-110/20261108-050000-b.log")
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"], budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 5:
    bad.append("E: log ở T-106 (600) và T-110 (400) phải cộng thành đã dùng 1000: mong dừng ở 5 Text Search, thấy %d" % t.n_kind(calls, "search"))
r, FX, *_ = build(False)
x.usage_logs(r, ts=1000, baseline_photos=1000, name="T-106/20261001-040329-a.log")
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"], budget="0.30", basis="net"), FX)
if t.n_kind(calls, "search") != 8:
    bad.append("E: log của tháng 10 không được tính vào tháng 11 (mong 8 Text Search, thấy %d)" % t.n_kind(calls, "search"))
t.done(bad, "trần tự dừng đúng chỗ (5 vendor, est 0,27 <= 0,30), phần chưa làm nguyên vẹn và làm tiếp được, trần > 30 bị từ chối, net và gross khác nhau đúng, log nhiều việc được cộng, log tháng khác không")
