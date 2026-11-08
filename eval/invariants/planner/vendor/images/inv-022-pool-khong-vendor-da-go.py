#!/usr/bin/env python3
"""Nguồn: T-111 (spec products/T-111-enrich-toan-bo-vendor.md v3, Hành vi 5; ADR-049 "remove", ADR-044), qua Spec Gate lần 3 2026-11-08 (spec-critic).
Bản nháp: eval/T-111/inv-proposed-pool-khong-vendor-da-go.py. Số 020, 021 đã dành cho T-110 (eval/T-110/bat-bien-cho-merge/).
INV-022 · Pool app không chứa vendor đã bị gỡ.
Mọi id trong tohong-back/lib/vendorPool.generated.js KHÔNG được là id đã gỡ: có bản ghi trong removed_vendors.json của bất kỳ category file HCMC nào
(tools/scraper/output/HCMC/*/removed_vendors.json, repo tohong) và không còn trong vendors.json nào. Vendor được --restore thì không còn là "đã gỡ".
Không phụ thuộc lý do gỡ (CLOSED_PERMANENTLY của ADR-044, no_match của T-111, `remove` duyệt tay của T-110).
Vế "tạm đóng cửa không có trong pool" KHÔNG nằm ở đây: định nghĩa duy nhất là INV-021 (f) của T-110 (closed_state + retry).
Lý do: cặp đôi không được thấy trên app nhà cung cấp không tồn tại hay đã đóng cửa vĩnh viễn.
Lưu ý vận hành: PR dữ liệu (tohong) merge trước PR pool (tohong-back), nên giữa hai lần merge bất biến này đỏ. Đó là tình trạng thật (app còn hiện vendor đã gỡ),
nên merge PR pool ngay sau PR dữ liệu.
Repo: TOHONG_REPO, TOHONG_BACK_REPO, rồi ../tohong(-back) cạnh tohong-hq. Thiếu repo: PASS "chưa áp dụng". Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))


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
live, removed = set(), set()
for d in glob.glob(os.path.join(out, "*")):
    vp, rp = os.path.join(d, "vendors.json"), os.path.join(d, "removed_vendors.json")
    if os.path.isfile(vp):
        live |= {v["id"] for v in json.load(open(vp, encoding="utf-8")).get("vendors", [])}
    if os.path.isfile(rp):
        removed |= {e["vendor"]["id"] for e in json.load(open(rp, encoding="utf-8"))}
gone = removed - live
bad = sorted(pool & gone)
if bad:
    print("FAIL %d vendor đã gỡ còn trong pool, vd %s" % (len(bad), ", ".join(bad[:4])))
    sys.exit(1)
print("PASS pool %d vendor, không vendor nào trong %d vendor đã gỡ" % (len(pool), len(gone)))
