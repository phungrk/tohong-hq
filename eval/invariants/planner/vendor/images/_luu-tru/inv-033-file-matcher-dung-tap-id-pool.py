#!/usr/bin/env python3
"""Nguồn: T-136 (spec products/T-136-chat-vendor-theo-pool.md v3, "Bất biến đề xuất" INV-A; Hành vi B1/B3/B4), qua Spec Gate 2026-11-12 (spec-critic).
Nằm ở eval/T-136/bat-bien-cho-merge/ cho tới khi PR code T-136 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào
eval/invariants/planner/vendor/images/ (số 033 của vùng này).
INV-033 · Nếu tohong-back/matcher-data/vendors.json tồn tại thì nó là JSON dạng {"vendors":[...]}, mỗi phần tử có "id" là chuỗi, không id trùng,
và TẬP id của nó == tập id của lib/vendorPool.generated.js (không thừa, không thiếu). Chưa có file thì PASS "chưa áp dụng".
Lý do: matcher (Cloud Run) đọc bản này qua bucket; id thừa = vendor đã gỡ có thể quay lại matcher, id thiếu = vendor app có mà matcher không biết.
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/vendorPool.generated.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc. Chạy không tham số (python3 -I). In PASS / FAIL <lý do>."""
import json, os, sys

HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # ADR-057/070: tìm gốc tohong-hq ở mọi độ sâu
    HQ = os.path.dirname(HQ)
POOL_REL = os.path.join("lib", "vendorPool.generated.js")
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-back"))
          if c and os.path.isfile(os.path.join(c, POOL_REL))), None)
if not B:
    print("PASS chưa áp dụng (không thấy tohong-back)"); sys.exit(0)
F = os.path.join(B, "matcher-data", "vendors.json")
if not os.path.isfile(F):
    print("PASS chưa áp dụng (chưa có matcher-data/vendors.json)"); sys.exit(0)
s = open(os.path.join(B, POOL_REL), encoding="utf-8").read()
try:
    pool = json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
    pool_ids = {v["id"] for v in pool}
except Exception as e:
    print(f"FAIL không đọc được pool {POOL_REL}: {e}"); sys.exit(1)
try:
    d = json.load(open(F, encoding="utf-8"))
except Exception as e:
    print(f"FAIL matcher-data/vendors.json không phải JSON hợp lệ: {e}"); sys.exit(1)
vs = d.get("vendors") if isinstance(d, dict) else None
if not isinstance(vs, list):
    print("FAIL matcher-data/vendors.json không có mảng 'vendors'"); sys.exit(1)
ids = [v.get("id") if isinstance(v, dict) else None for v in vs]
if any(not isinstance(i, str) or not i for i in ids):
    print("FAIL có bản ghi không có id chuỗi"); sys.exit(1)
if len(ids) != len(set(ids)):
    print("FAIL có id trùng trong file matcher"); sys.exit(1)
extra, miss = set(ids) - pool_ids, pool_ids - set(ids)
if extra or miss:
    ex = sorted(extra)[:3] + sorted(miss)[:3]
    print(f"FAIL tập id file matcher != tập id pool (pool {len(pool_ids)}, file {len(ids)}, thừa {len(extra)}, thiếu {len(miss)}; vd {ex})"); sys.exit(1)
print(f"PASS file matcher đúng tập id pool ({len(ids)} vendor)")
