#!/usr/bin/env python3
"""T-125 adv-01 (tầng 3, adversary 2026-11-11) · maps_link mà API admin (tohong-back) nhận thì tohong cũng phải nhận.
Input phá: `https://goo.gl\\@evil.com` (và các biến thể dấu `\\` trước `@`). Trình duyệt / WHATWG URL của back đọc host = goo.gl
nên PUT …/review trả 200 và review vào export; Python `urllib.parse.urlsplit` của tohong đọc host = evil.com nên
`enrichment.overrides.valid_maps_link` trả False, `apply_admin_reviews.py` từ chối CẢ LÔ (`APPLY_REFUSED bad_entry`).
Spec T-124 Hành vi 4: link phải https và host share.google / goo.gl / maps.app.goo.gl / google.com/maps…, sai 400 `bad_link`;
một link có hai cách đọc host không phải link hợp lệ. Mong đợi: mọi link back trả 200 thì valid_maps_link của tohong True
(với link đã lưu, vì back được phép trim), và link hợp lệ rõ ràng vẫn được cả hai nhận.
Chạy: python3 -I eval/T-125/adv-01-…py (TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back). Thoát 0 = PASS."""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
def find(env, rel, probe):
    for p in (os.environ.get(env), os.path.join(HQ, "..", rel)):
        if p and os.path.exists(os.path.join(p, probe)):
            return os.path.abspath(p)
TOHONG = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "enrichment", "overrides.py"))
BACK = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
if not TOHONG or not BACK:
    print("FAIL không thấy repo tohong / tohong-back (đặt TOHONG_REPO, TOHONG_BACK_REPO)"); sys.exit(1)
if not os.path.isfile(os.path.join(BACK, "lib", "vendorEnrichReport.generated.js")):
    print("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); sys.exit(1)

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(TOHONG, "tools", "scraper"))
from enrichment.overrides import valid_maps_link  # noqa: E402

GOOD = ["https://share.google/tYZdblcikIDPqVJX6", "https://maps.app.goo.gl/AbCdEf123", "https://goo.gl/maps/xyz",
        "https://www.google.com/maps/place/?q=place_id:ChIJ_Q8PLiQvdTERNk66UVRKf8U", "https://google.com/maps"]
TRICKY = ["https://goo.gl\\@evil.com", "https://goo.gl\\@evil.com/maps", "https://share.google\\@evil.com/x",
          "https://maps.app.goo.gl\\@evil.com/x", "https://www.google.com\\@evil.com/maps", "https://www.google.com\\maps",
          "https://goo.gl\\\\evil.com", "https://goo.gl\t/x", "https://goo.gl/x\n@evil.com", "https://GOO.GL/x",
          "https://goo.gl:443/x", "https://goo.gl./x", "https://%67oo.gl/x", "https://goo.gl#@evil.com", "https://goo.gl?@evil.com",
          "https://www.google.com/maps\\..\\url?q=https://evil.com", "https:goo.gl/x", "https:/goo.gl/x", "https:\\\\goo.gl\\x"]
tmp = tempfile.mkdtemp(prefix="t125-adv01-")
try:
    lf = os.path.join(tmp, "links.json")
    json.dump(GOOD + TRICKY, open(lf, "w"))
    p = subprocess.run(["node", os.path.join(HERE, "lib", "adv_links_back.mjs"), lf], cwd=BACK, capture_output=True, text=True, timeout=300,
                       env=dict(os.environ, TOHONG_BACK_REPO=BACK))
    if p.returncode != 0:
        print("FAIL không chạy được API back: " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
    res = json.loads(p.stdout.strip().splitlines()[-1])
finally:
    shutil.rmtree(tmp, ignore_errors=True)

bad = []
for link in GOOD:
    r = res[link]
    if r["status"] != 200: bad.append(f"back từ chối link hợp lệ {link!r} ({r['status']} {r['error']})")
    if not valid_maps_link(link): bad.append(f"tohong từ chối link hợp lệ {link!r}")
for link in TRICKY:
    r = res[link]
    if r["status"] == 200 and not valid_maps_link(r["stored"] or link):
        bad.append(f"back nhận {link!r} (lưu {r['stored']!r}) nhưng tohong valid_maps_link từ chối: lô export sẽ bị APPLY_REFUSED bad_entry")
    elif r["status"] not in (200, 400):
        bad.append(f"{link!r}: back trả {r['status']} {r['error']} (mong 200 hoặc 400 bad_link)")
if bad:
    print(f"FAIL {bad[0]}" + (f" (+{len(bad)-1} lỗi nữa)" if len(bad) > 1 else "")); sys.exit(1)
print(f"PASS {len(GOOD)} link hợp lệ cả hai nhận; {len(TRICKY)} link mập mờ: back nhận thì tohong cũng nhận"); sys.exit(0)
