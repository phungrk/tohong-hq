#!/usr/bin/env python3
"""T-135 tiêu chí 10 (repo tohong; quyết định tiền, phương án A của Capu hoặc mặc định khi Capu chưa trả lời, hồ sơ inbox/capu/T-135-tran-chi-google-tu-dong.md):
đường TỰ ĐỘNG chỉ gọi Google khi cả lô nằm trong hạn mức miễn phí của tháng (chi thật $0); vượt thì dừng TRƯỚC Google và ghi "cần Capu duyệt chạy tay" kèm số tiền ước tính.
Số liệu là THAM SỐ trong `tools/scraper/auto_resolve_limits.json` (mặc định phương án A: max_net_usd_batch=0, max_net_usd_month=0, enrich_max_requests=2, refresh_max_requests=6); Capu chọn phương án B thì chỉ đổi số (2 và 10).
Ước tính: resolve = mỗi mục accept_place chưa `resolved` 1 Place Details, cộng (xấu nhất, nếu phải --suggest) 1 Text Search mỗi mục; enrich và ảnh = phần của lô theo trần tham số; chi net tính bằng usage.py (net_usd, hạn mức 1000/SKU, biên 50), cộng số đã dùng trong tháng (usage-baseline.json + log run-logs).
Chạy NGUYÊN VĂN job resolve-overrides trên bản sao git của repo thật, sự kiện pull_request merged. Tình huống:
  (1) lô 15 mục chưa resolve + đã dùng 990 ảnh trong tháng, tham số A -> bước "Cổng: hạn mức…" ĐỎ, 0 lần gọi script Google, 0 lần thử kết nối, log có BATCH_ESTIMATE (requests=30), "cần Capu duyệt chạy tay" và số tiền ước tính > 0, Summary ghi cùng nội dung; mọi bước "Google:" skipped;
  (2) lô không có mục nào cần Google, tháng đã vượt hạn mức -> cổng QUA (không request thì không tốn), resolve chạy với --max-requests 0;
  (3) lô 15 mục, tháng còn trống -> cổng QUA, mọi script Google nhận --max-requests (resolve = requests của cổng, enrich = enrich_max_requests, ảnh = refresh_max_requests);
  (4) CHỈ ĐỔI SỐ sang phương án B (2 và 10) trên lô (1) -> cổng QUA; lô làm tổng net tháng vượt 10 -> ĐỎ trước Google;
  (5) Capu bấm tay (workflow_dispatch dry_run=false) cùng lô (1) -> cổng KHÔNG chặn (cú bấm là duyệt), vẫn có --max-requests ở mọi script Google.
Mọi bước Google đi qua sổ chi (chạy thật từng script, mạng bị chặn và ghi lại mỗi lần thử): resolve_overrides.py và refresh_photos.py với --max-requests 0 thử 0 lần kết nối và 0 dòng GOOGLE_REQUEST;
  không giới hạn thì mỗi lần thử kết nối đều có dòng `GOOGLE_REQUEST` in TRƯỚC (số dòng >= số lần thử, sổ chi đếm cả request lỗi); enrich.py --help có --max-requests.
Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None or "pull_request" not in t.on_of(wf):
    print("FAIL resolve-overrides.yml chưa có kích hoạt tự động (tiêu chí 1)"); sys.exit(1)
JOB = next(iter(wf["jobs"]))
LIM = os.path.join(t.TOHONG, "tools", "scraper", "auto_resolve_limits.json")
bad = []
if not os.path.isfile(LIM):
    t.done(["thiếu tools/scraper/auto_resolve_limits.json (nguồn tham số hạn mức)"], "")
lim = json.load(open(LIM))
for k, v in (("max_net_usd_batch", 0), ("max_net_usd_month", 0), ("enrich_max_requests", 2), ("refresh_max_requests", 6)):
    if lim.get(k) != v: bad.append("auto_resolve_limits.json: %s = %r, mặc định phương án A là %r" % (k, lim.get(k), v))
GOOGLE = re.compile(r"(resolve_overrides|enrich|refresh_photos)\.py")
def google_calls(box):
    return [a for _, a in box.py_calls() if GOOGLE.search(a) and not re.search(r"--(dry-run|probe|apply-review-rule)", a)]
def flag(a, name):
    m = re.search(r"%s\s+['\"]?(\d+)" % re.escape(name), a)
    return int(m.group(1)) if m else None
box = t.Box(t.TOHONG)
try:
    t.mutate_fixture_overrides(box, 2)
    ids15 = t.add_unresolved(box, 15)
    BASE = box.ws
    def run(event="pull_request", inputs=None, ev_=None):
        box.reset(); box.gh_db({"prs": [], "runs": {}})
        c = t.gh_ctx(box, event, event=ev_ if ev_ is not None else t.pr_event(), inputs=inputs, vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets={"GOOGLE_MAPS_API_KEY": "fake-key-not-real"})
        res = t.run_job(box, wf, JOB, c, uses={"actions/": lambda w, s: {}, "peter-evans/": lambda w, s: {}})
        return res
    quota = lambda res: next(((n, o) for n, o in res["order"] if n.startswith("Cổng: hạn mức")), None)
    summary = lambda: open(os.path.join(box.log, "summary.txt"), encoding="utf-8").read() if os.path.isfile(os.path.join(box.log, "summary.txt")) else ""
    # (1)
    t.set_baseline(box, 0, 990)
    res = run()
    q = quota(res)
    if q is None: bad.append("(1) thiếu bước 'Cổng: hạn mức…' trong job")
    else:
        if q[1] != "failure": bad.append("(1) lô vượt hạn mức: cổng phải ĐỎ, thấy %s" % q[1])
        if google_calls(box): bad.append("(1) vẫn gọi script Google: %s" % [a[:60] for a in google_calls(box)])
        if any(o != "skipped" for n, o in res["order"] if n.startswith("Google:")): bad.append("(1) có bước Google không bị skip")
        lg = res["log"]
        m = re.search(r"BATCH_ESTIMATE\b[^\n]*requests=(\d+)", lg)
        if not m or int(m.group(1)) != 30: bad.append("(1) log thiếu BATCH_ESTIMATE requests=30 (15 mục x (1 Details + 1 Search xấu nhất)); thấy %r" % (m.group(0)[:60] if m else None))
        money = re.search(r"cần Capu duyệt chạy tay[^\n]*\$\s*(\d+(?:[.,]\d+)?)", lg)
        if "cần Capu duyệt chạy tay" not in lg or not money or float(money.group(1).replace(",", ".")) <= 0: bad.append("(1) log phải ghi 'cần Capu duyệt chạy tay' kèm số tiền ước tính > 0")
        if "cần Capu duyệt chạy tay" not in summary(): bad.append("(1) Summary phải ghi 'cần Capu duyệt chạy tay'")
    # (2)
    mo = os.path.join(box.ws, "tools", "scraper", "output", "HCMC", "manual_overrides.json")
    d = json.load(open(mo)); d["overrides"] = [e for e in d["overrides"] if e["vendor_id"] not in ids15]; json.dump(d, open(mo, "w"), ensure_ascii=False, indent=2)
    t.set_baseline(box, 0, 1040)
    res = run()
    q = quota(res)
    if q is None or q[1] != "success": bad.append("(2) lô không cần Google: cổng phải QUA dù tháng đã vượt: %s" % (q,))
    rc = [a for a in google_calls(box) if "resolve_overrides.py" in a]
    if rc and flag(rc[0], "--max-requests") != 0: bad.append("(2) lô 0 request: resolve phải nhận --max-requests 0; thấy %s" % rc[0][:90])
    # (3)
    t.add_unresolved(box, 15); t.set_baseline(box, 0, 0)
    res = run()
    q = quota(res); calls = google_calls(box)
    if q is None or q[1] != "success": bad.append("(3) lô nằm trong hạn mức: cổng phải QUA: %s %s" % (q, res["log"][-300:]))
    for a in calls:
        v = flag(a, "--max-requests")
        if v is None: bad.append("(3) script Google thiếu --max-requests: %s" % a[:90])
        elif "resolve_overrides.py" in a and v > 30: bad.append("(3) resolve --max-requests %d > requests của cổng (30)" % v)
        elif "enrich.py" in a and v > lim["enrich_max_requests"]: bad.append("(3) enrich --max-requests %d > enrich_max_requests" % v)
        elif "refresh_photos.py" in a and v > lim["refresh_max_requests"]: bad.append("(3) refresh --max-requests %d > refresh_max_requests" % v)
    if not any("resolve_overrides.py" in a for a in calls): bad.append("(3) resolve không được chạy khi cổng qua")
    # (4) chỉ đổi số
    t.set_baseline(box, 0, 990); t.set_limits(box, max_net_usd_batch=2, max_net_usd_month=10)
    res = run(); q = quota(res)
    if q is None or q[1] != "success": bad.append("(4) phương án B (chỉ đổi số): lô 15 phải QUA cổng: %s" % (q,))
    t.set_baseline(box, 1300, 0)
    res = run(); q = quota(res)
    if q is None or q[1] != "failure" or google_calls(box): bad.append("(4) phương án B: tháng đã net > $10 thì cổng phải ĐỎ trước Google")
    t.set_limits(box, max_net_usd_batch=0, max_net_usd_month=0)
    # (5) dispatch tay
    t.set_baseline(box, 0, 990)
    res = run(event="workflow_dispatch", inputs={"dry_run": "false"}, ev_={})
    q = quota(res)
    if q is not None and q[1] == "failure": bad.append("(5) Capu bấm tay (dry_run=false) không được bị cổng hạn mức chặn")
    if not any("resolve_overrides.py" in a and flag(a, "--max-requests") is not None for a in google_calls(box)): bad.append("(5) dispatch tay: resolve phải chạy và có --max-requests")
    # sổ chi trên từng script (mạng bị chặn có ghi lại)
    box.reset()
    sc = os.path.join(box.ws, "tools", "scraper")
    nl = os.path.join(box.tmp, "net.log")
    env = dict(os.environ, PYTHONPATH=os.path.join(t.HERE, "lib_nonet_log"), NET_LOG=nl, PYTHONDONTWRITEBYTECODE="1", GOOGLE_MAPS_API_KEY="fake-key-not-real", GITHUB_RUN_ID="4242")
    def attempt(argv):
        if os.path.exists(nl): os.remove(nl)
        p = subprocess.run([sys.executable] + argv, cwd=sc, env=env, capture_output=True, text=True, timeout=300)
        n = len(open(nl).read().split()) if os.path.exists(nl) else 0
        return n, (p.stdout or "").count("GOOGLE_REQUEST"), p
    t.set_baseline(box, 0, 0)
    pv = next(v for v in json.load(open(os.path.join(sc, "output", "HCMC", "manual_overrides.json")))["overrides"] if v["action"] == "accept_place" and not v.get("resolved"))
    n0, r0, p0 = attempt(["resolve_overrides.py", "--state", "HCMC", "--max-requests", "0"])
    if "unrecognized arguments" in p0.stderr: bad.append("resolve_overrides.py chưa có --max-requests")
    elif n0 or r0: bad.append("resolve_overrides.py --max-requests 0: thử %d kết nối, %d dòng GOOGLE_REQUEST (phải 0 và 0)" % (n0, r0))
    n1, r1, _ = attempt(["resolve_overrides.py", "--state", "HCMC"])
    if n1 == 0: bad.append("(fixture) resolve không giới hạn không thử kết nối: không đo được sổ chi")
    elif r1 < n1: bad.append("resolve_overrides.py: %d lần thử kết nối nhưng chỉ %d dòng GOOGLE_REQUEST in trước (mọi request phải qua sổ chi, in TRƯỚC khi gửi)" % (n1, r1))
    vp = os.path.join(sc, "output", "HCMC", "venue", "vendors.json"); doc = json.load(open(vp, encoding="utf-8"))
    for v in doc["vendors"]:
        if any(e.get("source") == "google_maps" and e.get("place_id") for e in (v.get("enrichment_log") or [])):
            v.pop("google_photos", None)
            break
    json.dump(doc, open(vp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    base = ["refresh_photos.py", "--input", "output/HCMC/venue/vendors.json", "--max-photos", "2", "--min-age-days", "25"]
    n2, r2, _ = attempt(base + ["--max-requests", "0"])
    if n2 or r2: bad.append("refresh_photos.py --max-requests 0: thử %d kết nối, %d dòng GOOGLE_REQUEST (phải 0 và 0)" % (n2, r2))
    n3, r3, _ = attempt(base + ["--max-requests", "6"])
    if n3 == 0: bad.append("(fixture) refresh không thử kết nối: không đo được")
    elif r3 < n3: bad.append("refresh_photos.py: %d lần thử kết nối, %d dòng GOOGLE_REQUEST in trước (phải >=)" % (n3, r3))
    h = subprocess.run([sys.executable, "enrich.py", "--help"], cwd=sc, env=env, capture_output=True, text=True).stdout
    if "--max-requests" not in h: bad.append("enrich.py chưa có --max-requests")
finally:
    box.cleanup()
t.done(bad, "đường tự động dừng trước Google khi lô vượt hạn mức miễn phí (ghi 'cần Capu duyệt chạy tay' + tiền), lô 0 request qua, chỉ đổi số sang phương án B, dispatch tay không bị chặn, mọi script Google có --max-requests và ghi GOOGLE_REQUEST trước khi gửi")
