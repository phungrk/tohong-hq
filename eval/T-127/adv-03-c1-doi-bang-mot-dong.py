#!/usr/bin/env python3
"""T-127 adv-03 (adversary, tầng 3): điều kiện C-1 (spec T-126 Hành vi 1(b1), ADR-063) "đổi được bằng MỘT dòng".
Đổi đúng một dòng `FEW_REVIEWS_BEATS_CLOSED = True` -> `False` trong bản sao enrichment/google_maps.py (handoff T-127 nói đó là công tắc), rồi chạy enrich thường với Google giả:
  k CLOSED_PERMANENTLY + 0 đánh giá -> mong GỠ (removed_vendors.json, như ADR-044) · l CLOSED_TEMPORARILY + 0 -> mong tạm đóng cửa (retry=true) · e OPERATIONAL + 0 -> vẫn few_reviews.
Với giá trị mặc định (True) đối chứng: k, l few_reviews, không gỡ. Diff của bản sao so với code gốc phải đúng 1 dòng. OFFLINE. In PASS/FAIL; thoát 0/1."""
import difflib, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-126"))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
S = k.ADDR
V = [("k", "Hoa Kyanite Closed", "flower", S % 18, 0, "CLOSED_PERMANENTLY"), ("l", "Hoa Lazurite Temp", "flower", S % 19, 0, "CLOSED_TEMPORARILY"),
     ("e", "Hoa Emerald Zero", "flower", S % 16, 0, "OPERATIONAL")]


def scenario(flip):
    files, PL, rules = {}, {}, []
    for vid, name, cat, addr, n, st in V:
        files.setdefault(cat, []).append(t.vendor("t127c_" + vid, name, addr, (h.DIR_CATEGORY[cat],)))
        PL["P" + vid] = k.pl(name, addr, "P" + vid, n=n, status=st)
        rules.append((h.fold(name), ["P" + vid]))
    rules.sort(key=lambda r: -len(r[0]))
    root = t.Root(files)
    x.usage_logs(root, ts=0, details=0, media=0)
    gm = os.path.join(root.path, "enrichment", "google_maps.py")
    src = open(gm, encoding="utf-8").read()
    if flip:
        new = src.replace("FEW_REVIEWS_BEATS_CLOSED = True", "FEW_REVIEWS_BEATS_CLOSED = False", 1)
        d = [l for l in difflib.unified_diff(src.splitlines(), new.splitlines(), lineterm="", n=0) if l[:1] in "+-" and not l.startswith(("+++", "---"))]
        if len(d) != 2:
            t.fail("công tắc C-1 không phải đúng một dòng `FEW_REVIEWS_BEATS_CLOSED = True` (diff %d dòng)" % len(d))
        open(gm, "w", encoding="utf-8").write(new)
    rc, out, calls = root.run(x.enrich_all(["flower"]), x.fx(PL, rules))
    if rc != 0:
        t.fail("enrich thoát %d (flip=%s): %s" % (rc, flip, (out.strip().splitlines() or [""])[-1][:160]))
    removed = {(e.get("vendor") or {}).get("id") for e in root.removed("flower")}
    return root, removed


root, removed = scenario(False)
for vid in ("k", "l", "e"):
    bad += ["[mặc định] " + b for b in k.demoted_state_ok(root, "t127c_" + vid, 0)]
root, removed = scenario(True)
if "t127c_k" not in removed:
    bad.append("[C-1 = False] k (CLOSED_PERMANENTLY, 0 đánh giá) mong bị gỡ như ADR-044, thấy không gỡ")
la = root.audit("flower").get("t127c_l") or {}
if not x.is_temp_closed(la):
    bad.append("[C-1 = False] l (CLOSED_TEMPORARILY, 0 đánh giá) mong tạm đóng cửa retry=true, thấy %r" % {a: la.get(a) for a in ("status", "reject_reason", "retry")})
bad += ["[C-1 = False] " + b for b in k.demoted_state_ok(root, "t127c_e", 0)]
t.done(bad, "C-1 đổi bằng đúng một dòng: True -> few_reviews thắng đóng cửa; False -> đóng cửa thắng (gỡ/tạm đóng), OPERATIONAL ít đánh giá vẫn few_reviews")
