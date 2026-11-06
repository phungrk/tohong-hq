#!/usr/bin/env python3
"""T-074: sinh eval/T-074/profiles.json (30 hồ sơ cặp đôi mẫu) theo luật cố định, KHÔNG nhìn đầu ra của matcher.
Chạy: python3 eval/T-074/lib/gen_profiles.py   (ghi đè profiles.json; đổi hồ sơ = nhãn cũ vô hiệu, xem profiles_sha)."""
import json, os
STYLES = ["traditional", "luxury", "modern", "korean", "natural", "rustic"]
SECOND = {"traditional": "luxury", "luxury": "modern", "modern": "korean", "korean": "natural", "natural": "rustic", "rustic": "traditional"}
# mức ngân sách mỗi style (5 hồ sơ): L,M,H + 2 phần dư xoay vòng để mỗi mức đúng 10 hồ sơ
TIERS = {
    "traditional": "LLMMH", "luxury": "LMMHH", "modern": "LLMHH",
    "korean": "LLMMH", "natural": "LMMHH", "rustic": "LLMHH",
}
# ngân sách hạng mục (triệu đồng, cùng đơn vị với giá hiển thị trên thẻ vendor của hạng mục đó)
BUDGET = {
    "L": {"photography": 8, "makeup": 4, "attire": 8, "venue": 4},
    "M": {"photography": 20, "makeup": 8, "attire": 15, "venue": 8},
    "H": {"photography": 35, "makeup": 15, "attire": 30, "venue": 15},
}
TOTAL = {"L": 150, "M": 300, "H": 600}
GUESTS = {"L": [80, 100, 120, 150, 140], "M": [160, 180, 200, 220, 250], "H": [260, 300, 320, 360, 400]}
MONTHS = [5, 6, 7, 8, 9, 10, 11]
out, n = [], 0
for si, s in enumerate(STYLES):
    cnt = {"L": 0, "M": 0, "H": 0}
    for k, t in enumerate(TIERS[s]):
        n += 1
        g = GUESTS[t][(cnt[t] + si) % 5]; cnt[t] += 1
        styles = [s] + ([SECOND[s]] if k == 2 else [])
        out.append({
            "id": f"P{n:02d}", "style": s, "preferredStyles": styles, "tier": t, "city": "HCMC",
            "weddingDate": f"2027-{MONTHS[(n - 1) % 7]:02d}-15", "guestCount": g,
            "budgetTotal": TOTAL[t], "budgetByCategory": dict(BUDGET[t]),
        })
doc = {"schema": "t074-profiles/v1",
       "note": "Hồ sơ mẫu do Spec Writer đặt theo luật trong products/T-074-bo-eval-top5.md, không chỉnh theo kết quả matcher.",
       "profiles": out}
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "profiles.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print("ghi", len(out), "hồ sơ ->", os.path.normpath(path))
