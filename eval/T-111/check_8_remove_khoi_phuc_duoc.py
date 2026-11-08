#!/usr/bin/env python3
"""T-111 tiêu chí 2 (remove khôi phục được). OFFLINE (Google giả). Vendor R ở 2 category file bị luật no_match (2 lần) gỡ, rồi `enrich.py --state HCMC --restore R` (lệnh của T-110):
- removed_vendors.json của MỖI file có đúng 1 bản ghi {removed_at, reason, vendor}; `vendor` giữ nguyên mọi trường gốc (name, id, categories, portfolio_urls, contact.address, …) và không có `manual`;
- khôi phục: thoát 0, in `RESTORED R files=2`, vendor trở lại vendors.json của CẢ HAI file bằng đúng bản ghi `vendor` đã lưu, bản ghi khỏi removed_vendors.json;
- chạy enrich lần sau: 0 lượt Text Search cho R (dòng audit cũ giữ nguyên, không bị gỡ lại hay tìm lại); R trở lại pool ở lần tạo pool kế tiếp (id có trong pool-vendors.json do build_pool.py);
- vendor chưa từng bị gỡ: `--restore` báo `RESTORE_ERROR <id> not_removed`, thoát khác 0, không đổi file.
Spec: products/T-111-enrich-toan-bo-vendor.md, "Remove và khôi phục". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
R1 = x.V("r_gone", "Nhà hàng Restore Moon (Quận 1)", 1)
R2 = dict(R1)
R2["categories"] = ["attire"]
K = x.V("r_keep", "Nhà hàng Keeper Star", 2)
orig = {k: R1[k] for k in R1}
r = t.Root({"venue": [R1, K], "wedding_attire": [R2]}, parent="repo")
PL = {"PK": t.place(K["name"], x.GADDR % 2)}
FX = x.fx(PL, [("keeper star", ["PK"])])
rc, out, calls = r.run(x.enrich_all(["venue", "wedding_attire"]), FX)
recs = {c: [e for e in r.removed(c) if e["vendor"]["id"] == "r_gone"] for c in ("venue", "wedding_attire")}
if any(len(v) != 1 for v in recs.values()):
    t.fail("sau enrich: mỗi file phải có đúng 1 bản ghi removed cho r_gone, thấy %r" % {c: len(v) for c, v in recs.items()})
for c, (e,) in recs.items():
    if e.get("manual") or not e.get("removed_at") or not e.get("reason"):
        bad.append("%s: bản ghi removed thiếu removed_at/reason hoặc có manual" % c)
    for k, v in orig.items():
        if k != "contact" and e["vendor"].get(k) != v:
            bad.append("%s: trường %s của vendor bị đổi trong bản ghi removed" % (c, k))
saved = {c: json.loads(json.dumps(recs[c][0]["vendor"])) for c in recs}
rc, o, _ = r.run(["enrich.py", "--state", "HCMC", "--restore", "r_gone"], FX)
if rc != 0 or "RESTORED r_gone files=2" not in o:
    bad.append("--restore r_gone: mong thoát 0 + 'RESTORED r_gone files=2'; rc=%d %s" % (rc, o.strip().splitlines()[-1:] or ""))
for c in ("venue", "wedding_attire"):
    if r.vendor("r_gone", c) != saved[c]:
        bad.append("%s: vendor sau khôi phục khác bản ghi đã lưu" % c)
    if any(e["vendor"]["id"] == "r_gone" for e in r.removed(c)):
        bad.append("%s: bản ghi removed phải bị xoá sau khôi phục" % c)
rc, o, calls = r.run(x.enrich_all(["venue", "wedding_attire"]), FX)
if x.count_for(calls, "restore moon"):
    bad.append("sau khôi phục: r_gone bị Text Search lại (%r)" % x.queries(calls))
if not all(r.vendor("r_gone", c) for c in ("venue", "wedding_attire")):
    bad.append("sau khôi phục + enrich: r_gone bị gỡ lại")
scr = os.path.join(r.base, "tools", "scraper")
os.makedirs(os.path.join(scr, "output"), exist_ok=True)
p = subprocess.run([sys.executable, "build_pool.py", "--out", "output/pool-vendors.json"], cwd=scr, capture_output=True, text=True)
if p.returncode != 0 or "r_gone" not in open(os.path.join(scr, "output", "pool-vendors.json"), encoding="utf-8").read():
    bad.append("r_gone không trở lại nguồn pool sau khôi phục")
before = r.tree()
rc, o, _ = r.run(["enrich.py", "--state", "HCMC", "--restore", "r_keep"], FX)
if rc == 0 or "RESTORE_ERROR r_keep not_removed" not in o or r.tree() != before:
    bad.append("--restore vendor chưa bị gỡ: mong RESTORE_ERROR r_keep not_removed, thoát != 0, file giữ nguyên")
t.done(bad, "vendor bị gỡ vì no_match được lưu nguyên vẹn ở mọi file, --restore đưa về đúng bản ghi, không bị tìm lại hay gỡ lại, trở lại nguồn pool; restore vendor chưa gỡ bị từ chối")
