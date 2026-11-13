#!/usr/bin/env python3
"""T-147 tiêu chí 2 (repo tohong): báo cáo enrich mang đủ dữ liệu nguồn để drawer hiện mà không cần vendors.json thô lúc chạy.
Hợp đồng (spec products/T-147-drawer-vendor-enrich.md, Hành vi 2) trên `python3 tools/scraper/build_enrich_report.py --state HCMC --output-dir <output> --out <file>`:
  - gốc báo cáo có `pool_catalog` = đúng mảng `fields` của tools/scraper/pool-input-fields.json (nguồn duy nhất); mọi khoá T-124 giữ nguyên (schema_version 1, data_as_of ở gốc, summary, vendors).
  - mỗi dòng vendors[] có `pool_input` = {record, audit, truncated}:
      record = bản ghi vendors.json SAU KHI gộp theo id (build_pool.collapse_by_id trên mọi bản ghi, không lọc tạm đóng), chỉ giữ khoá của danh mục (file vendors.json):
        khoá nguyên giữ nguyên (chuỗi dài hơn max_chars bị cắt, truncated[key] = độ dài gốc lớn nhất); dict giữ các khoá con của danh mục; mảng-dict giữ các khoá con của danh mục và chỉ
        các phần tử generator dùng: reviews = phần tử đầu có source=google_maps; top_reviews = tối đa 5 phần tử có text; google_photos = tối đa 4 phần tử đầu; enrichment_log = phần tử
        source=google_maps có place_id (bỏ trùng); portfolio_urls = tối đa 4 phần tử; khoá vắng ở nguồn thì vắng ở record (không ghi null).
      audit = dòng enrichment-audit.json làm vendor tạm đóng (như build_pool: dòng mới nhất mỗi category có closed_state=temporarily_closed, hoặc status=temporarily_closed + retry=true)
              nếu có, không thì dòng audit theo luật T-124 (category nhà, rồi category khác); chỉ giữ khoá của danh mục (file enrichment-audit.json); không có dòng nào thì null.
      truncated = {khoá: độ dài gốc} (object, rỗng khi không cắt).
  - gốc báo cáo có thêm `pool_extra_inputs` = đúng mảng `extra_inputs` của danh mục (pool nền --base, manifest ảnh).
  - liên hệ: pool_input KHÔNG có khoá contact, phone, email, website, facebook, address, address_source (và danh mục không có mục nào như vậy). Chữ trong `description` / `top_reviews[].text` được GIỮ NGUYÊN VĂN
    (cắt theo max_chars; description cắt 220 ký tự = đúng phần pool đang công khai): số điện thoại, URL, zalo lẫn trong mô tả là việc của T-148, eval này không che và không đòi che.
  - tất định (hai lần chạy cùng byte), thoát 0 khi mạng bị chặn, không đổi byte nào trong dữ liệu.
  - `tools/regen-pool-styles.sh` KHÔNG ghi `enrich-report.json` (hợp đồng T-135: sync-vendor-pool chạy script này rồi `cmp` báo cáo đã commit với báo cáo sinh lại; nếu script tự sinh lại thì cổng đó mất tác dụng).
    Ca thử: dữ liệu bị đổi mô tả (làm style_tags phải đổi) mà báo cáo chưa sinh lại, chạy script (offline, --back tạm): báo cáo đã commit giữ nguyên byte và vẫn KHÁC báo cáo sinh lại từ dữ liệu (cổng tươi vẫn đỏ).
Thiếu tohong: PASS "chưa áp dụng". Chạy: python3 -I eval/T-147/check_2_bao_cao_pool_input.py. In PASS hoặc FAIL <lý do đầu> (+n); thoát 0/1."""
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
sys.dont_write_bytecode = True
import common, pool_reads

root = common.tohong()
if not root:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
cp = common.catalog_path(root)
if not os.path.isfile(cp):
    print("FAIL thiếu tools/scraper/pool-input-fields.json (danh mục)"); sys.exit(1)
if not os.path.isfile(os.path.join(root, "tools", "scraper", "build_enrich_report.py")):
    print("FAIL thiếu tools/scraper/build_enrich_report.py"); sys.exit(1)
catalog = json.load(open(cp, encoding="utf-8"))["fields"]
fails = []
bad = lambda m: fails.append(m)

