#!/usr/bin/env python3
"""T-113 adv-05 (tầng 3, thăm dò): `short_name` của code (tools/scraper/enrichment/short_name.py) chạy trên TOÀN BỘ tên vendor thật (output/HCMC/*/vendors.json):
(a) không bao giờ trả tên chung chung: mọi từ của kết quả đều thuộc COMMON (từ chung của hàm chuẩn) hoặc từ hành chính/số -> FAIL (truy vấn lượt 2 kiểu "Áo cưới"
    trả về một tiệm bất kỳ, rồi vendor bị gỡ hoặc nhận nhầm);
(b) khớp hàm chuẩn eval/T-111/_short.py trên mọi tên, trừ đúng một ngoại lệ đã chốt ở note accept T-111 (minor 3): hàm chuẩn ra CHỈ tên quận thì code được trả None;
(c) second_query luôn khác truy vấn lượt 1 sau chuẩn hoá (không vendor nào bị gỡ sau "hai" lượt thực chất là một)."""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

HQ = g.HQ
sys.path.insert(0, os.path.join(HQ, "eval", "T-111"))
import _short as canon  # noqa: E402
scraper = os.path.join(g.repo(), "tools", "scraper")
sys.path.insert(0, scraper)
from enrichment import short_name as code  # noqa: E402
from enrichment.google_maps import GoogleMapsEnricher  # noqa: E402

names, vendors = set(), []
for f in glob.glob(os.path.join(scraper, "output", "HCMC", "*", "vendors.json")):
    d = json.load(open(f, encoding="utf-8"))
    for v in (d.get("vendors", d) if isinstance(d, dict) else d):
        if v.get("name"):
            names.add(v["name"])
            vendors.append(v)
if len(names) < 500:
    g.fail("chỉ đọc được %d tên vendor thật (cần TOHONG_REPO có output/HCMC)" % len(names))

generic, diff = [], []
ADMIN = {"quan", "huyen", "phuong", "tinh", "tp", "thanh", "pho", "ho", "chi", "minh", "hcm", "q"}
# tên quận/huyện HCM không kèm chữ "Quận" (note accept T-111 minor 3: "Thế giới thiệp cưới - Phú Nhuận" -> code trả None)
DISTRICTS = {"phu nhuan", "binh thanh", "tan binh", "tan phu", "go vap", "binh tan", "thu duc", "binh chanh", "hoc mon", "cu chi", "nha be", "can gio"}


def district_only(x):
    f = " ".join(re.findall(r"\w+", canon.fold(x)))
    return f in DISTRICTS or all(t in ADMIN or t.isdigit() for t in f.split())
for n in sorted(names):
    s = code.short_name(n)
    c = canon.short_name(n)
    if s is not None:
        toks = re.findall(r"\w+", canon.fold(s))
        if toks and (all(t in canon.COMMON or t in ADMIN or t.isdigit() for t in toks) or district_only(s)):
            generic.append((n, s))
    if s != c:
        only_district = c is not None and district_only(c)
        if not (s is None and only_district):
            diff.append((n, s, c))

gm = GoogleMapsEnricher(api_key=None, dry_run=True)
same = []
for v in vendors:
    if not (v.get("contact") or {}).get("address"):
        continue
    q1, q2 = gm.build_queries(v)
    if canon.fold(q1).split() == canon.fold(q2).split():
        same.append((v.get("id"), q1, q2))

bad = []
if generic:
    bad.append("%d tên rút gọn chung chung, ví dụ %r" % (len(generic), generic[:5]))
if diff:
    bad.append("%d tên khác hàm chuẩn (ngoài ngoại lệ 'chỉ tên quận'), ví dụ %r" % (len(diff), diff[:5]))
if same:
    bad.append("%d vendor có truy vấn lượt 2 trùng lượt 1, ví dụ %r" % (len(same), same[:3]))
if bad:
    g.fail(" | ".join(bad))
g.ok("PASS %d tên thật: 0 tên rút gọn chung chung, khớp hàm chuẩn (trừ ngoại lệ chỉ-tên-quận), %d vendor có lượt 2 khác lượt 1" % (len(names), len(vendors)))
