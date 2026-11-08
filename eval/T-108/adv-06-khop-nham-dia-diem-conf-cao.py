#!/usr/bin/env python3
"""T-108 adv-06 (adversary, Code Gate 2026-11-08). Chỉ đọc file, không gọi Google.
Ý: chỉ số bảo vệ của spec T-106 là "không vendor nào hiện ảnh của nhà hàng khác". Luật nhận khớp (Hành vi 2) nhận MỌI ứng viên
có confidence >= 0,6 mà không xét địa chỉ, nên khớp nhầm tên giống (chi nhánh khác, tỉnh khác, nhà hàng khác tên na ná) lọt vào pool
mà không vào review-needed.csv (Capu không bao giờ thấy). Eval này đo ba dấu hiệu khớp nhầm KHÁCH QUAN, chỉ từ dữ liệu:
  (a) vendor venue nhận place_id mà formattedAddress Google không ở Hồ Chí Minh (pipeline chạy --state HCMC);
  (b) hai vendor venue khác địa chỉ gốc (address_match(địa chỉ gốc A, địa chỉ gốc B) = false) cùng nhận MỘT place_id:
      nhiều nhất một trong hai đúng, cả hai hiện cùng bộ ảnh;
  (c) vendor venue có địa chỉ gốc trùng (address_match) địa chỉ Google của một nhà hàng đã bị gỡ vì CLOSED_PERMANENTLY,
      nhưng lại nhận một place_id KHÁC mà địa chỉ không khớp: bản ghi trùng của nhà hàng đã đóng cửa, mang ảnh nơi khác.
Vendor vi phạm (a)/(b)/(c) mà có ảnh Google trong pool là FAIL. Mong đợi: các vendor đó không có place_id/ảnh Google, và vào review.
Repo: TOHONG_REPO / TOHONG_BACK_REPO như eval/T-106/_common.py. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import collections, json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as C  # noqa: E402

t = C.tohong(); b = C.back()
d = os.path.join(t, C.VENUE_DIR)
ven = json.load(open(os.path.join(d, "vendors.json"), encoding="utf-8"))
ven = ven.get("vendors", []) if isinstance(ven, dict) else ven
audit_f = os.path.join(d, "enrichment-audit.json")
audit = json.load(open(audit_f, encoding="utf-8")) if os.path.isfile(audit_f) else []
audit = audit.get("entries", []) if isinstance(audit, dict) else audit
pool = {p.get("id"): p for p in C.load_pool(b)}

def src(v):
    return (v.get("contact") or {}).get("address_source") or ""

shown = {i for i, p in pool.items() if C.google_photos_of(p)}
bad = []
by_pid = collections.defaultdict(list)
for v in ven:
    e = C.google_log(v)
    if not e:
        continue
    by_pid[e["place_id"]].append(v)
    fa = e.get("formatted_address") or ""
    if fa and "hồ chí minh" not in fa.lower() and "ho chi minh" not in C._fold(fa):
        bad.append("(a) %s %r -> %r ở %r" % (v["id"], v.get("name"), e.get("matched_name"), fa))

for pid, vs in by_pid.items():
    for i in range(len(vs)):
        for j in range(i + 1, len(vs)):
            if not C.address_match(src(vs[i]), src(vs[j])):
                bad.append("(b) %s %r (%s) và %s %r (%s) cùng place_id %s"
                           % (vs[i]["id"], vs[i].get("name"), src(vs[i])[:40], vs[j]["id"], vs[j].get("name"), src(vs[j])[:40], pid))

closed = [a for a in audit if a.get("status") == "closed_permanently" and a.get("formatted_address")]
for v in ven:
    e = C.google_log(v)
    if not e:
        continue
    for a in closed:
        if a.get("place_id") != e["place_id"] and C.address_match(src(v), a["formatted_address"]) \
                and not C.address_match(src(v), e.get("formatted_address")):
            bad.append("(c) %s %r cùng địa chỉ với %s đã đóng cửa (%r), nhưng nhận %r ở %r"
                       % (v["id"], v.get("name"), a.get("vendor_id"), a["formatted_address"], e.get("matched_name"), e.get("formatted_address")))

hit = [x for x in bad if any(tok in shown for tok in x.replace("(", " ").split())]
if hit:
    C.fail("%d dấu hiệu khớp nhầm địa điểm có ảnh Google trong pool (luật nhận conf>=0,6 không xét địa chỉ):\n  " % len(hit) + "\n  ".join(hit))
C.ok("không vendor venue nào có ảnh Google từ ứng viên ngoài HCM, chung place_id với địa chỉ khác, hay trùng địa chỉ nhà hàng đã đóng cửa")
