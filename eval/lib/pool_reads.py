"""T-147: đo bằng THỰC NGHIỆM trường nào của dữ liệu nguồn làm đổi kết quả sinh vendor pool (không đọc mã, không bám tên hàm).

Với mỗi đường dẫn trường p của bản ghi nguồn (`k`, `k.sub`, `k[].sub`; tối đa hai cấp) trong bản chụp dữ liệu thật của tohong:
đổi p (xoá, hoặc thay bằng giá trị đánh dấu) trên mọi bản ghi rồi chạy lại từng bước sinh pool; nếu đầu ra đổi (hoặc bước đó chết) thì bước đó "đọc" p.
Ba bước (đúng như tools/regen-pool-styles.sh và tools/generate-vendor-pool.js; nguồn pool là pool-vendors.json do build_pool.py gộp từ vendors.json):
  style : clean_style_tags.py        (vendors.json -> style_tags)                                    so sánh style_tags mọi bản ghi
  build : build_pool.py              (vendors.json + enrichment-audit.json -> pool-vendors.json)     so sánh tập id và mọi trường KHÁC trường đang đổi
  gen   : generate-vendor-pool.js    (pool-vendors.json -> vendorPool.generated.js), ba lần chạy: sinh đầy đủ; --styles-only --prune --photos-for all;
          và cùng chế độ đó khi nguồn mất ảnh Google còn pool nền còn ảnh (nhánh "hạ ảnh")
Kết quả: {"style": {đường dẫn}, "build": {...}, "audit": {...}, "gen": {...}}; "audit" là trường của dòng enrichment-audit.json mà build_pool.py đọc.
Trường chỉ được build_pool.py sao nguyên (không quyết định gì) không tính là "build đọc"; nếu generator cũng không đọc thì nó không dùng để tạo pool.
Mạng bị chặn (sitecustomize), không ghi gì trong repo (chạy trên bản sao tạm, không .pyc). Cần node + python3.
"""
import copy, glob, json, os, shutil, subprocess, sys, tempfile

SENT_STR = "sang trọng luxury korean rustic ZZ_T147"
NONET = "import socket\ndef _b(*a,**k):\n    raise OSError('eval T-147: mang bi chan')\nsocket.socket.connect=_b\nsocket.socket.connect_ex=_b\nsocket.create_connection=_b\nsocket.getaddrinfo=_b\n"


def sentinel(x):
    if isinstance(x, bool):
        return not x
    if isinstance(x, (int, float)):
        return 987654.5
    if isinstance(x, list):
        return [SENT_STR]
    if isinstance(x, dict):
        return {"zz_t147": 1}
    return SENT_STR


def paths_of(rec):
    """Đường dẫn trường (tối đa hai cấp) có mặt trong một bản ghi."""
    out = set()
    for k, v in rec.items():
        out.add(k)
        if isinstance(v, dict):
            out.update(f"{k}.{s}" for s in v)
        elif isinstance(v, list):
            for e in v:
                if isinstance(e, dict):
                    out.update(f"{k}[].{s}" for s in e)
    return out


def apply(rec, path, mode):
    """Đổi một đường dẫn trên MỘT bản ghi (đã deepcopy). mode: delete | sent."""
    def put(d, key):
        if key in d:
            if mode == "delete":
                del d[key]
            else:
                d[key] = sentinel(d[key])
    if "[]." in path:
        k, s = path.split("[].")
        if isinstance(rec.get(k), list):
            for e in rec[k]:
                if isinstance(e, dict):
                    put(e, s)
    elif "." in path:
        k, s = path.split(".", 1)
        if isinstance(rec.get(k), dict):
            put(rec[k], s)
    else:
        put(rec, path)


def drop(rec, path):
    r = copy.deepcopy(rec)
    apply(r, path, "delete")
    return r


def ordered_files(scraper, name):
    sys.path.insert(0, scraper)
    try:
        from build_pool import category_files  # chỉ dùng hàm sắp xếp theo thứ tự pipeline
        return category_files(os.path.join(scraper, "output", "HCMC"), name)
    finally:
        sys.path.remove(scraper)


