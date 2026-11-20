#!/usr/bin/env python3
"""T-217 tiêu chí 3: mô phỏng Sync trên bản sao tạm. Với mỗi vendor thuộc S: pool.description == nguồn.description cắt 220 đơn vị UTF-16;
pool.capacity theo luật spec (Hành vi 3: min = capacity_min nếu có, không thì 100; max = capacity_max nếu có, không thì 300; không có cả hai thì y nguyên);
giá (ADR-138): nếu price_range nguồn có price_source=verified thì pool có priceMin = min_vnd/1e6, priceMax = max_vnd/1e6 (không làm tròn), priceSource "verified", KHÔNG có priceAsOf; nếu nguồn không verified thì bốn trường giá y nguyên nền B; bản ghi S còn price_source google_ai_mode mà đủ điều kiện đổi (T.convertible) là lỗi; MỌI trường khác y nguyên so với nền B. Vendor ngoài S: nguyên mục y hệt nền B. Số vendor, thứ tự id y hệt.
Chạy: python3 -I <file>."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t217 as T, _sim

PRICE = ("priceMin", "priceMax", "priceSource", "priceAsOf")


def run():
    A, B, S, src = _sim.simulate()
    try:
        pa, pb = A.pool(), B.pool()
        if list(pa) != list(pb):
            raise T.Fail("tập hoặc thứ tự id của pool đổi so với nền")
        ss = set(S)
        for i in pa:
            if i not in ss and pa[i] != pb[i]:
                raise T.Fail(f"{i} ngoài S nhưng mục pool đổi: {sorted(k for k in set(pa[i]) | set(pb[i]) if pa[i].get(k) != pb[i].get(k))}")
        bad = []
        for i in S:
            if i not in pa:
                bad.append(f"{i} thuộc S nhưng không có trong pool"); continue
            a, b, r = pa[i], pb[i], src[i]
            want_d = T.u16_cut(r["description"], 220)
            if a.get("description") != want_d:
                bad.append(f"{i}: description pool chưa khớp nguồn (pool {str(a.get('description'))[:40]!r}…, nguồn {want_d[:40]!r}…)")
            if a.get("category") == "venue":
                want_c = T.expected_capacity(r, b.get("capacity"))
                if a.get("capacity") != want_c:
                    bad.append(f"{i}: capacity pool {a.get('capacity')}, cần {want_c}")
            pr = r.get("price_range")
            if T.convertible(pr):
                bad.append(f"{i}: price_range còn google_ai_mode (cần đổi sang verified, ADR-138)")
            if isinstance(pr, dict) and pr.get("price_source") == "verified":
                want_p = {"priceMin": pr["min_vnd"] / 1e6, "priceMax": pr["max_vnd"] / 1e6, "priceSource": "verified"}
                got_p = {k: a.get(k) for k in ("priceMin", "priceMax", "priceSource")}
                if got_p != want_p or "priceAsOf" in a:
                    bad.append(f"{i}: giá pool {got_p} priceAsOf={a.get('priceAsOf')!r}, cần {want_p} không priceAsOf")
                skip = PRICE
            else:
                skip = ()
            for k in set(a) | set(b):
                if k in ("description", "capacity") or k in skip:
                    continue
                if a.get(k) != b.get(k):
                    bad.append(f"{i}: trường {k} đổi ngoài description/capacity" + (" (giá không được đổi ở việc này)" if k in PRICE else ""))
        if bad:
            raise T.Fail(f"{len(bad)} lệch, vd: {bad[0]}")
        return f"{len(S)} vendor thuộc S: mô tả và sức chứa khớp nguồn, giá theo nguồn verified, mọi trường khác y nguyên; {len(pa) - len(S)} vendor ngoài S y hệt nền"
    finally:
        A.close(); B.close()


T.R.main_guard(run)
