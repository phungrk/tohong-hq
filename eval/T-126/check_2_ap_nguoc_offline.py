#!/usr/bin/env python3
"""T-126 tiêu chí 2 (áp ngược OFFLINE cho vendor đã nhận, 0 request, không cần khoá API): `enrich.py --state HCMC --category <...> --apply-review-rule`.
Quy tắc (spec Hành vi 3): vendor có place_id Google (dòng log google_maps mới nhất), KHÔNG có mục accept_place của Capu, mà số đánh giá ĐÃ LƯU < 2 và dòng log là "đọc mới"
(timestamp >= 2026-11-08) -> hạ như "chưa từng khớp" (giống settle: bỏ place_id, google_photos, reviews/phone/website do Google ghi, địa chỉ về địa chỉ gốc; audit low_confidence + few_reviews +
candidate_place_id + google_review_count; KHÔNG gỡ vendor). Số đánh giá đã lưu = audit.google_review_count nếu có, không thì reviews[google_maps].count / changes.review_count; không có trường nào
(log không có rating) = 0. Dòng log "đọc cũ" (timestamp < 2026-11-08) KHÔNG bị hạ offline (cần xác nhận live, check_3).
Fixture (Google giả ở chế độ deny: mọi lượt gọi ném lỗi và bị ghi lại): f0 không có trường rating · f1 1 đánh giá · f2 0 · fx 1 đánh giá ở HAI category file -> hạ (cả hai file);
f5 5 · f2b đúng 2 -> giữ; fm duyệt tay accept_place với 0 đánh giá -> giữ (Capu thắng); s1 (1, đọc cũ) · s0 (không rating, đọc cũ) -> giữ ở lượt này; s7 -> giữ.
Số đánh giá đã lưu bám dòng log MỚI NHẤT, KHÔNG đọc reviews[] (có thể cũ): fr (log mới, không rating, reviews[].count còn 7) -> 0 đánh giá, HẠ; sc (log cũ, không rating, reviews[].count 7, ca marry_c7de39c8872c)
-> không hạ offline (đọc cũ, cần live).
CHẾ ĐỘ RIÊNG (B1): chỉ áp luật review; vendor ngoài diện (rt đang chờ thử lại vì tạm đóng cửa với audit retry=true, un chưa từng hỏi Google) giữ nguyên từng byte, 0 Text Search, 0 ảnh, kể cả khi có KHOÁ
API và Google giả sẵn sàng trả lời tên của rt/un (lần chạy đầu có khoá; lần hai không khoá).
Mong: 0 request Google, vendor giữ nguyên từng byte, lần hai không đổi gì, `enrich.py` thường không tự hạ ai. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
A = k.ADDR
spec = [  # id, tên, category file(s), pid, ts, số đánh giá đã lưu, manual
    ("f0", "Fresh Absent Makeup", ("makeup",), "Pf0", k.NEW_TS, None, False),
    ("f1", "Fresh One Flower", ("flower",), "Pf1", k.NEW_TS, 1, False),
    ("f2", "Nhà Hàng Fresh Zero", ("venue",), "Pf2", k.NEW_TS, 0, False),
    ("fx", "Fresh Twin Makeup", ("makeup", "flower"), "Pfx", k.NEW_TS, 1, False),
    ("f5", "Fresh Five Photo", ("photography",), "Pf5", k.NEW_TS, 5, False),
    ("f2b", "Fresh Boundary Makeup", ("makeup",), "Pf2b", k.NEW_TS, 2, False),
    ("fm", "Fresh Manual Makeup", ("makeup",), "Pfm", k.NEW_TS, None, True),
    ("s1", "Stale One Photo", ("photography",), "Ps1", k.OLD_TS, 1, False),
    ("s0", "Stale Absent Photo", ("photography",), "Ps0", k.OLD_TS, None, False),
    ("s7", "Stale Seven Photo", ("photography",), "Ps7", k.OLD_TS, 7, False),
    ("fr", "Fresh Reviews Left Makeup", ("makeup",), "Pfr", k.NEW_TS, None, False),
    ("sc", "Stale Reviews Left Photo", ("photography",), "Psc", k.OLD_TS, None, False),
]
files = {}
for i, (vid, name, cats, pid, ts, n, man) in enumerate(spec):
    for c in cats:
        files.setdefault(c, []).append(k.matched("t126_" + vid, name, A % (30 + i), c, pid, ts, n, cats=list(cats), manual=man, reviews_count=(7 if vid in ("fr", "sc") else "same")))
rt_v, rt_row = k.retry_vendor("t126_rt", "Retry Closed Venue", A % 80, "venue")
files["venue"] = files.get("venue", []) + [rt_v]
files["flower"].append(k.untried_vendor("t126_un", "Untried Flower Shop", A % 81, "flower"))
root = k.seed(files, extra_audit=[rt_row])
root.set_overrides([t.entry("t126_fm", "accept_place", place_id="Pfm", resolved=t.resolved("Pfm", k.pl("Fresh Manual Makeup", A % 36, "Pfm", n=0)), reason="Capu duyệt tay (fixture eval T-126)")])
FXD = x.fx({}, [], deny=True)
FXO = x.fx({"Prt": k.pl("Retry Closed Venue", A % 80, "Prt", n=9), "Pun": k.pl("Untried Flower Shop", A % 81, "Pun", n=9)}, [("retry closed venue", ["Prt"]), ("untried flower shop", ["Pun"])])
before = {(c, v["id"]): copy.deepcopy(v) for c, vs in files.items() for v in vs}
tree0 = root.tree()
rc0, out0, calls0 = root.run(x.enrich_all(list(files)), FXD, key=False)   # enrich thường, offline: KHÔNG tự hạ ai (chỉ cờ mới mới áp luật cho vendor đã nhận)
if root.tree() != tree0:
    bad.append("`enrich.py` thường (không cờ) làm đổi dữ liệu: luật ngược chỉ chạy qua %s" % k.APPLY)
rc, out, calls = root.run(x.enrich_all(list(files), extra=[k.APPLY]), FXO, key=True)   # CÓ khoá và Google sẵn sàng trả lời: chế độ riêng vẫn 0 request
if rc != 0:
    t.fail("enrich %s (có khoá, Google giả) thoát %d: %s" % (k.APPLY, rc, (out.strip().splitlines() or [""])[-1][:160]))
if calls0 or calls:
    bad.append("áp ngược offline mà gọi Google %d lượt (mong 0): %r" % (len(calls0) + len(calls), [c_["kind"] for c_ in calls0 + calls][:4]))
for vid, n in (("f0", 0), ("f1", 1), ("f2", 0), ("fx", 1), ("fr", 0)):
    bad += k.demoted_state_ok(root, "t126_" + vid, n)
for vid in ("f5", "f2b", "fm", "s1", "s0", "s7", "sc", "rt", "un"):
    for c, v in before.items():
        if c[1] == "t126_" + vid and root.vendor(c[1], c[0]) != v:
            bad.append("%s/%s: không thuộc diện hạ offline mà bản ghi đã đổi" % (c[0], c[1]))
        if c[1] == "t126_" + vid and (root.audit(c[0]).get(c[1]) or {}).get("reject_reason"):
            bad.append("%s/%s: audit bị gán reject_reason" % (c[0], c[1]))
if sorted(r["id"] for r in k.report_rows(root)) != sorted(["t126_f0", "t126_f1", "t126_f2", "t126_fx", "t126_fr"]):
    bad.append("%s mong đúng 5 id (f0, f1, f2, fx, fr; fx một dòng dù ở 2 file), thấy %r" % (k.REPORT, sorted(r["id"] for r in k.report_rows(root))))
tree1 = root.tree()
rc2, out2, calls2 = root.run(x.enrich_all(list(files), extra=[k.APPLY]), FXD, key=False)
if rc2 != 0 or calls2 or root.tree() != tree1:
    bad.append("lần chạy thứ hai không idempotent (rc=%d, %d lượt Google, file đổi=%s)" % (rc2, len(calls2), root.tree() != tree1))
rcn, outn, callsn = root.run(x.enrich_all(list(files)), FXD, key=False)
if root.tree() != tree1:
    bad.append("`enrich.py` thường sau áp ngược làm đổi dữ liệu (không được nhận lại vendor đã hạ khi chưa hỏi Google, không đổi sổ)")
t.done(bad, "áp ngược là chế độ riêng: 5 vendor đọc mới <2 đánh giá (số bám log mới nhất) hạ về ảnh minh hoạ, vendor chờ thử lại/chưa thử/duyệt tay/đọc cũ/>=2 giữ nguyên từng byte, 0 request kể cả khi có khoá, chạy lại không đổi")
