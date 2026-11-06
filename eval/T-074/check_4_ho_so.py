#!/usr/bin/env python3
"""T-074 tiêu chí 4: 30 hồ sơ mẫu phủ 6 style x 3 mức ngân sách x 4 hạng mục chính; hồ sơ không chứa kết quả matcher."""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
def fail(m): print("FAIL " + m); sys.exit(1)
d = json.load(open(os.path.join(ROOT, "eval/T-074/profiles.json"), encoding="utf-8"))["profiles"]
STY = ["traditional", "luxury", "modern", "korean", "natural", "rustic"]; CAT = ["photography", "makeup", "attire", "venue"]
if len(d) != 30 or len({p["id"] for p in d}) != 30: fail(f"cần đúng 30 hồ sơ id khác nhau, có {len(d)}")
for s in STY:
    ps = [p for p in d if p["style"] == s]
    if len(ps) != 5: fail(f"style {s} có {len(ps)} hồ sơ, cần 5")
    if {p["tier"] for p in ps} != {"L", "M", "H"}: fail(f"style {s} chưa phủ đủ 3 mức ngân sách L/M/H")
for t in "LMH":
    n = sum(1 for p in d if p["tier"] == t)
    if n != 10: fail(f"mức {t} có {n} hồ sơ, cần 10")
allowed = {"id", "style", "preferredStyles", "tier", "city", "weddingDate", "guestCount", "budgetTotal", "budgetByCategory"}
bud = {}
for p in d:
    if set(p) != allowed: fail(f"{p['id']} có trường ngoài danh sách cho phép: {sorted(set(p) ^ allowed)}")
    if p["city"] != "HCMC": fail(f"{p['id']} ngoài TP.HCM (vision: chưa mở rộng ngoài TP.HCM)")
    if p["style"] != p["preferredStyles"][0] or not set(p["preferredStyles"]) <= set(STY): fail(f"{p['id']} preferredStyles sai")
    if set(p["budgetByCategory"]) != set(CAT) or any(not isinstance(v, (int, float)) or v <= 0 for v in p["budgetByCategory"].values()):
        fail(f"{p['id']} thiếu ngân sách đủ 4 hạng mục")
    if not (isinstance(p["guestCount"], int) and 50 <= p["guestCount"] <= 500): fail(f"{p['id']} guestCount lạ")
    bud.setdefault(p["tier"], set()).add(tuple(sorted(p["budgetByCategory"].items())))
for t, v in bud.items():
    if len(v) != 1: fail(f"mức {t} có nhiều bộ ngân sách hạng mục khác nhau")
for c in CAT:
    L, M, H = (dict(next(iter(bud[t])))[c] for t in "LMH")
    if not L < M < H: fail(f"ngân sách {c} không tăng theo mức: {L},{M},{H}")
print("PASS 30 hồ sơ: 6 style x 5, mức L/M/H = 10/10/10, đủ ngân sách 4 hạng mục, đều ở TP.HCM")
