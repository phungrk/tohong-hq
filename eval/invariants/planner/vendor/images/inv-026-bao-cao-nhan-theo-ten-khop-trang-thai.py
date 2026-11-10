#!/usr/bin/env python3
"""Nguồn: T-120 (spec products/T-120-nhan-khop-theo-ten.md v2, Hành vi 0 và 5; defect handoffs/T-120-D1.md B2, B3), qua Spec Gate lần 2 2026-11-10 (spec-critic).
INV-026 (planner/vendor/images) · Báo cáo nhận theo tên (name-match-accepted.csv) luôn khớp trạng thái dữ liệu, mỗi id đúng một dòng.
Lý do: file này là diff hành vi bậc C mà Capu đọc để soát vendor được nhận chỉ nhờ tên. Spec chốt nó là SỔ DỰNG LẠI từ trạng thái hiện tại,
không phải ảnh chụp của một lượt chạy và không phải sổ ghi thêm. Eval tầng 1 của T-120 không đo vế "vendor bị hạ sau đó biến mất khỏi file";
bất biến này khoá vế đó cho mọi lần chạy về sau.
Trên tools/scraper/output/HCMC (repo tohong):
  A = tập id có bản ghi enrichment_log[google_maps] MỚI NHẤT (có place_id) mang accepted_by="name_near_exact", ở bất kỳ vendors.json nào (cùng id ở nhiều file là MỘT vendor).
  Với mỗi id trong A, category "nhà" = category ĐẦU TIÊN chứa id theo thứ tự chạy: venue, photography, wedding_attire, makeup, flower, wedding_interior,
  ceremony, invitation, wedding_gift, wedding_ring, wedding_car, honeymoon, wedding_planner, other (category ngoài danh sách xếp sau, theo tên).
  (a) Mọi <category>/name-match-accepted.csv có cột đúng thứ tự id,name,google_name,similarity,address_source,google_address,place_id,maps_url.
  (b) Hợp các id trong mọi file = A, mỗi id đúng MỘT dòng trên toàn bộ các file, và nằm ở file của category "nhà" của nó.
  (c) Category không có id nào nhận "nhà" thì không có file đó.
  (d) Dòng: place_id = place_id của bản ghi log; maps_url = https://www.google.com/maps/place/?q=place_id:<place_id>; google_address = formatted_address của bản ghi;
      address_source = contact.address_source của vendor.
Chưa có vendor nào nhận theo tên và không có file báo cáo: PASS (rỗng = rỗng). Thiếu repo tohong: PASS "chưa áp dụng". Không gọi Google.
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import csv, glob, json, os, sys

ORDER = ["venue", "photography", "wedding_attire", "makeup", "flower", "wedding_interior", "ceremony", "invitation", "wedding_gift",
         "wedding_ring", "wedding_car", "honeymoon", "wedding_planner", "other"]
COLS = ["id", "name", "google_name", "similarity", "address_source", "google_address", "place_id", "maps_url"]


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "eval", "invariants")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))


HQ = _hq()
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
out = os.path.join(t, "tools", "scraper", "output", "HCMC")


def rank(cat):
    return (ORDER.index(cat), "") if cat in ORDER else (len(ORDER), cat)


A = {}  # id -> (category nhà, vendor, bản ghi log)
for f in sorted(glob.glob(os.path.join(out, "*", "vendors.json")), key=lambda p: rank(os.path.basename(os.path.dirname(p)))):
    cat = os.path.basename(os.path.dirname(f))
    try:
        raw = json.load(open(f, encoding="utf-8"))
    except ValueError:
        continue
    for v in (raw.get("vendors", []) if isinstance(raw, dict) else raw):
        logs = [e for e in v.get("enrichment_log") or [] if e.get("source") == "google_maps" and e.get("place_id")]
        if logs and logs[-1].get("accepted_by") == "name_near_exact" and v.get("id") not in A:
            A[v.get("id")] = (cat, v, logs[-1])

bad, seen = [], {}
files = sorted(glob.glob(os.path.join(out, "*", "name-match-accepted.csv")))
for p in files:
    cat = os.path.basename(os.path.dirname(p))
    rd = csv.reader(open(p, encoding="utf-8-sig", newline=""))
    head = next(rd, [])
    if head != COLS:
        bad.append("%s: cột %r, mong %r" % (cat, head, COLS)); continue
    rows = [dict(zip(COLS, r)) for r in rd if r]
    if not rows:
        bad.append("%s: file báo cáo rỗng (category không có vendor nhận theo tên thì không có file)" % cat)
    for d in rows:
        i = d["id"]
        seen[i] = seen.get(i, 0) + 1
        if i not in A:
            bad.append("%s: id %s trong báo cáo nhưng không (còn) được nhận theo tên" % (cat, i)); continue
        home, v, e = A[i]
        if home != cat:
            bad.append("%s: id %s phải nằm ở báo cáo của category đầu tiên chứa nó (%s)" % (cat, i, home))
        pid = e.get("place_id")
        if (d["place_id"] != pid or d["maps_url"] != "https://www.google.com/maps/place/?q=place_id:" + str(pid)
                or d["google_address"] != (e.get("formatted_address") or "") or d["address_source"] != ((v.get("contact") or {}).get("address_source") or "")):
            bad.append("%s: dòng của %s lệch dữ liệu (place_id/maps_url/google_address/address_source)" % (cat, i))
missing = sorted(set(A) - set(seen))
if missing:
    bad.append("%d vendor được nhận theo tên mà thiếu dòng báo cáo, vd %s" % (len(missing), missing[:3]))
dup = sorted(i for i, n in seen.items() if n > 1)
if dup:
    bad.append("%d id có hơn một dòng báo cáo, vd %s" % (len(dup), dup[:3]))
if bad:
    print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d vendor nhận theo tên, %d file báo cáo, mỗi id đúng một dòng ở category đầu tiên, khớp trạng thái" % (len(A), len(files))); sys.exit(0)
