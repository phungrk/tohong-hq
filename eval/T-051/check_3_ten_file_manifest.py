#!/usr/bin/env python3
"""T-051 tiêu chí 3: tên file = vendor id + 12 hex đầu của sha256(URL gốc), ổn định; manifest ánh xạ URL gốc -> URL mới đủ trường.
Chạy: python3 eval/T-051/check_3_ten_file_manifest.py --back /đường/dẫn/tohong-back. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, json, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *
from PIL import Image

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")
w = Work()
try:
    need_summary(w.mirror(back), "mirror")
    m = w.man()
    if m.get("version") != 1: fail("manifest.version phải = 1")
    if m.get("baseUrl") != BASE_URL: fail(f"manifest.baseUrl phải = {BASE_URL}, thấy {m.get('baseUrl')}")
    ents = m.get("entries")
    if not isinstance(ents, dict): fail("manifest.entries phải là object khoá = URL gốc")
    pool_urls = {u for _, u in refs(w.vendors)}
    if set(ents) != pool_urls: fail("khoá manifest phải đúng bằng tập URL ảnh duy nhất của pool (không thừa, không thiếu, kể cả ảnh lỗi)")
    for url, e in ents.items():
        if e["status"] == "ok":
            owners = sorted({v for v, u in refs(w.vendors) if u == url})
            exp = f"v/{owners[0]}-{sha12(url)}.webp"
            if e["file"] != exp: fail(f"tên file phải là {exp} (vendor id nhỏ nhất trong các vendor dùng URL + sha256[:12] của URL), thấy {e['file']}")
            f = os.path.join(w.out, e["file"])
            im = Image.open(f)
            if (e.get("width"), e.get("height")) != im.size: fail(f"{url}: width/height trong manifest lệch file thật")
            if e.get("bytes") != os.path.getsize(f): fail(f"{url}: bytes trong manifest lệch file thật")
        elif e["status"] == "failed":
            if not e.get("reason") or int(e.get("attempts", 0)) < 1: fail(f"{url}: entry failed cần reason và attempts>=1")
            if "file" in e and e["file"]: fail(f"{url}: entry failed không có file")
        else:
            fail(f"{url}: status phải là ok|failed, thấy {e['status']}")
    if sum(e["status"] == "ok" for e in ents.values()) != len(OK_URLS): fail("số entry ok không khớp fixture")
    # ổn định: thêm vendor mới có id NHỎ HƠN cùng dùng big.jpg, chạy lại -> tên file cũ không đổi
    before = {u: e["file"] for u, e in ents.items() if e["status"] == "ok"}
    vs = w.vendors + [vendor("marry_000000000000", [w.fm.url("/ok/big.jpg")])]
    write_pool(w.pool, vs)
    need_summary(w.mirror(back), "mirror lần 2")
    after = {u: e["file"] for u, e in w.man()["entries"].items() if e["status"] == "ok"}
    for u, f in before.items():
        if after.get(u) != f: fail(f"tên file đổi khi thêm vendor mới: {before[u]} -> {after.get(u)}")
    # hai lần chạy trên thư mục sạch cho cùng tên (xác định, không phụ thuộc thời điểm)
    w2 = Work(); 
    try:
        write_pool(w2.pool, standard_pool(w2.fm))
        # port khác -> URL khác -> hash khác; chỉ kiểm cùng cấu trúc
        need_summary(w2.mirror(back), "mirror w2")
        if not all(re.fullmatch(r"v/marry_[a-z0-9]+-[0-9a-f]{12}\.webp", e["file"]) for e in w2.man()["entries"].values() if e["status"] == "ok"): fail("tên file sai khuôn v/<id>-<12hex>.webp")
    finally:
        w2.stop()
    ok(f"{len(before)} tên file đúng khuôn, ổn định khi thêm vendor; manifest đủ trường")
finally:
    w.stop()
