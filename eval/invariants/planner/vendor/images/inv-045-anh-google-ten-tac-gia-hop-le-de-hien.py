#!/usr/bin/env python3
"""Nguồn: T-156 (spec products/T-156-ghi-cong-anh-google-o-moi-be-mat.md, tiêu chí 1; ADR-041 điểm 4), rút bởi spec-critic tại Spec Gate 2026-11-14
từ bản nháp của product eval/T-156/bat-bien-cho-merge/inv-xxx-ghi-cong-pool-ten-tac-gia-hop-le.py. Spec-critic sửa hai chỗ: giải mã pool bằng export
GENERATED_VENDOR_POOL như INV-013 (không cắt chuỗi theo "= [" đầu tiên); thiếu repo tohong-back thì PASS "chưa áp dụng" như INV-013 (không làm đỏ việc khác).
Xanh trên pool thật 2026-11-14 (410 ảnh Google / 207 vendor).
INV-045 (planner/vendor/images) · Pool vendor: mọi ảnh Google mang tên tác giả HỢP LỆ ĐỂ HIỆN; mở rộng INV-013 (INV-013 chỉ đòi "không rỗng"), không thay nó.
Ảnh Google = `source` == "google" (không phân biệt hoa thường, bỏ khoảng trắng) HOẶC `url` ở host googleusercontent.com hay tên miền con (cùng định nghĩa INV-013).
Với MỌI ảnh Google trong lib/vendorPool.generated.js:
  (1) `attribution` là chuỗi, sau trim không rỗng, không khoảng trắng đầu/cuối, không ký tự điều khiển/xuống dòng (kể cả U+2028/U+2029), dài <= 120;
  (2) không phải nhãn chung chung thay cho tên: "google", "google maps", "google maps contributor", "undefined", "null", "none", "n/a", "-" (không phân biệt hoa thường);
  (3) host Google khi và chỉ khi `source` == "google" (nhãn nguồn sai làm app hiểu sai ảnh nào phải ghi công).
Với MỌI ảnh KHÔNG phải Google: không có trường `attribution` (app không ghi công ảnh marry; dữ liệu không được gây hiểu lầm).
Lý do: app hiện NGUYÊN VĂN tên tác giả cạnh từng ảnh Google (T-156); tên rác, chung chung hay nhãn nguồn sai thì app hoặc ghi công sai, hoặc phải ẩn ảnh.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back cạnh cwd, rồi ../tohong-back cạnh mọi thư mục tổ tiên của file này. Không thấy: PASS "chưa áp dụng".
Pool không giải mã được hoặc không có ảnh Google nào: FAIL. Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, re, sys
from urllib.parse import urlsplit

POOL_FILE = os.path.join("lib", "vendorPool.generated.js")
def _up():
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        yield os.path.join(d, "..", "tohong-back")
        n = os.path.dirname(d)
        if n == d: return
        d = n
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")] + list(_up())
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, POOL_FILE))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy tohong-back/%s)" % POOL_FILE); sys.exit(0)

text = open(os.path.join(repo, POOL_FILE), encoding="utf-8").read()
m = re.search(r"export\s+const\s+GENERATED_VENDOR_POOL\s*=\s*", text)
if not m: print("FAIL %s không có export GENERATED_VENDOR_POOL" % POOL_FILE); sys.exit(1)
try: pool, _ = json.JSONDecoder().raw_decode(text, m.end())
except ValueError as e: print("FAIL không giải mã được GENERATED_VENDOR_POOL: %s" % e); sys.exit(1)
if not isinstance(pool, list): print("FAIL GENERATED_VENDOR_POOL không phải mảng"); sys.exit(1)

def ghost(u):
    try: h = (urlsplit(u.strip()).hostname or "").lower()
    except (ValueError, AttributeError): return False
    return h == "googleusercontent.com" or h.endswith(".googleusercontent.com")
GENERIC = {"google", "google maps", "google maps contributor", "undefined", "null", "none", "n/a", "-"}
CTRL = re.compile("[\u0000-\u001f\u007f-\u009f  ]")
bad, ng, nv = [], 0, set()
for v in pool:
    if not isinstance(v, dict): continue
    for p in v.get("photos") or []:
        if not isinstance(p, dict): continue
        src = p.get("source")
        srcg = isinstance(src, str) and src.strip().lower() == "google"
        hostg = isinstance(p.get("url"), str) and ghost(p["url"])
        where = "%s %s" % (v.get("id"), str(p.get("url"))[-28:])
        if srcg != hostg: bad.append("%s: source=%r nhưng host %s Google" % (where, src, "là" if hostg else "không phải"))
        if srcg or hostg:
            ng += 1; nv.add(v.get("id")); a = p.get("attribution")
            if not isinstance(a, str) or not a.strip(): bad.append("%s: thiếu attribution (%r)" % (where, a)); continue
            if a != a.strip(): bad.append("%s: attribution có khoảng trắng đầu/cuối %r" % (where, a))
            if CTRL.search(a): bad.append("%s: attribution có ký tự điều khiển/xuống dòng %r" % (where, a))
            if len(a.strip()) > 120: bad.append("%s: attribution dài %d > 120" % (where, len(a.strip())))
            if a.strip().lower() in GENERIC: bad.append("%s: attribution chung chung %r" % (where, a))
        elif "attribution" in p: bad.append("%s: ảnh không phải Google mà có trường attribution %r" % (where, p.get("attribution")))
if ng == 0: bad.append("pool không có ảnh Google nào (bất biến không đo được)")
if bad:
    print("FAIL %d lỗi, vd: %s" % (len(bad), "; ".join(bad[:3]))); sys.exit(1)
print("PASS %d ảnh Google của %d vendor đều có tên tác giả hợp lệ để hiện; ảnh khác không mang attribution" % (ng, len(nv))); sys.exit(0)