def pick_subset(vendors_by_cat, audit_by_cat, per_path=2):
    """Tập bản ghi nhỏ phủ mọi đường dẫn trường (mỗi đường dẫn tối đa per_path bản ghi), thêm id nằm ở >=2 category và id có dòng audit đóng cửa."""
    chosen = {}
    seen_count = {}
    multi = {}
    for cat, recs in vendors_by_cat.items():
        for r in recs:
            multi.setdefault(r["id"], []).append(cat)
    for cat, recs in vendors_by_cat.items():
        for r in recs:
            for p in paths_of(r):
                if seen_count.get(p, 0) < per_path:
                    seen_count[p] = seen_count.get(p, 0) + 1
                    chosen[(cat, r["id"])] = r
    extra = [i for i, c in multi.items() if len(c) > 1][:6]
    closed = {x.get("vendor_id") for rows in audit_by_cat.values() for x in rows if x.get("closed_state") or x.get("status") == "temporarily_closed"}
    extra += [i for i in sorted(closed) if i in multi][:4]
    for cat, recs in vendors_by_cat.items():
        for r in recs:
            if r["id"] in extra:
                chosen[(cat, r["id"])] = r
    ids = {i for (_, i) in chosen}
    out_v = {c: [r for r in recs if (c, r["id"]) in chosen] for c, recs in vendors_by_cat.items()}
    out_a = {c: [x for x in rows if x.get("vendor_id") in ids] for c, rows in audit_by_cat.items()}
    # hai dòng audit tổng hợp cho nhánh status="temporarily_closed" + retry=true của build_pool (dữ liệu thật hiện chỉ có nhánh closed_state)
    cands = [(c, r["id"]) for c, recs in vendors_by_cat.items() for r in recs
             if (c, r["id"]) in chosen and not any(e.get("place_id") for e in (r.get("enrichment_log") or []) if isinstance(e, dict))]
    for c, i in cands[:2]:
        out_a.setdefault(c, []).append({"vendor_id": i, "status": "temporarily_closed", "retry": True, "reason": "t147 tong hop"})
    return {c: v for c, v in out_v.items() if v}, out_a


def schema_fields(scraper):
    """Tên trường của class Vendor / Contact trong schema.py (để nới fixture: trường có trong schema nhưng chưa có trong dữ liệu thật vẫn được thử)."""
    import re
    out = {"Vendor": {}, "Contact": {}}
    cur = None
    for line in open(os.path.join(scraper, "schema.py"), encoding="utf-8"):
        m = re.match(r"class (\w+)\(", line)
        if m:
            cur = m.group(1) if m.group(1) in out else None
            continue
        m = re.match(r"    ([a-z_][a-z0-9_]*):\s*(.+)", line)
        if cur and m:
            ann = m.group(2)
            out[cur][m.group(1)] = [] if ann.startswith("list[") else (7 if re.match(r"(Optional\[)?(int|float)", ann) else "x")
    return out


def add_synthetic(scraper, base_v):
    """Một bản ghi tổng hợp mang MỌI trường của schema (kể cả cái chưa có trong dữ liệu thật) để eval bắt được generator đọc trường mới."""
    cat = next(iter(base_v))
    rec = copy.deepcopy(base_v[cat][0])
    sf = schema_fields(scraper)
    rec["id"] = "t147_synthetic"
    for k, v in sf["Vendor"].items():
        if k not in rec:
            rec[k] = v
    c = dict(rec.get("contact") or {})
    for k, v in sf["Contact"].items():
        c.setdefault(k, v)
    rec["contact"] = c
    base_v[cat].append(rec)


