#!/usr/bin/env python3
"""T-126 tiêu chí 4 (chi phí đúng SKU, ước tính in trước, trần chặn đúng). OFFLINE (Google giả).
Giá và SKU (spec, "Bằng chứng"): Place Details với field mask chỉ `userRatingCount` thuộc SKU Place Details Enterprise: $20,00/1000 = $0,020/request, hạn mức miễn phí 1000/tháng RIÊNG
(không dùng chung với Text Search Enterprise+Atmosphere $0,040 hay Place Photos $0,007). Công thức net như usage.py (biên 50): net = 0,020 x max(0, PD_cum + 50 - 1000).
Fixture: 6 vendor đọc cũ có <2 đánh giá đã lưu (cần xác nhận). Mong:
  (a) `--dry-run` in ĐÚNG MỘT dòng `REVIEW_SCOPE candidates=6 details_count=6 est_gross_usd=0.120 est_net_usd=<x>` với 0 lượt Google và không đổi file;
      est_net = 0,000 khi tháng chưa dùng Place Details; = est_gross (0,120) khi log tháng đã có details_count=2000; VẪN 0,000 khi log tháng chỉ có photo_media=5000 (SKU ảnh khác SKU này)
  (b) `--cap-basis gross --budget-usd 0.05`: đúng 2 lượt Place Details (0,040 <= 0,05 < 0,060), có dòng BUDGET_STOP, vendor đã hỏi được xử lý, 4 vendor còn lại không đổi
  (c) chạy tiếp (trần rộng): chỉ hỏi 4 vendor còn lại (tổng 6, không hỏi đôi); GOOGLE_USAGE lần 2 có details_count=4
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
files = {"photography": []}
PL = {}
for i in range(6):
    pid = "Pc%d" % i
    files["photography"].append(k.matched("t126_c%d" % i, "Cost Probe Photo %d" % i, k.ADDR % (50 + i), "photography", pid, k.OLD_TS, 1))
    PL[pid] = k.pl("Cost Probe Photo %d" % i, k.ADDR % (50 + i), pid, n=0 if i % 2 else 1)
root = k.seed(files)
FX = x.fx(PL, [])
extra_log = lambda body: (os.makedirs(os.path.join(root.path, "run-logs", "T-126"), exist_ok=True), open(os.path.join(root.path, "run-logs", "T-126", "20261105-000000-run-9-x.log"), "w").write(body))
tree0 = root.tree()


def scope(extra_body):
    p = os.path.join(root.path, "run-logs", "T-126", "20261105-000000-run-9-x.log")
    if os.path.exists(p):
        os.remove(p)
    if extra_body:
        extra_log(extra_body)
    rc, out, calls = root.run(x.enrich_all(["photography"], extra=[k.APPLY, k.CONFIRM, "--dry-run"]), FX)
    return rc, out, calls, x.kv(out, "REVIEW_SCOPE")


for label, body, want_net in (("tháng chưa dùng", "", 0.0), ("đã có details_count=2000", "GOOGLE_USAGE run=r9 text_search=0 photo_details=0 photo_media=0 details_count=2000\n", 0.12),
                              ("chỉ có photo_media=5000", "GOOGLE_USAGE run=r9 text_search=0 photo_details=0 photo_media=5000\n", 0.0)):
    rc, out, calls, sc = scope(body)
    if rc != 0:
        t.fail("dry-run (%s) thoát %d: %s" % (label, rc, (out.strip().splitlines() or [""])[-1][:160]))
    if calls:
        bad.append("--dry-run (%s) gọi Google %d lượt" % (label, len(calls)))
    if len(sc) != 1:
        bad.append("--dry-run (%s): mong đúng 1 dòng REVIEW_SCOPE, thấy %d" % (label, len(sc)))
        continue
    d = sc[0]
    try:
        if (int(d["candidates"]), int(d["details_count"])) != (6, 6) or abs(float(d["est_gross_usd"]) - 0.12) > 0.0006 or abs(float(d["est_net_usd"]) - want_net) > 0.0006:
            bad.append("REVIEW_SCOPE (%s) mong 6/6/gross 0,120/net %.3f, thấy %r" % (label, want_net, d))
    except (KeyError, ValueError) as e:
        bad.append("REVIEW_SCOPE (%s) thiếu/sai trường: %r" % (label, e))
if root.tree() != tree0:
    bad.append("--dry-run làm đổi file")
os.remove(os.path.join(root.path, "run-logs", "T-126", "20261105-000000-run-9-x.log"))
rc1, out1, calls1 = root.run(x.enrich_all(["photography"], budget="0.05", basis="gross", extra=[k.APPLY, k.CONFIRM]), FX)
if len(calls1) != 2 or t.n_kind(calls1, "details") != 2:
    bad.append("trần gross 0,05: mong đúng 2 Place Details, thấy %d lượt %r" % (len(calls1), sorted({c["kind"] for c in calls1})))
if "BUDGET_STOP" not in out1:
    bad.append("trần chặn mà không có dòng BUDGET_STOP")
asked1 = {c["url"].split("/v1/places/")[-1] for c in calls1}
rc2, out2, calls2 = root.run(x.enrich_all(["photography"], extra=[k.APPLY, k.CONFIRM]), FX)
asked2 = {c["url"].split("/v1/places/")[-1] for c in calls2}
if len(calls2) != 4 or asked1 & asked2 or len(asked1 | asked2) != 6:
    bad.append("chạy tiếp mong đúng 4 lượt cho 4 vendor còn lại, không hỏi đôi; thấy %d lượt, giao=%r" % (len(calls2), sorted(asked1 & asked2)))
us = x.kv(out2, "GOOGLE_USAGE")
if not us or us[-1].get("details_count") != "4":
    bad.append("GOOGLE_USAGE lần 2 mong details_count=4, thấy %r" % (us[-1:] or None))
t.done(bad, "REVIEW_SCOPE in 6 x $0,020 = $0,120 gross (net đúng theo SKU riêng, ảnh không lẫn), trần gross chặn đúng ở 2 lượt, chạy tiếp không hỏi đôi")
