#!/usr/bin/env python3
"""Nguồn: T-121 eval đối kháng adv-05 (adversary, Code Gate v2 2026-11-11); spec T-106 v4.1 G6 và T-120 Hành vi 1 N4, Hành vi 6
("hai vendor khác địa chỉ gốc chung place_id thì CẢ HAI bị từ chối, không đoán ai đúng").
INV-028 (planner/vendor/images) · G6 không để sót một bên: vendor bị hạ shared_place_id trên place_id P thì không vendor nào KHÁC địa chỉ gốc đang giữ P.
Lý do: với luật tên (đường 2), settle của category chạy sau xét vendor đã bị hạ bằng sáu cổng nên nó rơi khỏi nhóm G6 và vendor còn lại giữ ảnh của
một nơi mà hai bản ghi marry.vn khác địa chỉ cùng trỏ tới (đúng loại "nhận nhầm nhà" G6 sinh ra để chặn); kết quả phụ thuộc thứ tự category.
Trên tools/scraper/output/<thành phố>/: X = mọi dòng enrichment-audit.json có reject_reason="shared_place_id" và candidate_place_id P (khác rỗng).
Với mỗi dòng đó, mọi vendor (mọi category file, cùng thành phố) có enrichment_log[google_maps] mới nhất mang place_id P, trừ bản ghi manual_override=true
(Capu duyệt tay accept_place thắng, T-110) và trừ chính id đó, phải có contact.address_source GIỐNG địa chỉ gốc của vendor bị hạ (so sau khi gộp hoa/thường,
bỏ dấu, chỉ giữ chữ-số). Không thấy repo: PASS "chưa áp dụng". Đo 2026-11-11 trên tohong origin/main (a682fc3): 0 dòng shared_place_id, PASS.
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, json, os, re, sys, unicodedata


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "eval", "invariants")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d"))
    return re.sub(r"[^a-z0-9]+", " ", "".join(ch for ch in s if unicodedata.category(ch) != "Mn")).strip()


HQ = _hq()
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
bad, n = [], 0
for city in sorted(glob.glob(os.path.join(t, "tools", "scraper", "output", "*"))):
    holders, src_of, demoted = {}, {}, []
    for f in sorted(glob.glob(os.path.join(city, "*", "vendors.json"))):
        try:
            raw = json.load(open(f, encoding="utf-8"))
        except ValueError:
            continue
        for v in (raw.get("vendors", []) if isinstance(raw, dict) else raw):
            vid = v.get("id")
            src = (v.get("contact") or {}).get("address_source")
            if src:
                src_of.setdefault(vid, src)
            logs = [e for e in v.get("enrichment_log") or [] if e.get("source") == "google_maps"]
            if logs and logs[-1].get("place_id") and logs[-1].get("manual_override") is not True:
                holders.setdefault(logs[-1]["place_id"], set()).add(vid)
        ap = os.path.join(os.path.dirname(f), "enrichment-audit.json")
        if os.path.exists(ap):
            try:
                demoted += [(r.get("vendor_id"), r.get("candidate_place_id")) for r in json.load(open(ap, encoding="utf-8"))
                            if isinstance(r, dict) and r.get("reject_reason") == "shared_place_id" and r.get("candidate_place_id")]
            except ValueError:
                pass
    for vid, pid in sorted(set(demoted)):
        n += 1
        for h in sorted(holders.get(pid, set()) - {vid}):
            if fold(src_of.get(h)) != fold(src_of.get(vid)):
                bad.append("%s: %s bị hạ shared_place_id trên %s mà %s (khác địa chỉ gốc) vẫn giữ place_id đó" % (os.path.basename(city), vid, pid, h))
if bad:
    print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(bad[:3]))); sys.exit(1)
print("PASS %d dòng shared_place_id: không place_id nào còn bị giữ bởi vendor khác địa chỉ gốc" % n)
