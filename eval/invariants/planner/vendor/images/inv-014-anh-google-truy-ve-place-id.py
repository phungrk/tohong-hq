#!/usr/bin/env python3
"""Nguồn: T-106 (spec products/T-106-enrich-venue.md v3, "Bất biến đề xuất" A; ADR-041; qua Spec Gate lần 3 2026-11-08, spec-critic; bản nháp eval/T-106/inv-proposed-anh-google-truy-ve-place-id.py).
INV-014 · Ảnh Google trong pool truy được về place_id: mọi vendor trong lib/vendorPool.generated.js (tohong-back) có ít nhất một ảnh source=google
phải có bản ghi cùng id trong tohong/tools/scraper/output/HCMC/*/vendors.json với enrichment_log[source=google_maps].place_id khác rỗng.
Lý do: photoUri hết hạn; ảnh chỉ làm mới hàng tháng và gỡ (404) được qua place_id, và Terms Google chỉ cho lưu place_id. Ảnh Google mồ côi
không còn cách làm mới hay kiểm nguồn. Ngày rút: đúng 68/68.
Repo: TOHONG_REPO / TOHONG_BACK_REPO, rồi ../tohong(-back) cạnh tohong-hq, rồi ../tohong(-back) cạnh cwd. Thiếu một trong hai repo: PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))
def find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib), os.path.join(os.getcwd(), "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)): return os.path.abspath(c)
t = find("TOHONG_REPO", os.path.join("tools", "scraper", "enrich.py"), "tohong")
b = find("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")
if not t or not b: print("PASS chưa áp dụng (thiếu repo tohong hoặc tohong-back)"); sys.exit(0)
s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
try:
    pool = json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
except ValueError as e:
    print("FAIL không giải mã được pool: %s" % e); sys.exit(1)
has = set()
for f in glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*", "vendors.json")):
    d = json.load(open(f, encoding="utf-8"))
    for v in (d.get("vendors", []) if isinstance(d, dict) else d):
        if any(e.get("source") == "google_maps" and e.get("place_id") for e in v.get("enrichment_log") or []): has.add(v.get("id"))
withg = [p["id"] for p in pool if any(isinstance(x, dict) and x.get("source") == "google" for x in p.get("photos") or [])]
orphan = [i for i in withg if i not in has]
if orphan: print("FAIL %d/%d vendor có ảnh Google nhưng không có place_id trong dữ liệu nguồn, vd %s" % (len(orphan), len(withg), orphan[0])); sys.exit(1)
print("PASS %d vendor có ảnh Google đều có place_id nguồn" % len(withg)); sys.exit(0)
