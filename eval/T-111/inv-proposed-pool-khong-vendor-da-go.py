#!/usr/bin/env python3
"""Bản nháp bất biến (T-111, Spec critic rút vào bể khi spec qua cổng; vùng planner/vendor/images).
INV-? · Pool không chứa vendor đã bị gỡ (v2: chỉ vế "đã gỡ"; vế tạm đóng cửa đã có ở INV-021 (f) của T-110, dùng closed_state + retry, không nhắc lại để khỏi hai định nghĩa).
Mọi id trong tohong-back/lib/vendorPool.generated.js: (1) không phải id chỉ còn trong removed_vendors.json (có bản ghi ở bất kỳ category file HCMC nào và không còn trong vendors.json nào);
(2) [bỏ ở v2: INV-021 (f)].
Lý do: ADR-049 "không hiển thị trên app"; vendor đã gỡ/tạm đóng còn trong pool là cặp đôi vẫn thấy nhà hàng không tồn tại hoặc đang đóng cửa.
Repo: TOHONG_REPO, TOHONG_BACK_REPO, rồi ../tohong(-back) cạnh tohong-hq. Thiếu repo: PASS "chưa áp dụng". Không gọi Google. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)):
            return os.path.abspath(c)


tr = find("TOHONG_REPO", os.path.join("tools", "scraper", "enrich.py"), "tohong")
bk = find("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")
if not tr or not bk:
    print("PASS chưa áp dụng (thiếu repo tohong hoặc tohong-back)")
    sys.exit(0)
s = open(os.path.join(bk, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
pool = {v["id"] for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])}
out = os.path.join(tr, "tools", "scraper", "output", "HCMC")
live, removed, temp = set(), set(), set()
for d in glob.glob(os.path.join(out, "*")):
    vp, rp, ap = (os.path.join(d, n) for n in ("vendors.json", "removed_vendors.json", "enrichment-audit.json"))
    if os.path.isfile(vp):
        live |= {v["id"] for v in json.load(open(vp, encoding="utf-8")).get("vendors", [])}
    if os.path.isfile(rp):
        removed |= {e["vendor"]["id"] for e in json.load(open(rp, encoding="utf-8"))}
    if os.path.isfile(ap):
        for a in json.load(open(ap, encoding="utf-8")):
            pass
bad = sorted(pool & (removed - live))
if bad:
    print("FAIL %d vendor đã gỡ/tạm đóng còn trong pool, vd %s" % (len(bad), ", ".join(bad[:4])))
    sys.exit(1)
print("PASS pool %d vendor, không vendor đã gỡ (%d)" % (len(pool), len(removed - live)))
