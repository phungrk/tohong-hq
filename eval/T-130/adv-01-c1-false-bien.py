#!/usr/bin/env python3
"""T-130 đối kháng 01 (adversary, Code Gate). C-1 = False (ADR-065, spec T-126 v3 Hành vi 1(b)/(b1)) ở các biên check_1 chưa chạm. OFFLINE, Google giả của T-126.
  u venue + flower (hai category file), CLOSED_PERMANENTLY, 1 đánh giá -> GỠ khỏi MỌI file (ADR-044), không few_reviews
  w flower CLOSED_PERMANENTLY, Google BỎ trường userRatingCount -> GỠ
  y makeup CLOSED_PERMANENTLY 0 đánh giá nhưng địa chỉ mâu thuẫn (bị cổng từ chối) -> vendor Ở LẠI, mã cũ address_conflict (v4.1)
  z venue Capu duyệt tay `temporarily_closed`, Google trả CLOSED_PERMANENTLY 0 đánh giá -> duyệt tay thắng: KHÔNG gỡ (protected, T-110 2b)
  s flower CLOSED_TEMPORARILY 1 đánh giá -> tạm đóng cửa retry=true, không few_reviews, không gỡ
  đường tên (--recheck-name-match): o2 invitation CLOSED_TEMPORARILY 1 đánh giá -> tạm đóng cửa retry, không few_reviews, không gỡ
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-126"))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
S = k.ADDR
G = "55 Hai Bà Trưng, Bến Nghé, Hồ Chí Minh"
V = [
    ("u", "Nhà Hàng Umber Closed One", ["venue", "flower"], S % 31, S % 31, 1, "CLOSED_PERMANENTLY"),
    ("w", "Hoa Wisteria Absent Closed", ["flower"], S % 32, S % 32, None, "CLOSED_PERMANENTLY"),
    ("y", "Yarrow Conflict Closed Makeup", ["makeup"], S % 33, G, 0, "CLOSED_PERMANENTLY"),
    ("z", "Nhà Hàng Zircon Manual Temp", ["venue"], S % 34, S % 34, 0, "CLOSED_PERMANENTLY"),
    ("s", "Hoa Sapphire Temp One", ["flower"], S % 35, S % 35, 1, "CLOSED_TEMPORARILY"),
    ("o2", "Onyx Name Temp Invitation", ["invitation"], S % 36, G, 1, "CLOSED_TEMPORARILY"),
]
files, PL, rules = {}, {}, []
for vid, name, cats, src, gaddr, n, st in V:
    for cat in cats:
        files.setdefault(cat, []).append(t.vendor("t130_" + vid, name, src, tuple(h.DIR_CATEGORY[c] for c in cats)))
    PL["P" + vid] = k.pl(name, gaddr, "P" + vid, n=n, status=st)
    rules.append((h.fold(name), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
root.set_overrides([t.entry("t130_z", "temporarily_closed", reason="Capu: tạm đóng (fixture adv T-130)")])
FX = x.fx(PL, rules)
cats = [c for c in h.ORDER if c in files]
rc, out, calls = root.run(x.enrich_all(cats), FX)
if rc != 0:
    t.fail("enrich thường thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))


def removed_in(vid, cat):
    return [e for e in root.removed(cat) if (e.get("vendor") or {}).get("id") == "t130_" + vid]


def present(vid):
    return [c for c in files if root.vendor("t130_" + vid, c)]


for vid in ("u", "w"):
    if present(vid) or not any(removed_in(vid, c) for c in files):
        bad.append("%s (CLOSED_PERMANENTLY, ít đánh giá): mong GỠ khỏi mọi file, còn ở %r" % (vid, present(vid)))
    for c in files:
        a = root.audit(c).get("t130_" + vid) or {}
        if a.get("reject_reason") == k.CODE:
            bad.append("%s (%s): bị gỡ vì đóng cửa không được mang few_reviews" % (vid, c))
ya = root.audit("makeup").get("t130_y") or {}
if present("y") != ["makeup"] or removed_in("y", "makeup") or ya.get("reject_reason") != "address_conflict":
    bad.append("y (CLOSED_PERMANENTLY bị cổng từ chối): mong ở lại + address_conflict, thấy ở %r, %r" % (present("y"), ya.get("reject_reason")))
if not present("z") or removed_in("z", "venue"):
    bad.append("z (duyệt tay temporarily_closed + Google CLOSED_PERMANENTLY 0 đánh giá): duyệt tay thắng, mong KHÔNG gỡ")
za = root.audit("venue").get("t130_z") or {}
if za.get("reject_reason") == k.CODE:
    bad.append("z: duyệt tay không được thành few_reviews")
sa = root.audit("flower").get("t130_s") or {}
if not x.is_temp_closed(sa) or sa.get("reject_reason") == k.CODE or removed_in("s", "flower") or t.has_pid(root.vendor("t130_s", "flower")):
    bad.append("s (CLOSED_TEMPORARILY, 1 đánh giá): mong tạm đóng cửa retry, thấy %r" % {q: sa.get(q) for q in ("status", "retry", "closed_state", "reject_reason")})
if [c_ for c_ in calls if c_["kind"] == "media" and any("/places/P%s/" % v in c_["url"] for v in ("u", "w", "y", "z", "s"))]:
    bad.append("tốn lượt ảnh cho vendor không được nhận")
# ---- đường tên ----
b = root.audit("invitation").get("t130_o2") or {}
if b.get("reject_reason") not in h.ELIGIBLE_REASONS:
    t.fail("fixture hỏng: o2 mong address_conflict/unconfirmed ở bước 0, thấy %r" % b.get("reject_reason"))
rc2, out2, calls2 = root.run(h.recheck_argv([{"cat": c} for c in files]), FX)
if rc2 != 0:
    t.fail("recheck thoát %d: %s" % (rc2, (out2.strip().splitlines() or [""])[-1][:160]))
oa = root.audit("invitation").get("t130_o2") or {}
if not present("o2") or removed_in("o2", "invitation") or oa.get("reject_reason") == k.CODE or t.has_pid(root.vendor("t130_o2", "invitation")) or not x.is_temp_closed(oa):
    bad.append("o2 (đường tên, CLOSED_TEMPORARILY 1 đánh giá): mong ở lại, tạm đóng cửa retry, không few_reviews, không place_id; thấy %r" % {q: oa.get(q) for q in ("status", "retry", "closed_state", "reject_reason")})
if t.n_kind(calls2, "media"):
    bad.append("recheck tốn %d lượt ảnh (mong 0)" % t.n_kind(calls2, "media"))
t.done(bad, "C-1 = False ở biên: đóng vĩnh viễn 1/vắng đánh giá gỡ mọi file; bị cổng từ chối ở lại; duyệt tay không gỡ; tạm đóng 1 đánh giá retry ở cả hai đường")
