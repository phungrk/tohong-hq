#!/usr/bin/env python3
"""ĐỀ XUẤT bất biến (vùng planner/vendor/pool) từ T-217: vendor có verification_status="verified" trong HCMC/venue/vendors.json mà pool xếp vào hạng mục venue
thì pool (tohong-back lib/vendorPool.generated.js) mang đúng mô tả và sức chứa của nguồn: description == nguồn.description cắt 220 đơn vị UTF-16;
capacity: có capacity_min hoặc capacity_max thì {min: capacity_min hoặc 100, max: capacity_max hoặc 300}; không có cả hai thì không ràng buộc;
giá: price_range.price_source == "verified" thì priceMin = min_vnd/1e6, priceMax = max_vnd/1e6, priceSource "verified", không có priceAsOf (ADR-138).
Lý do: "verified" là hợp đồng "nguồn được người duyệt thì pool phải theo nguồn" (tools/generate-vendor-pool.js --verified-only); pool cũ hơn nguồn (quên Sync) là dữ liệu sai mà cặp đôi thấy.
Chỉ đọc. Repo: TOHONG_REPO, TOHONG_BACK_REPO. Thiếu repo hoặc không có vendor verified thì PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
import json, os, sys

def _find_hq(start):
    """ADR-070: dò ngược tới thư mục có scripts/gate.py, không đếm cấp (file này chạy ở eval/T-217/ lúc đề xuất và ở eval/invariants/<vùng>/ sau khi vào bể)."""
    d = os.path.dirname(os.path.realpath(start))
    while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
        d = os.path.dirname(d)
    return d if os.path.isfile(os.path.join(d, "scripts", "gate.py")) else None
_HQ = _find_hq(__file__)
if not _HQ:
    print("FAIL không dò được gốc tohong-hq (scripts/gate.py) từ vị trí file"); sys.exit(1)
sys.path.insert(0, os.path.join(_HQ, "eval", "T-217"))   # helper nằm ở eval/T-217/ tính từ gốc HQ, không phải thư mục của file này
import _t217 as T


def run():
    t, b = T.R.repos(need_back=True)
    _, vs = T.load(os.path.join(t, T.VENUE))
    ver = [v for v in vs if v.get("verification_status") == "verified"]
    if not ver:
        return "chưa áp dụng (không có vendor verified)"
    pv = T.pool_venue_ids(t)
    s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
    pool = {v["id"]: v for v in json.loads(s[s.index("= [") + 2: s.rindex("]") + 1])}
    bad, n = [], 0
    for v in ver:
        if v["id"] not in pv or v["id"] not in pool:
            continue
        n += 1
        p = pool[v["id"]]
        if isinstance(v.get("description"), str) and p.get("description") != T.u16_cut(v["description"], 220):
            bad.append(f"{v['id']}: description pool lệch nguồn")
        if v.get("capacity_min") is not None or v.get("capacity_max") is not None:
            want = {"min": 100 if v.get("capacity_min") is None else v["capacity_min"], "max": 300 if v.get("capacity_max") is None else v["capacity_max"]}
            if p.get("capacity") != want:
                bad.append(f"{v['id']}: capacity pool {p.get('capacity')}, cần {want}")
        pr = v.get("price_range")
        if isinstance(pr, dict) and pr.get("price_source") == "verified":
            got = {k: p.get(k) for k in ("priceMin", "priceMax", "priceSource")}
            want = {"priceMin": pr["min_vnd"] / 1e6, "priceMax": pr["max_vnd"] / 1e6, "priceSource": "verified"}
            if got != want or "priceAsOf" in p:
                bad.append(f"{v['id']}: giá pool {got}, cần {want}")
    if bad:
        raise T.Fail(f"{len(bad)} vendor verified có pool lệch nguồn, vd {bad[0]}")
    return f"{n} vendor verified có pool khớp nguồn (mô tả, sức chứa, giá)"


try:
    m = run()
except T.Fail as e:
    print("FAIL " + str(e)); sys.exit(1)
print("PASS " + m)
