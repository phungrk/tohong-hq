#!/usr/bin/env python3
"""Nguồn: T-121 eval đối kháng adv-01 (adversary, Code Gate 2026-11-11), spec T-120 Hành vi 0 và 3 (kết cục áp cho bản ghi VÀ dòng audit ở mọi
category file có id; accepted_by chỉ trên vendor đang được nhận); T-111 (đơn vị là id).
INV-027 (planner/vendor/images) · Dòng audit nói "đã nhận khớp" thì bản ghi CÙNG FILE phải đang mang place_id Google.
Lý do: vendor ở nhiều category file bị hạ (G6 mới, id thành venue, luật mới) chỉ sửa được dòng audit của file đang chạy; các file khác còn
status=enriched + accepted_by=name_near_exact cho vendor đã mất place_id. Dòng audit là sổ Capu và lượt chạy sau đọc (chọn recheck, review).
Trên tools/scraper/output/<thành phố>/<category>/ (repo tohong): với mọi vendor có dòng trong enrichment-audit.json cùng thư mục,
nếu dòng có status="enriched" hoặc có trường accepted_by thì bản ghi enrichment_log[google_maps] MỚI NHẤT của vendor trong vendors.json cùng thư mục
phải có place_id. (Chiều ngược lại không xét.) Không thấy repo tohong: PASS "chưa áp dụng". Không gọi Google.
Đo 2026-11-11 trên tohong origin/main (a682fc3): 856 cặp dòng audit/bản ghi, 0 vi phạm.
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, json, os, sys


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
bad, n = [], 0
for f in sorted(glob.glob(os.path.join(t, "tools", "scraper", "output", "*", "*", "vendors.json"))):
    d = os.path.dirname(f)
    ap = os.path.join(d, "enrichment-audit.json")
    if not os.path.exists(ap):
        continue
    try:
        raw = json.load(open(f, encoding="utf-8"))
        rows = {r.get("vendor_id"): r for r in json.load(open(ap, encoding="utf-8")) if isinstance(r, dict)}
    except ValueError as e:
        bad.append("%s: không đọc được (%s)" % (os.path.relpath(d, t), e)); continue
    for v in (raw.get("vendors", []) if isinstance(raw, dict) else raw):
        a = rows.get(v.get("id"))
        if not a:
            continue
        n += 1
        logs = [e for e in v.get("enrichment_log") or [] if e.get("source") == "google_maps"]
        has = bool(logs and logs[-1].get("place_id"))
        if (a.get("status") == "enriched" or a.get("accepted_by")) and not has:
            bad.append("%s/%s: audit status=%r accepted_by=%r mà bản ghi không có place_id" % (
                os.path.relpath(d, os.path.join(t, "tools", "scraper", "output")), v.get("id"), a.get("status"), a.get("accepted_by")))
if bad:
    print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(bad[:3]))); sys.exit(1)
print("PASS %d dòng audit: mọi dòng nói đã nhận khớp đều có bản ghi cùng file mang place_id" % n)
