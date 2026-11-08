#!/usr/bin/env python3
"""T-111 tiêu chí 1 (phạm vi): `--dry-run` trên DỮ LIỆU THẬT của repo `tohong` in số vendor theo từng category đúng bằng số eval tự đếm lại từ output/HCMC/*/ (không hằng số cứng),
0 lượt Google, không cần khoá, không đổi byte nào trong output/. OFFLINE.
Spec: products/T-111-enrich-toan-bo-vendor.md, "Phạm vi". Quy tắc đếm (một vendor = một id; cùng id ở nhiều category file là MỘT vendor, tính vào category ĐẦU TIÊN
theo thứ tự chạy `all`): eligible = có địa chỉ, chưa có place_id ở file nào, chưa có dòng audit ở file nào, không bị gỡ, không có mục trong manual_overrides.json;
in_pool = id có `categories` (gộp mọi file) giao tập MATCHER_CATS của generate-vendor-pool.js; retry_only = dòng audit no_match chưa đủ 2 lần thử (attempts < 2 hoặc thiếu),
vendor còn trong vendors.json, không có mục duyệt tay. Dòng in: DRY_RUN_SCOPE category=<c> records unique eligible in_pool not_in_pool retry_only matched in_scope.
Mong đợi: mọi số khớp; tổng in_scope = in_pool + retry_only (mặc định không gồm vendor ngoài pool). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import hashlib, json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
repo = t.c.tohong()
scr = os.path.join(repo, "tools", "scraper")
out = os.path.join(scr, "output", "HCMC")


def tree():
    h = {}
    for d, _, fs in os.walk(os.path.join(scr, "output")):
        for f in fs:
            p = os.path.join(d, f)
            h[p] = hashlib.sha1(open(p, "rb").read()).hexdigest()
    return h


files = {c: json.load(open(os.path.join(out, c, "vendors.json"), encoding="utf-8"))["vendors"] for c in x.ORDER if os.path.isfile(os.path.join(out, c, "vendors.json"))}
if len(files) < 14:
    t.fail("thiếu category file (thấy %d/14)" % len(files))
cats, matched, audited, removed = {}, set(), {}, set()
for c, vs in files.items():
    for v in vs:
        cats.setdefault(v["id"], set()).update(v.get("categories") or [])
        if any(e.get("source") == "google_maps" and e.get("place_id") for e in v.get("enrichment_log") or []):
            matched.add(v["id"])
    ap = os.path.join(out, c, "enrichment-audit.json")
    if os.path.isfile(ap):
        for r in json.load(open(ap, encoding="utf-8")):
            audited[r.get("vendor_id")] = r
    rp = os.path.join(out, c, "removed_vendors.json")
    if os.path.isfile(rp):
        removed |= {r["vendor"]["id"] for r in json.load(open(rp, encoding="utf-8"))}
mo = os.path.join(out, "manual_overrides.json")
over = {e["vendor_id"] for e in json.load(open(mo, encoding="utf-8")).get("overrides", [])} if os.path.isfile(mo) else set()
seen, exp = set(), {}
for c in x.ORDER:
    own = [v for v in files[c] if v["id"] not in seen]
    for v in files[c]:
        seen.add(v["id"])
    el = [v for v in own if (v.get("contact") or {}).get("address") and v["id"] not in matched and v["id"] not in audited and v["id"] not in removed and v["id"] not in over]
    ro = [v for v in own if audited.get(v["id"], {}).get("status") == "no_match" and int(audited[v["id"]].get("attempts") or 1) < 2 and v["id"] not in over]
    inp = sum(1 for v in el if cats[v["id"]] & x.MATCHER_CATS)
    exp[c] = {"records": len(files[c]), "unique": len(own), "eligible": len(el), "in_pool": inp, "not_in_pool": len(el) - inp, "retry_only": len(ro),
              "matched": sum(1 for v in own if v["id"] in matched)}
before = tree()
r = t.Root({}, parent=None)
env = {k: v for k, v in os.environ.items() if k not in ("GOOGLE_MAPS_API_KEY", "PYTHONPATH")}
fxp = os.path.join(r.base, "deny.json")
json.dump({"places": {}, "search": [], "links": {}, "deny": True}, open(fxp, "w"))
lg = os.path.join(r.base, "calls.jsonl")
env.update({"PYTHONPATH": t.FAKE, "FAKE_GOOGLE_FIXTURE": fxp, "FAKE_GOOGLE_LOG": lg, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"})
if not os.path.isfile(os.path.join(scr, "enrich.py")):
    t.fail("thiếu tools/scraper/enrich.py")
p = subprocess.run([sys.executable] + x.enrich_all("all", extra=["--dry-run"]), cwd=scr, env=env, capture_output=True, text=True, timeout=300)
o = (p.stdout or "") + (p.stderr or "")
bad = []
if p.returncode != 0:
    t.fail("dry-run thoát %d, không phải 0: %s" % (p.returncode, o.strip().splitlines()[-1:] or ""))
rows = {d.get("category"): d for d in x.kv(o, "DRY_RUN_SCOPE")}
for c in x.ORDER:
    if c not in rows:
        bad.append("thiếu dòng DRY_RUN_SCOPE category=%s" % c)
        continue
    for k, v in exp[c].items():
        if str(rows[c].get(k)) != str(v):
            bad.append("%s.%s: in %s, đếm lại %s" % (c, k, rows[c].get(k), v))
if not bad:
    tot = sum(exp[c]["in_pool"] + exp[c]["retry_only"] for c in x.ORDER)
    got = sum(int(rows[c].get("in_scope", -1)) for c in x.ORDER)
    if got != tot:
        bad.append("tổng in_scope %d, mong in_pool + retry_only = %d (mặc định không gồm vendor ngoài pool)" % (got, tot))
if os.path.exists(lg) and open(lg).read().strip():
    bad.append("dry-run gọi Google")
if tree() != before:
    bad.append("dry-run đổi file trong output/")
t.done(bad, "DRY_RUN_SCOPE khớp số đếm lại cho 14 category (eligible tổng %d, trong pool %d, ngoài pool %d); 0 lượt Google; output/ giữ nguyên byte" % (
    sum(e["eligible"] for e in exp.values()), sum(e["in_pool"] for e in exp.values()), sum(e["not_in_pool"] for e in exp.values())))