tmp = tempfile.mkdtemp(prefix="t147-rep-")
try:
    t = os.path.join(tmp, "tohong")
    shutil.copytree(os.path.join(root, "tools"), os.path.join(t, "tools"), ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "run-logs"))
    sc = os.path.join(t, "tools", "scraper")
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    open(os.path.join(nd, "sitecustomize.py"), "w").write(pool_reads.NONET)
    env = dict(os.environ, PYTHONPATH=nd, PYTHONDONTWRITEBYTECODE="1", PYTHONHASHSEED="0", GOOGLE_MAPS_API_KEY="")

    def tree_hash(d):
        h = hashlib.sha256()
        for dp, dn, fn in sorted(os.walk(d)):
            dn.sort()
            for f in sorted(fn):
                p = os.path.join(dp, f); h.update(p.encode()); h.update(open(p, "rb").read())
        return h.hexdigest()

    def build(out):
        return subprocess.run([sys.executable, os.path.join(sc, "build_enrich_report.py"), "--state", "HCMC", "--output-dir", "output", "--out", out], cwd=sc, env=env, capture_output=True, text=True, timeout=300)

    before = tree_hash(os.path.join(sc, "output"))
    r1 = os.path.join(tmp, "r1.json"); r2 = os.path.join(tmp, "r2.json")
    p = build(r1)
    if p.returncode != 0:
        print("FAIL build_enrich_report.py thoát %d khi mạng bị chặn: %s" % (p.returncode, (p.stdout + p.stderr)[-200:])); sys.exit(1)
    build(r2)
    if tree_hash(os.path.join(sc, "output")) != before: bad("build_enrich_report.py làm đổi byte dữ liệu trong output/")
    if open(r1, "rb").read() != open(r2, "rb").read(): bad("hai lần chạy không cùng byte")
    rep = json.load(open(r1, encoding="utf-8"))
    for k in ("schema_version", "state", "data_as_of", "summary", "vendors"):
        if k not in rep: bad("báo cáo mất khoá T-124 `%s` ở gốc" % k)
    if rep.get("pool_catalog") != catalog: bad("pool_catalog ở gốc báo cáo khác `fields` của pool-input-fields.json")
    extra = json.load(open(cp, encoding="utf-8")).get("extra_inputs")
    if rep.get("pool_extra_inputs") != extra: bad("pool_extra_inputs ở gốc báo cáo khác `extra_inputs` của pool-input-fields.json")
    BADKEYS = {"contact", "phone", "email", "website", "facebook", "address", "address_source"}
    if any(f["key"].split("[]")[0].split(".")[0] in BADKEYS or f["key"].split(".")[-1] in BADKEYS for f in catalog): bad("danh mục có mục liên hệ/địa chỉ")

    # ---- giá trị mong đợi, tính độc lập bằng quy tắc trong docstring ----
    sys.path.insert(0, sc)
    import build_pool
    base = os.path.join(sc, "output", "HCMC")
    raw = []
    for f in build_pool.category_files(base, "vendors.json"):
        raw.extend(json.load(open(f, encoding="utf-8"))["vendors"])
    merged = {v["id"]: v for v in build_pool.collapse_by_id(raw)}
    vf = [x for x in catalog if x["file"] == "vendors.json"]
    af = [x["key"] for x in catalog if x["file"] == "enrichment-audit.json"]
    cap = {x["key"]: x.get("max_chars") for x in vf}
    tops = []
    for x in vf:
        k = x["key"].split("[]")[0].split(".")[0]
        if k not in tops: tops.append(k)

    def expect(rec):
        out, tr = {}, {}
        def cut(v, key):
            c = cap.get(key)
            if c and isinstance(v, str) and len(v) > c:
                tr[key] = max(tr.get(key, 0), len(v)); return v[:c]
            return v
        for k in tops:
            keys = [x["key"] for x in vf if x["key"].split("[]")[0].split(".")[0] == k]
            if k not in rec: continue
            v = rec[k]
            if k in keys:
                if k == "portfolio_urls" and isinstance(v, list): v = v[:4]
                out[k] = cut(v, k)
            elif isinstance(v, dict):
                s = {q.split(".", 1)[1]: v[q.split(".", 1)[1]] for q in keys if q.split(".", 1)[1] in v}
                if s: out[k] = s
            elif isinstance(v, list):
                els = [e for e in v if isinstance(e, dict)]
                if k == "reviews": els = [e for e in els if e.get("source") == "google_maps"][:1]
                elif k == "top_reviews": els = [e for e in els if e.get("text")][:5]
                elif k == "google_photos": els = els[:4]
                elif k == "enrichment_log": els = [e for e in els if e.get("source") == "google_maps" and e.get("place_id")]
                subs = [q.split("[].", 1)[1] for q in keys]
                lst = []
                for e in els:
                    pr = {n: cut(e[n], k + "[]." + n) for n in subs if n in e}
                    if pr and pr not in lst: lst.append(pr)
                if lst: out[k] = lst
        return out, tr

    closing = {}
    for f in build_pool.category_files(base, "enrichment-audit.json"):
        last = {r.get("vendor_id"): r for r in json.load(open(f, encoding="utf-8")) if isinstance(r, dict)}
        for vid, r in last.items():
            if r.get("closed_state") == "temporarily_closed" or (r.get("status") == "temporarily_closed" and r.get("retry") is True):
                closing.setdefault(vid, r)
    ORDER = ["venue", "photography", "wedding_attire", "makeup", "flower", "wedding_interior", "ceremony", "invitation", "wedding_gift", "wedding_ring", "wedding_car", "honeymoon", "wedding_planner", "other"]
    audit_rows = {}
    for c in ORDER:
        fp = os.path.join(base, c, "enrichment-audit.json")
        if os.path.isfile(fp):
            for r in json.load(open(fp, encoding="utf-8")):
                audit_rows.setdefault(r["vendor_id"], {})[c] = r

    def t124_audit(vid):
        by = audit_rows.get(vid, {})
        cats = [c for c in ORDER if os.path.isfile(os.path.join(base, c, "vendors.json")) and any(x["id"] == vid for x in json.load(open(os.path.join(base, c, "vendors.json"), encoding="utf-8"))["vendors"])]
        return by.get(cats[0]) or next((by[c] for c in cats if c in by), None) if cats else None

    n_bad = 0
    first = None
    for row in rep["vendors"]:
        pi = row.get("pool_input")
        vid = row["id"]
        if not (isinstance(pi, dict) and isinstance(pi.get("record"), dict) and isinstance(pi.get("truncated"), dict) and "audit" in pi):
            n_bad += 1; first = first or "%s: pool_input sai dạng" % vid; continue
        rec, tr = expect(merged[vid])
        arow = closing.get(vid) or t124_audit(vid)
        want_audit = {k: arow[k] for k in af if k in arow} if arow else None
        if pi["record"] != rec or pi["truncated"] != tr or pi["audit"] != want_audit:
            n_bad += 1
            if not first:
                dk = [k for k in set(rec) | set(pi["record"]) if rec.get(k) != pi["record"].get(k)]
                first = "%s: pool_input khác kỳ vọng (record khoá %s, truncated %s, audit %s)" % (vid, dk[:3], pi["truncated"] == tr, pi["audit"] == want_audit)
        def keys_of(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    yield k
                    yield from keys_of(v)
            elif isinstance(x, list):
                for e in x:
                    yield from keys_of(e)
        hit = BADKEYS & set(keys_of(pi))
        if hit: bad("%s: pool_input có khoá liên hệ/địa chỉ %s" % (vid, sorted(hit))); n_bad += 0
    if n_bad: bad("%d/%d vendor có pool_input sai; ví dụ %s" % (n_bad, len(rep["vendors"]), first))
    if len(rep["vendors"]) != len([1 for _ in rep["vendors"]]) or not rep["vendors"]: bad("báo cáo không có vendor")
    ncap = sum(1 for r in rep["vendors"] if r.get("pool_input", {}).get("truncated"))
    if cap.get("description") and not ncap: bad("không vendor nào bị cắt mô tả (max_chars=%s): dữ liệu thật có mô tả dài hơn" % cap.get("description"))

    # ---- regen-pool-styles.sh không ghi báo cáo, cổng tươi của T-135 còn răng ----
    b = common.back()
    sh = os.path.join(t, "tools", "regen-pool-styles.sh")
    if not (b and os.path.isfile(os.path.join(b, "lib", "vendorPool.generated.js")) and os.path.isfile(sh)):
        bad("thiếu tohong-back (lib/vendorPool.generated.js) hoặc tools/regen-pool-styles.sh để thử bước tạo lại pool")
    else:
        bk = os.path.join(tmp, "back"); os.makedirs(os.path.join(bk, "lib"))
        shutil.copy(os.path.join(b, "lib", "vendorPool.generated.js"), os.path.join(bk, "lib"))
        rp = os.path.join(base, "enrich-report.json")
        build(rp)                       # báo cáo "đã commit" khớp dữ liệu hiện tại
        committed = open(rp, "rb").read()
        vf0 = next(f for f in build_pool.category_files(base, "vendors.json") if os.path.basename(os.path.dirname(f)) == "venue")
        d = json.load(open(vf0, encoding="utf-8"))
        tgt = d["vendors"][0]
        tgt["description"] = "Sang trọng luxury hàn quốc korean rustic " + (tgt.get("description") or "")   # PR dữ liệu đổi mô tả mà không sinh lại báo cáo
        tgt["style_tags"] = []
        json.dump(d, open(vf0, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        p = subprocess.run(["bash", sh, "--back", bk], cwd=t, env=env, capture_output=True, text=True, timeout=600)
        if p.returncode != 0:
            bad("regen-pool-styles.sh thoát %d trên bản sao (offline): %s" % (p.returncode, (p.stdout + p.stderr)[-200:]))
        else:
            fresh = os.path.join(tmp, "fresh.json"); build(fresh)
            if json.load(open(vf0, encoding="utf-8"))["vendors"][0].get("style_tags") == []: bad("ca thử vô hiệu: regen-pool-styles.sh không tính lại style_tags")
            if open(rp, "rb").read() != committed: bad("regen-pool-styles.sh đã ghi đè enrich-report.json (cổng báo cáo tươi của sync-vendor-pool sẽ chỉ so hai bản sinh lại với nhau, T-135 D6)")
            if open(fresh, "rb").read() == committed: bad("ca thử vô hiệu: báo cáo sinh lại sau khi đổi mô tả vẫn bằng báo cáo cũ")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if fails:
    print("FAIL " + fails[0] + (" (+%d lỗi nữa)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS")
