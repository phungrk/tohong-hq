#!/usr/bin/env python3
"""T-135 tiêu chí 10 (repo tohong; quyết định tiền, phương án A của Capu hoặc mặc định khi Capu chưa trả lời, hồ sơ inbox/capu/T-135-tran-chi-google-tu-dong.md):
đường TỰ ĐỘNG chỉ gọi Google trong hạn mức miễn phí của tháng (chi thật $0). Cổng hạn mức tính MỌI request Google của lượt tự chạy (resolve, enrich đường cũ kể cả ảnh của nó, lấy ảnh) theo trường hợp xấu nhất;
phần nào không vừa hạn mức thì chạy với --max-requests 0, phần không cần Google (gỡ, đóng cửa) vẫn được áp, job đỏ ở bước cuối "Báo hạn mức: cần Capu duyệt chạy tay".
Tham số ở `tools/scraper/auto_resolve_limits.json` (mặc định A: max_net_usd_batch=0, max_net_usd_month=0, enrich_max_requests=2, refresh_max_requests=6); phương án B (2 và 10) chỉ đổi số. Chi net tính bằng usage.py (net_usd,
1.000 miễn phí mỗi SKU, biên 50). Ước tính theo loại mục: mục `place_id` = 1 Place Details + 1 Text Search (nếu --suggest) = 2 request; mục `maps_link` = xấu nhất 1 Place Details + 2 Text Search = 3 request (link dạng tên resolve
bằng Text Search, link ngắn chưa mở được ở bbước ước tính); enrich và ảnh = mỗi request tính vào SKU xấu nhất, tối đa enrich_max_requests và refresh_max_requests. Cổng in
`BATCH_ESTIMATE … resolve=<n> enrich=<n> refresh=<n>` và `QUOTA_ALLOWED resolve=<n> enrich=<n> refresh=<n>`; vượt thì thêm `QUOTA_EXCEEDED … cần Capu duyệt chạy tay … $<số>`.
Chạy NGUYÊN VĂN job resolve-overrides (sự kiện pull_request merged) trên bản sao git của repo thật, rồi chạy thật từng script Google với lớp chặn mạng ghi lại mỗi lần định gọi googleapis.com:
  (1) tháng đã dùng 1.040 ảnh, lô chỉ có remove (0 mục Google): mọi script Google nhận --max-requests 0 (resolve, enrich, ảnh), 0 lần định gọi Google, vẫn áp phần gỡ (PR có vendors/removed_vendors của hai category),
      log + Summary ghi "cần Capu duyệt chạy tay" kèm tiền ước tính > 0, job đỏ ở bước "Báo hạn mức: …" SAU khi PR đã mở;
  (2) 15 mục place_id, tháng đã dùng 925 Text Search: resolve = 30 request ĐƯỢC chạy; 15 mục maps_link cùng điều kiện: resolve = 45 request BỊ chặn (--max-requests 0, 0 lần gọi Google) vì Text Search chạm hạn mức;
  (3) tháng trống, 15 mục place_id: mọi phần được phép; resolve --max-requests 30, enrich <= enrich_max_requests, ảnh <= refresh_max_requests; không bước nào thiếu --max-requests;
  (4) CHỈ ĐỔI SỐ sang phương án B (2 và 10): lô place_id đã dùng 990 ảnh (bị chặn ở A) thì được chạy; tháng đã net > $10 thì bị chặn;
  (5) Capu bấm tay (workflow_dispatch dry_run=false): không bị cổng chặn; script vẫn nhận --max-requests.
Sổ chi TRƯỚC khi gửi (chạy thật từng script, stdout ra file, lớp chặn mạng đếm dòng GOOGLE_REQUEST đã có khi mỗi lần định gọi Google): resolve_overrides.py (thường và --suggest), refresh_photos.py, enrich.py đường cũ —
với --max-requests 0 thử 0 lần; không giới hạn thì mọi lần thử đều có dòng GOOGLE_REQUEST in trước (không lần nào UNORDERED).
Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import glob, json, os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None or "pull_request" not in t.on_of(wf):
    print("FAIL resolve-overrides.yml chưa có kích hoạt tự động (tiêu chí 1)"); sys.exit(1)
JOB = next(iter(wf["jobs"]))
LIM = os.path.join(t.TOHONG, "tools", "scraper", "auto_resolve_limits.json")
if not os.path.isfile(LIM):
    t.done(["thiếu tools/scraper/auto_resolve_limits.json (nguồn tham số hạn mức)"], "")
lim = json.load(open(LIM)); bad = []
for k, v in (("max_net_usd_batch", 0), ("max_net_usd_month", 0), ("enrich_max_requests", 2), ("refresh_max_requests", 6)):
    if lim.get(k) != v: bad.append("auto_resolve_limits.json: %s = %r, mặc định phương án A là %r" % (k, lim.get(k), v))
GOOGLE = re.compile(r"(resolve_overrides|enrich|refresh_photos)\.py")
LOGNET = os.path.join(t.HERE, "lib_nonet_log")
def google_calls(box):
    return [a for _, a in box.py_calls() if GOOGLE.search(a) and not re.search(r"--(dry-run|probe|apply-review-rule)", a)]
def flag(a, name):
    m = re.search(r"%s\s+['\"]?(\d+)" % re.escape(name), a)
    return int(m.group(1)) if m else None
def places_attempts(box):
    p = os.path.join(box.tmp, "net.log")
    return len(open(p).read().split()) if os.path.exists(p) else 0
box = t.Box(t.TOHONG)
try:
    shutil.copy(os.path.join(LOGNET, "sitecustomize.py"), os.path.join(box.nonet, "sitecustomize.py"))   # lớp chặn có ghi: workflow chạy với nó
    os.environ["NET_LOG"] = os.path.join(box.tmp, "net.log")
    t.mutate_fixture_overrides(box, 2)
    BASE0 = t.git(box.ws, "rev-parse", "HEAD").stdout.strip()
    def fresh(n_pid=0, n_link=0, ph=0, ts=0):
        box.reset(); t.git(box.ws, "reset", "-q", "--hard", BASE0); t.git(box.ws, "branch", "-f", "main", BASE0)
        if n_pid: t.add_unresolved(box, n_pid, "place_id")
        if n_link: t.add_unresolved(box, n_link, "link")
        t.set_baseline(box, ts, ph)
        if os.path.exists(os.environ["NET_LOG"]): os.remove(os.environ["NET_LOG"])
    def run(event="pull_request", inputs=None, ev_=None):
        box.gh_db({"prs": [], "runs": {}}); rec = []
        c = t.gh_ctx(box, event, event=ev_ if ev_ is not None else t.pr_event(), inputs=inputs, vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets={"GOOGLE_MAPS_API_KEY": "fake-key-not-real"})
        res = t.run_job(box, wf, JOB, c, uses={"actions/": lambda w, s: {}, "peter-evans/create-pull-request": t.make_cpr(box, rec)})
        return res, rec
    summary = lambda: open(os.path.join(box.log, "summary.txt"), encoding="utf-8").read() if os.path.isfile(os.path.join(box.log, "summary.txt")) else ""
    quota = lambda res: next(((n, o) for n, o in res["order"] if n.startswith("Cổng: hạn mức")), None)
    def allowed(res):
        m = re.search(r"QUOTA_ALLOWED resolve=(\d+) enrich=(\d+) refresh=(\d+)", res["log"])
        return tuple(int(x) for x in m.groups()) if m else None
    def need(res):
        m = re.search(r"BATCH_ESTIMATE\b[^\n]*resolve=(\d+) enrich=(\d+) refresh=(\d+)", res["log"])
        return tuple(int(x) for x in m.groups()) if m else None
    def caps(box_):
        out = {}
        for a in google_calls(box_):
            k = "resolve" if "resolve_overrides.py" in a else "enrich" if "enrich.py" in a else "refresh"
            out.setdefault(k, []).append(flag(a, "--max-requests"))
        return out
    # (1) C1
    fresh(ph=1040)
    res, rec = run(); q = quota(res); cp = caps(box); al = allowed(res)
    if q is None: bad.append("(1) thiếu bước 'Cổng: hạn mức…'")
    if al != (0, 0, 0): bad.append("(1) tháng đã vượt hạn mức: QUOTA_ALLOWED phải là resolve=0 enrich=0 refresh=0; thấy %r" % (al,))
    for k in ("resolve", "enrich", "refresh"):
        if any(v != 0 for v in cp.get(k, [])): bad.append("(1) %s phải nhận --max-requests 0 (hoặc không chạy) khi tháng đã vượt hạn mức; thấy %s" % (k, cp.get(k)))
    if places_attempts(box): bad.append("(1) vẫn %d lần định gọi Google khi tháng đã vượt hạn mức" % places_attempts(box))
    lg = res["log"]; money = re.search(r"cần Capu duyệt chạy tay[^\n]*\$\s*(\d+(?:[.,]\d+)?)", lg)
    if not money or float(money.group(1).replace(",", ".")) <= 0: bad.append("(1) log phải ghi 'cần Capu duyệt chạy tay' kèm số tiền ước tính > 0")
    if "cần Capu duyệt chạy tay" not in summary(): bad.append("(1) Summary phải ghi 'cần Capu duyệt chạy tay'")
    made = [r for r in rec if r["operation"] == "created"]
    if len(made) != 1 or not any(f.endswith("removed_vendors.json") for f in made[0]["files"]): bad.append("(1) phần không cần Google (gỡ vendor) vẫn phải được áp và mở PR; thấy %s" % [r["operation"] for r in rec])
    last = [(n, o) for n, o in res["order"] if n.startswith("Báo hạn mức")]
    if not last or last[0][1] != "failure": bad.append("(1) thiếu bước cuối 'Báo hạn mức: cần Capu duyệt chạy tay' làm job đỏ: %s" % last)
    # (2) C2: Text Search tháng 925; place_id vs maps_link
    fresh(n_pid=15, ts=925)
    res, rec = run(); al, nd = allowed(res), need(res)
    if nd is None or nd[0] != 30: bad.append("(2) 15 mục place_id: resolve ước tính phải là 30 request (15 Details + 15 Text Search); thấy %r" % (nd,))
    if al is None or al[0] != 30 or not any(flag(a, "--max-requests") == 30 for a in google_calls(box) if "resolve_overrides.py" in a): bad.append("(2) 15 mục place_id, Text Search 925: resolve phải ĐƯỢC chạy với --max-requests 30; allowed=%r" % (al,))
    fresh(n_link=15, ts=925)
    res, rec = run(); al, nd = allowed(res), need(res)
    if nd is None or nd[0] != 45: bad.append("(2) 15 mục maps_link: resolve ước tính phải là 45 request (15 Details + 30 Text Search xấu nhất); thấy %r" % (nd,))
    if al is None or al[0] != 0 or any(v != 0 for v in caps(box).get("resolve", [])): bad.append("(2) 15 mục maps_link, Text Search 925 (chạm 1.000 với biên 50): resolve phải bị chặn (mọi lần chạy resolve/--suggest nhận --max-requests 0); allowed=%r caps=%r" % (al, caps(box).get("resolve")))
    # (3)
    fresh(n_pid=15)
    res, rec = run(); al = allowed(res); cp = caps(box)
    if al != (30, lim["enrich_max_requests"], lim["refresh_max_requests"]): bad.append("(3) tháng trống: phải được phép (30, %d, %d); thấy %r" % (lim["enrich_max_requests"], lim["refresh_max_requests"], al))
    for k, mx in (("resolve", 30), ("enrich", lim["enrich_max_requests"]), ("refresh", lim["refresh_max_requests"])):
        vs = cp.get(k)
        if not vs: bad.append("(3) %s không được chạy khi được phép" % k)
        elif any(v is None for v in vs): bad.append("(3) %s thiếu --max-requests" % k)
        elif any(v > mx for v in vs): bad.append("(3) %s --max-requests %s > %d" % (k, vs, mx))
    # (4) chỉ đổi số
    fresh(n_pid=15, ph=990)
    res, rec = run()
    if allowed(res) is None or allowed(res)[0] != 0: bad.append("(4) phương án A, 990 ảnh: resolve phải bị chặn (đối chứng); thấy %r" % (allowed(res),))
    t.set_limits(box, max_net_usd_batch=2, max_net_usd_month=10)
    res, rec = run()
    if allowed(res) is None or allowed(res)[0] != 30: bad.append("(4) phương án B (chỉ đổi số): resolve phải được chạy 30; thấy %r" % (allowed(res),))
    t.set_baseline(box, 1300, 0)
    res, rec = run()
    if allowed(res) is None or allowed(res)[0] != 0: bad.append("(4) phương án B: tháng đã net > $10 thì phải bị chặn; thấy %r" % (allowed(res),))
    # (5) dispatch tay
    fresh(n_pid=15, ph=990)
    res, rec = run(event="workflow_dispatch", inputs={"dry_run": "false"}, ev_={})
    q = quota(res)
    if q is not None and q[1] == "failure": bad.append("(5) Capu bấm tay không được bị cổng hạn mức chặn")
    rc = [a for a in google_calls(box) if "resolve_overrides.py" in a]
    if not rc or any(flag(a, "--max-requests") is None or flag(a, "--max-requests") == 0 for a in rc): bad.append("(5) dispatch tay: resolve phải chạy với --max-requests > 0; thấy %s" % [a[:70] for a in rc])
    # sổ chi TRƯỚC khi gửi, từng script
    fresh(n_pid=8, n_link=8)
    sc = os.path.join(box.ws, "tools", "scraper")
    nl = os.path.join(box.tmp, "net.log"); so = os.path.join(box.tmp, "stdout.txt")
    for _k in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy", "ALL_PROXY"): os.environ.pop(_k, None)
    env = dict(os.environ, PYTHONPATH=LOGNET, NET_LOG=nl, STDOUT_FILE=so, PYTHONDONTWRITEBYTECODE="1", GOOGLE_MAPS_API_KEY="fake-key-not-real", GITHUB_RUN_ID="4242")
    def attempt(argv, label):
        for f in (nl, so):
            if os.path.exists(f): os.remove(f)
        with open(so, "w", encoding="utf-8") as fh:
            p = subprocess.run([sys.executable] + argv, cwd=sc, env=env, stdout=fh, stderr=subprocess.STDOUT, timeout=300)
        lines = open(nl).read().split() if os.path.exists(nl) else []
        out = open(so, encoding="utf-8", errors="replace").read()
        if "unrecognized arguments" in out: bad.append("%s: chưa có --max-requests" % label)
        return len(lines), lines.count("UNORDERED"), out.count("GOOGLE_REQUEST")
    for label, argv in (("resolve_overrides.py", ["resolve_overrides.py", "--state", "HCMC"]), ("resolve_overrides.py --suggest", ["resolve_overrides.py", "--state", "HCMC", "--suggest"])):
        n0, u0, r0 = attempt(argv + ["--max-requests", "0"], label)
        if n0 or r0: bad.append("%s --max-requests 0: %d lần định gọi Google, %d dòng GOOGLE_REQUEST (phải 0 và 0)" % (label, n0, r0))
        n1, u1, r1 = attempt(argv, label)
        if n1 == 0: bad.append("(fixture) %s không giới hạn không định gọi Google: không đo được" % label)
        elif u1: bad.append("%s: %d/%d lần định gọi Google KHÔNG có GOOGLE_REQUEST in trước (sổ chi phải in trước khi gửi)" % (label, u1, n1))
    vp = os.path.join(sc, "output", "HCMC", "venue", "vendors.json"); doc = json.load(open(vp, encoding="utf-8")); done_ph = done_en = False
    for v in doc["vendors"]:
        if not done_ph and any(e.get("source") == "google_maps" and e.get("place_id") for e in (v.get("enrichment_log") or [])):
            v.pop("google_photos", None); done_ph = True; continue
    # một vendor venue chưa từng enrich để enrich đường cũ có việc: bỏ dấu vết google_maps + audit của vendor cuối
    last_v = doc["vendors"][-1]; last_v["enrichment_log"] = [e for e in (last_v.get("enrichment_log") or []) if e.get("source") != "google_maps"]
    for k in ("google_photos", "google_maps_place_id"): last_v.pop(k, None)
    json.dump(doc, open(vp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    for f in glob.glob(os.path.join(sc, "output", "HCMC", "venue", "enrichment-audit.json")): os.remove(f)
    base = ["refresh_photos.py", "--input", "output/HCMC/venue/vendors.json", "--max-photos", "2", "--min-age-days", "25"]
    n2, u2, r2 = attempt(base + ["--max-requests", "0"], "refresh_photos.py")
    if n2 or r2: bad.append("refresh_photos.py --max-requests 0: %d lần, %d dòng (phải 0 và 0)" % (n2, r2))
    n3, u3, r3 = attempt(base + ["--max-requests", "6"], "refresh_photos.py")
    if n3 == 0: bad.append("(fixture) refresh không định gọi Google")
    elif u3: bad.append("refresh_photos.py: %d/%d lần định gọi Google không có GOOGLE_REQUEST in trước" % (u3, n3))
    en = ["enrich.py", "--state", "HCMC", "--category", "venue", "--budget", "1.0"]
    n4, u4, r4 = attempt(en + ["--max-requests", "0"], "enrich.py")
    if n4 or r4: bad.append("enrich.py (đường cũ) --max-requests 0: %d lần, %d dòng (phải 0 và 0; tính cả ảnh của nó)" % (n4, r4))
    n5, u5, r5 = attempt(en + ["--max-requests", "2"], "enrich.py")
    if n5 == 0: bad.append("(fixture) enrich đường cũ không định gọi Google: không đo được")
    elif u5: bad.append("enrich.py: %d/%d lần định gọi Google không có GOOGLE_REQUEST in trước" % (u5, n5))
    elif n5 > 2: bad.append("enrich.py --max-requests 2 nhưng định gọi Google %d lần" % n5)
finally:
    os.environ.pop("NET_LOG", None); box.cleanup()
t.done(bad, "cổng hạn mức tính mọi request Google xấu nhất (resolve theo loại mục, enrich, ảnh), phần vượt chạy --max-requests 0 và job đỏ 'cần Capu duyệt chạy tay' sau khi áp phần không cần Google, chỉ đổi số sang B, dispatch tay không bị chặn, sổ chi in trước khi gửi ở cả bốn đường script")
