#!/usr/bin/env python3
"""T-156 tiêu chí 1 (tohong-back, pool THẬT): dữ liệu đủ để ghi công đúng yêu cầu Google. Không mạng, không Google.
Ảnh Google = `source` == "google" (không phân biệt hoa thường, bỏ khoảng trắng) HOẶC `url` ở host googleusercontent.com (cùng định nghĩa INV-013).
Với MỌI ảnh Google trong lib/vendorPool.generated.js:
  (1) `attribution` là chuỗi, sau trim không rỗng, không có khoảng trắng đầu/cuối, không có ký tự điều khiển hay xuống dòng, dài <= 120 ký tự;
  (2) `attribution` không phải nhãn chung chung thay cho tên tác giả: "google", "google maps", "google maps contributor", "undefined", "null", "none", "n/a", "-" (không phân biệt hoa thường)
      (Google: chỉ ghi "Google Maps" không phải ghi công khi có tên tác giả);
  (3) ảnh có host Google thì `source` == "google" và ngược lại (nhãn nguồn sai làm app tưởng không phải ảnh Google).
Với MỌI ảnh KHÔNG phải Google: không mang trường `attribution` (app không hiện ghi công cho ảnh marry; dữ liệu không được gây hiểu lầm).
Repo tohong-back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh tohong-hq. Không thấy: FAIL, thoát 2. In PASS <số ảnh Google, số vendor> hoặc FAIL <lý do>. Chạy: python3 -I eval/T-156/check_1_pool_that.py"""
import json, os, re, sys
from urllib.parse import urlsplit
def _up():
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        yield os.path.join(d, "..", "tohong-back")
        n = os.path.dirname(d)
        if n == d: return
        d = n
cands = [os.environ.get("TOHONG_BACK_REPO"), os.path.join(os.getcwd(), "..", "tohong-back")] + list(_up())
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
if not repo: print("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(2)
t = open(os.path.join(repo, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
try: pool = json.loads(t[t.index("= [") + 2:t.rindex("]") + 1])
except ValueError as e: print("FAIL không giải mã được pool: %s" % e); sys.exit(1)
def ghost(u):
    try: h = (urlsplit(u.strip()).hostname or "").lower()
    except (ValueError, AttributeError): return False
    return h == "googleusercontent.com" or h.endswith(".googleusercontent.com")
GENERIC = {"google", "google maps", "google maps contributor", "undefined", "null", "none", "n/a", "-"}
bad, ng, nv = [], 0, set()
for v in pool:
    for p in v.get("photos") or []:
        if not isinstance(p, dict): continue
        src = p.get("source"); srcg = isinstance(src, str) and src.strip().lower() == "google"; hostg = isinstance(p.get("url"), str) and ghost(p["url"])
        where = "%s %s" % (v.get("id"), str(p.get("url"))[-28:])
        if srcg != hostg: bad.append("%s: source=%r nhưng host %s Google" % (where, src, "là" if hostg else "không phải"))
        if srcg or hostg:
            ng += 1; nv.add(v.get("id")); a = p.get("attribution")
            if not isinstance(a, str) or not a.strip(): bad.append("%s: thiếu attribution (%r)" % (where, a)); continue
            if a != a.strip(): bad.append("%s: attribution có khoảng trắng đầu/cuối %r" % (where, a))
            if re.search(r"[\u0000-\u001f\u007f-\u009f  ]", a): bad.append("%s: attribution có ký tự điều khiển/xuống dòng %r" % (where, a))
            if len(a.strip()) > 120: bad.append("%s: attribution dài %d > 120" % (where, len(a.strip())))
            if a.strip().lower() in GENERIC: bad.append("%s: attribution chung chung %r" % (where, a))
        elif "attribution" in p: bad.append("%s: ảnh không phải Google mà có trường attribution %r" % (where, p.get("attribution")))
if ng == 0: bad.append("pool không có ảnh Google nào (eval không đo được)")
if bad:
    print("FAIL %d lỗi, vd: %s" % (len(bad), "; ".join(bad[:3]))); sys.exit(1)
print("PASS %d ảnh Google của %d vendor trong pool thật đều có tên tác giả hợp lệ; ảnh khác không mang attribution" % (ng, len(nv))); sys.exit(0)
