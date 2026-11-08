#!/usr/bin/env python3
"""Nguồn: T-110 (spec products/T-110-duyet-tay-venue.md v2, Hành vi 1; bản nháp eval/T-110/inv-proposed-duyet-tay-co-quyet-dinh-cua-capu.py;
qua Spec Gate lần 2 2026-11-08, spec-critic; siết thêm: `decision` phải nằm trong decisions/ của HQ, `decided_by: capu` phải ở frontmatter).
Nằm ở eval/T-110/bat-bien-cho-merge/ cho tới khi PR T-110 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/images/.
INV-020 · Mọi mục duyệt tay có quyết định của Capu.
tools/scraper/output/HCMC/manual_overrides.json (repo tohong): schema_version=1; vendor_id có và duy nhất; action thuộc {accept_place, remove, temporarily_closed,
reject_match}; reason không rỗng; approved_by='capu'; approved_on dạng YYYY-MM-DD; `decision` là đường dẫn tương đối, sau chuẩn hoá vẫn nằm trong
<HQ>/decisions/, file tồn tại, frontmatter có dòng `decided_by: capu`, và nội dung nhắc vendor_id. Lý do: duyệt tay thắng luật tự động (và được miễn vế
accept_match của INV-015), nên không agent nào được tự thêm mục; mỗi mục phải truy về một quyết định Capu đã chốt.
Chưa có repo tohong hoặc manual_overrides.json: PASS 'chưa áp dụng'. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import json, os, re, sys


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "decisions")) and os.path.isdir(os.path.join(d, "eval")):
            return d
        d = os.path.dirname(d)
    return None


HQ = _hq()
if not HQ:
    print("FAIL không tìm thấy gốc HQ (thư mục có decisions/ và eval/)"); sys.exit(1)
DEC = os.path.realpath(os.path.join(HQ, "decisions"))
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
fp = t and os.path.join(t, "tools", "scraper", "output", "HCMC", "manual_overrides.json")
if not fp or not os.path.isfile(fp):
    print("PASS chưa áp dụng (chưa có repo tohong hoặc manual_overrides.json)"); sys.exit(0)
try:
    doc = json.load(open(fp, encoding="utf-8"))
except ValueError as e:
    print("FAIL manual_overrides.json không phải JSON: %s" % e); sys.exit(1)
if not isinstance(doc, dict):
    print("FAIL manual_overrides.json không phải object"); sys.exit(1)
bad, seen = [], set()
if doc.get("schema_version") != 1:
    bad.append("schema_version=%r (mong 1)" % doc.get("schema_version"))
ov = doc.get("overrides")
if not isinstance(ov, list):
    bad.append("overrides không phải danh sách"); ov = []


def frontmatter(txt):
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", txt, re.S)
    return m.group(1) if m else ""


for e in ov:
    if not isinstance(e, dict):
        bad.append("mục không phải object: %r" % (e,)); continue
    v = e.get("vendor_id")
    if not v or v in seen:
        bad.append("vendor_id thiếu hoặc trùng: %r" % v)
    seen.add(v)
    if e.get("action") not in ("accept_place", "remove", "temporarily_closed", "reject_match"):
        bad.append("%s: action %r" % (v, e.get("action")))
    if not str(e.get("reason") or "").strip():
        bad.append("%s: thiếu reason" % v)
    if e.get("approved_by") != "capu":
        bad.append("%s: approved_by=%r (chỉ 'capu')" % (v, e.get("approved_by")))
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(e.get("approved_on") or "")):
        bad.append("%s: approved_on=%r" % (v, e.get("approved_on")))
    dec = str(e.get("decision") or "")
    p = os.path.realpath(os.path.join(HQ, dec)) if dec and not os.path.isabs(dec) else ""
    if not p or not p.startswith(DEC + os.sep) or not os.path.isfile(p):
        bad.append("%s: decision %r không phải file trong decisions/ của HQ" % (v, dec)); continue
    txt = open(p, encoding="utf-8").read()
    if not re.search(r"^decided_by:\s*capu\s*$", frontmatter(txt), re.M):
        bad.append("%s: %s không có decided_by: capu ở frontmatter" % (v, dec))
    elif str(v) not in txt:
        bad.append("%s: %s không nhắc vendor_id" % (v, dec))
if bad:
    print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d mục duyệt tay đều hợp schema và có quyết định của Capu trong decisions/" % len(seen)); sys.exit(0)
