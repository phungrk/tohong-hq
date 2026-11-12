#!/usr/bin/env python3
"""Nguồn: T-128 (spec products/T-126-bo-qua-nhan-khop-it-review.md v3, Hành vi 1(b)/(b1); ADR-065 thay ADR-063; ADR-044 mục 1), qua Spec Gate 2026-11-12 (spec-critic).
Nằm ở eval/T-128/bat-bien-cho-merge/ cho tới khi PR code T-128 (C-1 = False) merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào
eval/invariants/planner/vendor/images/ (số 032 của vùng này; hq/dashboard/model đã có inv-032 riêng, khác vùng).
INV-032 · Google báo CLOSED_PERMANENTLY cho ứng viên đã qua luật nhận khớp của vendor KHÔNG có duyệt tay thì vendor bị gỡ (vào removed_vendors.json, không còn
trong vendors.json, audit không mang few_reviews), BẤT KỂ số đánh giá Google (vắng trường, 0, 1, 2, 5). Số đánh giá ít chỉ quyết định nơi Google còn hoạt động:
ứng viên OPERATIONAL < 2 đánh giá thì vendor ở lại (few_reviews không bao giờ là lý do gỡ).
Lý do: Capu 2026-11-12 (ADR-065) "đóng cửa vĩnh viễn → GỠ" kể cả khi < 2 đánh giá; cặp đôi không thấy trên app nơi Google báo đã đóng cửa vĩnh viễn.
Ngoài phạm vi (không đo ở đây): duyệt tay (thắng, T-110 2b, INV-020/021); CLOSED_TEMPORARILY (T-110 hành vi 6, INV-021 (f)); pool (INV-022).
OFFLINE: Google giả eval/T-126/_fake, chạy ĐÚNG lệnh CLI `enrich.py` thường (hạ tầng eval/T-126/_t126.py). Không gọi Google. Repo: TOHONG_REPO, rồi ../tohong.
Chạy không tham số (python3 -I). In PASS hoặc FAIL <lý do>. Thoát 0/1."""
import os, sys

HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # ADR-057/070: tìm gốc tohong-hq ở mọi độ sâu
    HQ = os.path.dirname(HQ)
sys.path.insert(0, os.path.join(HQ, "eval", "T-126"))
import _t126 as k  # noqa: E402

h, x, t = k.h, k.x, k.t
S = k.ADDR
V = [  # id, tên, category file, số đánh giá Google (None = vắng trường), trạng thái Google
    ("c0", "Hoa Cordierite Absent", "flower", None, "CLOSED_PERMANENTLY"),
    ("c1", "Nhà Hàng Celestine Zero", "venue", 0, "CLOSED_PERMANENTLY"),
    ("c2", "Chrysoberyl One Makeup", "makeup", 1, "CLOSED_PERMANENTLY"),
    ("c3", "Hoa Carnelian Two", "flower", 2, "CLOSED_PERMANENTLY"),
    ("c4", "Nhà Hàng Citrine Five", "venue", 5, "CLOSED_PERMANENTLY"),
    ("o0", "Onyx Zero Makeup", "makeup", 0, "OPERATIONAL"),
    ("o1", "Hoa Obsidian One", "flower", 1, "OPERATIONAL"),
]
files, PL, rules = {}, {}, []
for i, (vid, name, cat, n, st) in enumerate(V):
    files.setdefault(cat, []).append(t.vendor("inv32_" + vid, name, S % (40 + i), (h.DIR_CATEGORY[cat],)))
    PL["P" + vid] = k.pl(name, S % (40 + i), "P" + vid, n=n, status=st)
    rules.append((h.fold(name), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
cats = [c for c in h.ORDER if c in files]
rc, out, calls = root.run(x.enrich_all(cats), x.fx(PL, rules))
if rc != 0:
    t.fail("enrich thường thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))
bad = []
for vid, name, cat, n, st in V:
    i = "inv32_" + vid
    live = root.vendor(i, cat)
    gone = [e for e in root.removed(cat) if (e.get("vendor") or {}).get("id") == i]
    a = root.audit(cat).get(i) or {}
    if a.get("reject_reason") == k.CODE and st == "CLOSED_PERMANENTLY":
        bad.append("%s (%s, %r đánh giá): mang few_reviews thay vì gỡ" % (vid, st, n))
    if st == "CLOSED_PERMANENTLY" and (live is not None or not gone):
        bad.append("%s (CLOSED_PERMANENTLY, %r đánh giá): mong GỠ (removed_vendors.json, không còn trong vendors.json), thấy còn=%s gỡ=%s" % (vid, n, live is not None, bool(gone)))
    if st == "OPERATIONAL" and (live is None or gone):
        bad.append("%s (OPERATIONAL, %r đánh giá): ít đánh giá không được là lý do gỡ, thấy còn=%s gỡ=%s" % (vid, n, live is not None, bool(gone)))
t.done(bad, "CLOSED_PERMANENTLY gỡ vendor không duyệt tay bất kể số đánh giá (vắng, 0, 1, 2, 5); OPERATIONAL ít đánh giá ở lại")