def write_fixture(root, vendors_by_cat, audit_by_cat):
    shutil.rmtree(os.path.join(root, "output"), ignore_errors=True)
    for cat, recs in vendors_by_cat.items():
        d = os.path.join(root, "output", "HCMC", cat)
        os.makedirs(d, exist_ok=True)
        json.dump({"vendors": recs}, open(os.path.join(d, "vendors.json"), "w", encoding="utf-8"), ensure_ascii=False)
        json.dump(audit_by_cat.get(cat, []), open(os.path.join(d, "enrichment-audit.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({"vendors": []}, open(os.path.join(root, "output", "vendors.json"), "w"))


def detect(tohong):
    tmp = tempfile.mkdtemp(prefix="t147-reads-")
    try:
        src = os.path.join(tohong, "tools", "scraper")
        sc = os.path.join(tmp, "tools", "scraper")
        shutil.copytree(src, sc, ignore=shutil.ignore_patterns("output", "run-logs", "__pycache__", "testdata", "*.pyc"))
        shutil.copy(os.path.join(tohong, "tools", "generate-vendor-pool.js"), os.path.join(tmp, "tools", "generate-vendor-pool.js"))
        nd = os.path.join(tmp, "nonet")
        os.makedirs(nd)
        open(os.path.join(nd, "sitecustomize.py"), "w").write(NONET)
        env = dict(os.environ, PYTHONPATH=nd, PYTHONDONTWRITEBYTECODE="1", PYTHONHASHSEED="0", GOOGLE_MAPS_API_KEY="")

        vs, au = {}, {}
        for f in ordered_files(src, "vendors.json"):
            cat = os.path.basename(os.path.dirname(f))
            vs[cat] = json.load(open(f, encoding="utf-8")).get("vendors", [])
            ap = os.path.join(os.path.dirname(f), "enrichment-audit.json")
            au[cat] = json.load(open(ap, encoding="utf-8")) if os.path.isfile(ap) else []
        base_v, base_a = pick_subset(vs, au)
        add_synthetic(src, base_v)
        v_paths = set().union(*(paths_of(r) for recs in base_v.values() for r in recs))
        a_paths = set().union(*(paths_of(r) for rows in base_a.values() for r in rows))
        state = {"crash": False, "baseline": True}

        def run_py(script, *a):
            state["crash"] = False
            r = subprocess.run([sys.executable, script, *a], cwd=sc, env=env, capture_output=True, text=True, timeout=300)
            if r.returncode != 0:
                if state["baseline"]:
                    raise RuntimeError(f"{os.path.basename(script)} thoát {r.returncode} trên dữ liệu gốc: {(r.stdout + r.stderr)[-400:]}")
                state["crash"] = True  # đổi trường làm bước sinh chết: bước đó chắc chắn đọc trường này

        def fixture(vpath=None, apath=None, mode="delete"):
            v, a = copy.deepcopy(base_v), copy.deepcopy(base_a)
            for recs in v.values():
                for r in recs:
                    if vpath:
                        apply(r, vpath, mode)
            for rows in a.values():
                for r in rows:
                    if apath:
                        apply(r, apath, mode)
            write_fixture(sc, v, a)

        def style_out():
            run_py(os.path.join(sc, "clean_style_tags.py"))
            if state["crash"]:
                return "CRASH"
            res = {}
            for f in glob.glob(os.path.join(sc, "output", "HCMC", "*", "vendors.json")):
                for n, r in enumerate(json.load(open(f, encoding="utf-8"))["vendors"]):
                    res[(os.path.basename(os.path.dirname(f)), n)] = r.get("style_tags")
            return res

        def build_out(skip=None):
            outp = os.path.join(tmp, "pool-vendors.json")
            run_py(os.path.join(sc, "build_pool.py"), "--out", outp)
            if state["crash"]:
                return "CRASH"
            d = json.load(open(outp, encoding="utf-8"))
            return {r["id"]: (drop(r, skip) if skip else r) for r in d["vendors"]}

        res = {"style": set(), "build": set(), "audit": set(), "gen": set(), "overrides": set(), "report": set(), "pool_base": set()}
        # ---- bước style ----
        fixture()
        base_style = style_out()
        state["baseline"] = False
        for p in sorted(v_paths - {"style_tags"}):
            for mode in ("delete", "sent"):
                fixture(vpath=p, mode=mode)
                if style_out() != base_style:
                    res["style"].add(p)
                    break
        # ---- bước build ----
        state["baseline"] = True
        fixture()
        base_build = build_out()
        state["baseline"] = False
        for p in sorted(v_paths):
            for mode in ("delete", "sent"):
                fixture(vpath=p, mode=mode)
                got = build_out(skip=p)
                if got == "CRASH" or got != {i: drop(r, p) for i, r in base_build.items()}:
                    res["build"].add(p)
                    break
        for p in sorted(a_paths):
            for mode in ("delete", "sent"):
                fixture(apath=p, mode=mode)
                if build_out() != base_build:
                    res["audit"].add(p)
                    break
        # ---- tệp ngoài vendors.json: manual_overrides.json và enrich-report.json có làm đổi kết quả không ----
        ovp = os.path.join(src, "output", "HCMC", "manual_overrides.json")
        ovr = json.load(open(ovp, encoding="utf-8")) if os.path.isfile(ovp) else {"schema_version": 1, "overrides": []}
        o_paths = set().union(set(), *(paths_of(e) for e in ovr.get("overrides", [])))
        rep_real = os.path.join(src, "output", "HCMC", "enrich-report.json")

        def put_extra(ov_doc, rep_doc):
            d = os.path.join(sc, "output", "HCMC")
            json.dump(ov_doc, open(os.path.join(d, "manual_overrides.json"), "w", encoding="utf-8"), ensure_ascii=False)
            json.dump(rep_doc, open(os.path.join(d, "enrich-report.json"), "w", encoding="utf-8"), ensure_ascii=False)

        def both():
            state["crash"] = False
            return (build_out(), style_out())

        state["baseline"] = True
        fixture()
        put_extra(ovr, json.load(open(rep_real, encoding="utf-8")) if os.path.isfile(rep_real) else {"vendors": []})
        base_both = both()
        state["baseline"] = False
        for p in sorted(o_paths):
            for mode in ("delete", "sent"):
                o2 = copy.deepcopy(ovr)
                for e in o2.get("overrides", []):
                    apply(e, p, mode)
                put_extra(o2, json.load(open(rep_real, encoding="utf-8")) if os.path.isfile(rep_real) else {"vendors": []})
                if both() != base_both:
                    res["overrides"].add(p)
                    break
        # enrich-report.json: thay bằng báo cáo rác, hoặc xoá mọi dòng; và xoá hẳn manual_overrides.json
        for rep2 in ({"garbage": 1}, {"vendors": [], "summary": {}}):
            put_extra(ovr, rep2)
            if both() != base_both:
                res["report"].add("(tệp)")
        put_extra({"schema_version": 1, "overrides": []}, {"vendors": []})
        if both() != base_both:
            res["overrides"].add("(tệp)")
        # ---- bước gen ----
        fixture()
        pool_doc = {"vendors": list(base_build.values())}
        g_paths = set().union(*(paths_of(r) for r in pool_doc["vendors"]))
        base_pool_js = os.path.join(tmp, "base-pool.js")

        def gen(doc, mode_name):
            inp = os.path.join(tmp, "in.json")
            json.dump(doc, open(inp, "w", encoding="utf-8"), ensure_ascii=False)
            out = os.path.join(tmp, "out_" + mode_name + ".js")
            a = ["--in", inp, "--out", out]
            if mode_name == "styles":
                a += ["--styles-only", "--prune", "--photos-for", "all", "--base", base_pool_js]
            r = subprocess.run(["node", os.path.join(tmp, "tools", "generate-vendor-pool.js"), *a], cwd=tmp, env=env, capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                if state["baseline"]:
                    raise RuntimeError("generate-vendor-pool.js thoát %d trên dữ liệu gốc: %s" % (r.returncode, (r.stdout + r.stderr)[-400:]))
                return "EXIT%d" % r.returncode
            return open(out, "rb").read()

        state["baseline"] = True
        full0 = gen(pool_doc, "full").decode()
        head, body = full0.split("= ", 1)
        arr = json.loads(body.rsplit(";", 1)[0])
        # pool nền cho --styles-only: thiếu 2 vendor đầu để nhánh --prune "thêm lại" cũng chạy
        open(base_pool_js, "w", encoding="utf-8").write(head + "= " + json.dumps(arr[2:], ensure_ascii=False) + ";\n")
        doc_nophoto = copy.deepcopy(pool_doc)
        for r in doc_nophoto["vendors"]:
            r.pop("google_photos", None)

        def gen_all(d1, d2):
            return (gen(d1, "full"), gen(d1, "styles"), gen(d2, "styles"))

        base_all = gen_all(pool_doc, doc_nophoto)
        state["baseline"] = False
        # pool nền (--base) có phải đầu vào không: đổi rating của vendor đầu tiên trong pool nền, chế độ --styles-only phải đổi đầu ra
        bp = open(base_pool_js, encoding="utf-8").read()
        h2, b2 = bp.split("= ", 1)
        arr2 = json.loads(b2.rsplit(";", 1)[0])
        arr2[0]["rating"] = 1234.5
        open(base_pool_js, "w", encoding="utf-8").write(h2 + "= " + json.dumps(arr2, ensure_ascii=False) + ";\n")
        if gen(pool_doc, "styles") != base_all[1]:
            res["pool_base"].add("--base")
        open(base_pool_js, "w", encoding="utf-8").write(bp)
        for p in sorted(g_paths):
            for mode in ("delete", "sent"):
                d1, d2 = copy.deepcopy(pool_doc), copy.deepcopy(doc_nophoto)
                for r in d1["vendors"] + d2["vendors"]:
                    apply(r, p, mode)
                if gen_all(d1, d2) != base_all:
                    res["gen"].add(p)
                    break
        return res
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    r = detect(sys.argv[1])
    print(json.dumps({k: sorted(v) for k, v in r.items()}, ensure_ascii=False, indent=1))
