#!/usr/bin/env python3
"""T-108 adv-06 (adversary, Code Gate 2026-11-08; sửa 2026-11-08 theo spec-critic cho khớp chữ spec T-106 v4 Hành vi 2). Chỉ đọc file, không gọi Google.
Ý: chỉ số bảo vệ của spec T-106 là "không vendor nào hiện ảnh của nhà hàng khác". Eval đo KẾT QUẢ trong pool: vendor venue có ảnh Google trong pool
mà ứng viên Google của nó mang một trong ba dấu hiệu khớp nhầm khách quan dưới đây là FAIL. Mỗi dấu hiệu dùng ĐÚNG hàm chuẩn của spec trong
eval/T-106/_common.py (không tự chế luật):
  (a) G2 tỉnh/thành: `in_province(formatted_address, city)` = false (chuẩn hoá P1-P3; địa chỉ rỗng/không nhận ra tỉnh cũng là không đạt).
  (b) G6 một place_id, một địa chỉ gốc: trong nhóm vendor cùng place_id (mọi category file HCMC, cùng id tính MỘT vendor) có hai vendor mà
      address_match(gốc A, gốc B) = false VÀ hai chuỗi gốc sau A1 khác nhau (ngoại lệ G6: cùng chỗ hoặc chuỗi gốc giống nhau thì giữ). Vendor
      trong nhóm như vậy chỉ bị tính khi spec thật sự từ chối nó: hoặc một cổng G1-G5 từ chối (`reject_reason` != None; đây là lý do spec ghi
      "shared_place_id không kích hoạt riêng vì đã bị G3/G5 hạ trước"), hoặc nó nằm trong `shared_place_id_groups` của các vendor đã qua G1-G5.
      Nên vendor đúng trong cặp (vd GALA, conf 1,0, khi kẻ chung place_id bị G5 hạ) KHÔNG bị tính.
  (c) G4 trùng địa chỉ nhà hàng đã đóng: address_match(gốc, formatted_address) của chính vendor = false, và địa chỉ gốc address_match địa chỉ gốc
      hoặc formatted_address của một vendor đã gỡ vì CLOSED_PERMANENTLY (audit lần này hoặc removed_vendors.json của bất kỳ category HCMC).
Phạm vi: chỉ bản ghi mới có contact.address_source (như INV-015; photography cũ không có địa chỉ gốc, không tính).
Mong đợi: các vendor đó không có place_id/ảnh Google trong pool, và vào review.
Repo: TOHONG_REPO / TOHONG_BACK_REPO như eval/T-106/_common.py. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import glob, json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as C  # noqa: E402

t = C.tohong(); b = C.back()
hcm = os.path.join(t, "tools", "scraper", "output", "HCMC")
pool = {p.get("id"): p for p in C.load_pool(b)}
shown = {i for i, p in pool.items() if C.google_photos_of(p)}


def src(v):
    return (v.get("contact") or {}).get("address_source") or ""


# Vendor có place_id, mọi category file HCMC; cùng id ở nhiều category là MỘT vendor (lấy bản ghi đầu có place_id, ưu tiên bản có address_source).
vend = {}
for vid, recs in C.load_records(t).items():
    withlog = [r for r in recs if C.google_log(r) and src(r)]
    if withlog:
        vend[vid] = (withlog[0], C.google_log(withlog[0]))

# Địa chỉ của nhà hàng đã gỡ vì CLOSED_PERMANENTLY (G4): audit venue lần này + removed_vendors.json mọi category HCMC.
closed = []
af = os.path.join(hcm, "venue", "enrichment-audit.json")
audit = json.load(open(af, encoding="utf-8")) if os.path.isfile(af) else []
audit = audit.get("entries", []) if isinstance(audit, dict) else audit
for a in audit:
    if a.get("status") == "closed_permanently":
        closed.append((a.get("vendor_id"), a.get("formatted_address") or ""))
for f in glob.glob(os.path.join(hcm, "*", "removed_vendors.json")):
    for r in json.load(open(f, encoding="utf-8")):
        if "CLOSED_PERMANENTLY" in (r.get("reason") or ""):
            v = r.get("vendor") or {}
            closed.append((v.get("id"), src(v) or (v.get("contact") or {}).get("address") or ""))
closed = [(i, x) for i, x in closed if x.strip()]

bad = {}  # vendor_id -> [lý do]
for vid, (v, e) in vend.items():
    if vid not in shown:
        continue
    fa = e.get("formatted_address") or ""
    if not C.in_province(fa, v.get("city") or "HCMC"):
        bad.setdefault(vid, []).append("(a) G2 %r -> %r ở %r (tỉnh %r)" % (v.get("name"), e.get("matched_name"), fa, C.province_key(fa)))
    if not C.address_match(src(v), fa):
        for cid, caddr in closed:
            if cid != vid and C.address_match(src(v), caddr):
                bad.setdefault(vid, []).append("(c) G4 %r cùng địa chỉ với %s đã đóng cửa (%r), nhưng nhận %r ở %r"
                                               % (v.get("name"), cid, caddr, e.get("matched_name"), fa))
                break

caddrs = [x for _, x in closed]
reason = {vid: C.reject_reason(src(v), e.get("formatted_address") or "", e.get("confidence"), v.get("city") or "HCMC", caddrs)
          for vid, (v, e) in vend.items()}
g6 = C.shared_place_id_groups([(vid, e["place_id"], src(v)) for vid, (v, e) in vend.items() if reason[vid] is None])
by_pid = {}
for vid, (v, e) in vend.items():
    by_pid.setdefault(e["place_id"], []).append((vid, v))
for pid, vs in by_pid.items():
    for i in range(len(vs)):
        for j in range(i + 1, len(vs)):
            (ia, va), (ib, vb) = vs[i], vs[j]
            if not C.address_match(src(va), src(vb)) and C._fold(src(va)) != C._fold(src(vb)):
                for me, other in ((ia, vb), (ib, va)):
                    if me in shown and (reason[me] is not None or me in g6):
                        bad.setdefault(me, []).append("(b) G6 place_id %s chung với %s %r (gốc %r khác gốc %r); spec từ chối: %s"
                                                      % (pid, other.get("id"), other.get("name"), src(other)[:40], src(vend[me][0])[:40],
                                                         reason[me] or "shared_place_id"))

if bad:
    lines = ["%s %s" % (vid, "; ".join(rs)) for vid, rs in sorted(bad.items())]
    C.fail("%d vendor có ảnh Google trong pool mang dấu hiệu khớp nhầm địa điểm (G2/G4/G6 của spec T-106 v4):\n  " % len(bad) + "\n  ".join(lines))
C.ok("không vendor nào có ảnh Google trong pool mà ứng viên ngoài tỉnh (G2), trùng địa chỉ nhà hàng đã đóng (G4) hay chung place_id với địa chỉ gốc khác (G6)")
