#!/usr/bin/env python3
"""Nguồn: T-104 (spec tohong/specs/005-google-place-photos FR-002; PR phungrk/tohong #65 #69, phungrk/tohong-back #41 main d3dfa18,
T-156: app chỉ hiện ghi công khi ảnh có `attribution`; #64 chưa merge tính tới 2026-11-14, xem ADR-096); rút vào bể khi adversary đọc lại việc Capu làm ngoài HQ (Cowork 07–08/11).
INV-013 · Mọi ảnh Google trong pool vendor của tohong-back có `attribution` là chuỗi không rỗng sau khi bỏ khoảng trắng.
"Ảnh Google" = phần tử có `source` == "google" (không phân biệt hoa thường, bỏ khoảng trắng) HOẶC có `url` trên host googleusercontent.com
(ảnh Google gắn nhãn sai nguồn cũng phải ghi công). Lý do: Terms của Google bắt hiện tác giả. Đây là điều kiện cần (dữ liệu); điều kiện đủ (app hiện tên ở mọi bề mặt) do bất biến planner/front/vendor-images ghi-cong-hien-o-moi-be-mat đo, hiệu lực sau khi T-156 merge.
Cách đo: đọc lib/vendorPool.generated.js, giải mã JSON sau mọi `export const <TÊN> =`, duyệt đệ quy mọi object; đạt khi không ảnh Google nào
thiếu attribution, attribution không phải chuỗi, hoặc attribution chỉ có khoảng trắng. In số ảnh Google đã kiểm.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back (repo có lib/vendorPool.generated.js). Không tìm thấy: PASS "chưa áp dụng".
Pool không giải mã được: FAIL.
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, re, sys
from urllib.parse import urlsplit

POOL_FILE = os.path.join("lib", "vendorPool.generated.js")
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, POOL_FILE))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy tohong-back/%s)" % POOL_FILE); sys.exit(0)

text = open(os.path.join(repo, POOL_FILE), encoding="utf-8").read()
dec = json.JSONDecoder()
exports = {}
for m in re.finditer(r"export\s+const\s+(\w+)\s*=\s*", text):
    try:
        exports[m.group(1)], _ = dec.raw_decode(text, m.end())
    except ValueError as e:
        print("FAIL không giải mã được export %s trong %s: %s" % (m.group(1), POOL_FILE, e)); sys.exit(1)
if "GENERATED_VENDOR_POOL" not in exports:
    print("FAIL %s không có export GENERATED_VENDOR_POOL dạng JSON" % POOL_FILE); sys.exit(1)

def google_host(url):
    try: h = (urlsplit(url.strip()).hostname or "").lower()
    except (ValueError, AttributeError): return False
    return h == "googleusercontent.com" or h.endswith(".googleusercontent.com")

checked, bad = 0, []
def walk(o, where):
    global checked
    if isinstance(o, list):
        for i, x in enumerate(o): walk(x, where)
    elif isinstance(o, dict):
        vid = o.get("id", where) if isinstance(o.get("id"), str) else where
        src = o.get("source")
        is_g = (isinstance(src, str) and src.strip().lower() == "google") or (isinstance(o.get("url"), str) and google_host(o["url"]))
        if is_g:
            checked += 1
            a = o.get("attribution")
            if not isinstance(a, str) or not a.strip():
                bad.append("%s: source=%r attribution=%r url=%s" % (where, src, a, str(o.get("url"))[:70]))
        for k, v in o.items():
            if isinstance(v, (list, dict)): walk(v, vid)
for name, val in exports.items(): walk(val, name)

if bad:
    print("FAIL %d/%d ảnh Google thiếu ghi công (attribution rỗng/khoảng trắng/không có):" % (len(bad), checked))
    for b in bad[:15]: print("  " + b)
    sys.exit(1)
print("PASS %d ảnh Google trong pool đều có attribution không rỗng" % checked)
