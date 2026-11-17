#!/usr/bin/env python3
"""T-200 · eval đối kháng tầng 3 (adversary, 2026-11-17).
Kiểm tập quyết định CẬP NHẬT trước khi ghi review accept_place, và script ghi apply.cjs.
Dữ liệu: thư mục enrich (rows.json, decisions.json, applied.jsonl, apply.cjs); đặt T200_ENRICH_DIR, mặc định scratchpad phiên Insight.
Báo cáo: insights/2026-11-17-T-200-cap-nhat-vendor-theo-maps.md (repo HQ).
  A. Không hàng CẬP NHẬT nào nhận place_id đang là place của một vendor KHÁC ở nhóm full.
  B. Không hàng CẬP NHẬT nào có địa chỉ Maps rỗng (không xác nhận được tỉnh/địa chỉ = không có gì để "lấy địa chỉ Maps").
  C. Không hàng CẬP NHẬT nào có địa chỉ Maps ở phường/xã thuộc Bình Dương / Bà Rịa-Vũng Tàu cũ (sáp nhập vào HCM 7/2025)
     khi địa chỉ marry ở HCM cũ: luật "tỉnh khác HCM" phải coi đó là tỉnh khác.
  D. Không place_id nào được gán cho >= 2 hàng CẬP NHẬT mà tên định danh (bỏ từ chung) không lồng nhau: hai vendor khác nhau cùng nhận một cơ sở.
     (Trùng lặp cùng thương hiệu như "INTOUR" / "Du lịch Intour" được phép.)
  E. apply.cjs chỉ coi là "đã xong" các dòng applied.jsonl có status 200 (dòng lỗi không được làm bỏ qua hàng khi chạy lại).
  F. apply.cjs đọc lại hàng (review/override) ngay trước mỗi PUT, không chỉ dựa vào ảnh chụp rows.json.
  G. Báo cáo insight không chứa số điện thoại (rác địa chỉ marry có dính SĐT).
Chạy: python3 -I adv-01-quyet-dinh-cap-nhat.py. Thoát 0 = đạt, 1 = vi phạm, 2 = thiếu dữ liệu."""
import json, os, re, sys, unicodedata

S = os.environ.get("T200_ENRICH_DIR",
    "/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/enrich")
HQ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPORT = os.path.join(HQ, "insights", "2026-11-17-T-200-cap-nhat-vendor-theo-maps.md")
need = [os.path.join(S, f) for f in ("rows.json", "decisions.json", "apply.cjs")]
if not all(os.path.isfile(p) for p in need):
    print("ERROR thiếu dữ liệu enrich ở", S); sys.exit(2)

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

rows = {r["id"]: r for r in json.load(open(need[0], encoding="utf-8"))}
dec = json.load(open(need[1], encoding="utf-8"))
up = [d for d in dec if d.get("dec") == "CẬP NHẬT"]
pid = lambda i: (rows[i].get("google") or {}).get("place_id")
fails = {}

full_pid = {pid(i): i for i, r in rows.items() if r["group"] == "full" and pid(i)}
fails["A"] = [f"{d['id']} -> place của full {full_pid[pid(d['id'])]}" for d in up if pid(d["id"]) in full_pid]
fails["B"] = [d["id"] for d in up if not (d.get("gaddr") or "").strip()]

OLD = ["Thủ Dầu Một", "Dĩ An", "Thuận An", "Thuận Giao", "Lái Thiêu", "Tân Uyên", "Tân Khánh", "Bến Cát",
       "Long Hương", "Phước Thắng", "Vũng Tàu", "Bà Rịa", "Tam Thắng", "Rạch Dừa", "Bình Dương",
       "Phú Lợi", "Hòa Lợi", "Chánh Hiệp", "Đông Hòa", "Tân Đông Hiệp", "Long Điền", "Châu Đức", "Xuyên Mộc"]
def old_prov(addr):
    a = re.sub(r"Phú Mỹ Hưng", "", addr or "")
    if re.search(r"\b(79|82|75)\d{4}\b|QL51", a): return True
    return any(re.search(r"(^|[ ,])" + re.escape(w) + r"([ ,]|$)", a) for w in OLD)
fails["C"] = [f"{d['id']} {d['gaddr'].strip()[-50:]}" for d in up
              if old_prov(d.get("gaddr")) and not old_prov(d.get("maddr"))]

GEN = set("dich vu bung qua cuoi hoi tang cua hang shop studio bridal wedding ty tnhh du lich thiep quan".split())
by = {}
for d in up: by.setdefault(pid(d["id"]), set()).add(norm(d["name"]))
def distinct(names):
    ts = sorted((frozenset(n.split()) - GEN for n in names), key=len)
    return any(not ts[0] or not ts[0] <= t for t in ts[1:])
fails["D"] = [f"{p}: {sorted(n)}" for p, n in by.items() if len(n) > 1 and distinct(n)]

js = open(need[2], encoding="utf-8").read()
m = re.search(r"const done=.*", js)
fails["E"] = [] if (m and re.search(r"status\s*===?\s*200", m.group(0))) else ["done-set không lọc status 200"]
loop = js[js.find("for(const d of dec)"):]
put = loop.find("'PUT'")
fails["F"] = [] if re.search(r"call\('GET'", loop[:put]) else ["không GET lại hàng trước PUT"]

if os.path.isfile(REPORT):
    t = open(REPORT, encoding="utf-8").read()
    fails["G"] = [f"{len(re.findall(r'Điện thoại|SĐT', t))} chỗ"] if re.search(r"\(\d{2,3}\)\s?\d{3,4}\s?\d{4}|\b0\d{2}\s\d{3}\s\d{2}\s\d{2}\b|Điện thoạiSĐT", t) else []

bad = 0
for k in "ABCDEFG":
    v = fails.get(k, [])
    print(("FAIL" if v else "PASS"), k, len(v))
    for x in v[:20]: print("   ", x)
    bad += bool(v)
sys.exit(1 if bad else 0)
