#!/usr/bin/env python3
"""T-136 tiêu chí 7: workflow đẩy file matcher lên bucket, CHẠY NGUYÊN VĂN từng bước `run:` của tohong-back/.github/workflows/sync-matcher-vendors.yml
(cách eval/T-127/adv-02, eval/T-134/adv-04): shell mặc định của runner `bash -e {0}` (không pipefail; khai `shell: bash` thì `-eo pipefail`), các bước theo thứ tự, bước lỗi chặn bước sau trừ khi
`if: always()/failure()`, `continue-on-error: true` ở bước được tôn trọng, ở cấp job bị cấm (kiểm YAML) (nên bắt được `|| true` / continue-on-error làm job xanh giả). gcloud / gsutil / curl / sleep là bản GIẢ trên PATH:
bucket giả = thư mục tạm, "revision" giả nạp file bucket khi `gcloud run services update|deploy`, /health giả trả pool_size của revision đang chạy. Không mạng, không Google, không ghi GCS.
Điều kiện theo hành vi (đường dẫn file staging cố định: matcher-data/vendors.json trong tohong-back; pool: lib/vendorPool.generated.js):
 (i) file khớp pool: xanh; prev == bản cũ; thứ tự lệnh: sao prev -> ghi đè vendors.json -> cập nhật revision (POOL_VERSION) -> health; bucket == file mới.
 (ii) id thừa / thiếu / mảng rỗng / JSON hỏng: đỏ, bucket không đổi byte nào, không lệnh ghi, không cập nhật revision.
 (iii) health lệch mọi lượt thử: đỏ (có thử lại >=2 lần, không treo); health lệch 1 lượt rồi đúng: xanh.
 (iv) ghi bucket bị 403: đỏ, bucket không đổi, không cập nhật revision, in dòng `gsutil iam ch serviceAccount:<email SA>:roles/storage.objectUser gs://wedding-planner-vendors`.
Phần đọc YAML (yaml.safe_load): push vào main + paths có matcher-data/vendors.json + workflow_dispatch; không pull_request*; permissions contents: read; concurrency; chỉ secret đã có;
đường dẫn staging KHÔNG khớp `on.push.paths` của deploy-matcher.yml. Thiếu tohong-back: PASS chưa áp dụng. Chỉ đọc repo. In PASS / FAIL <lý do>."""
import fnmatch, json, os, re, shutil, subprocess, sys, tempfile
import yaml
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if c and os.path.isfile(os.path.join(c, "matcher/match.py"))), None)
if not B: print("PASS chưa áp dụng (thiếu tohong-back)"); sys.exit(0)
WFP = os.path.join(B, ".github/workflows/sync-matcher-vendors.yml")
if not os.path.isfile(WFP): print("FAIL chưa có .github/workflows/sync-matcher-vendors.yml"); sys.exit(1)
STAGE = "matcher-data/vendors.json"; BUCKET = "wedding-planner-vendors"; SA = "sync@proj.iam.gserviceaccount.com"
def pm(pat, path):
    """khớp đường dẫn kiểu GitHub paths: ** = nhiều cấp, * = trong một cấp."""
    rx = re.escape(pat).replace(r"\*\*", "\0").replace(r"\*", "[^/]*").replace("\0", ".*")
    return re.fullmatch(rx, path) is not None
raw = open(WFP, encoding="utf-8").read(); wf = yaml.safe_load(raw); fails = []
def need(c, m):
    if not c: fails.append(m)
# ---- phần đọc YAML ----
on = wf.get("on", wf.get(True)) or {}
if isinstance(on, list): on = {k: {} for k in on}
push = (on.get("push") or {}) if isinstance(on, dict) else {}
br = push.get("branches") or []; br = [br] if isinstance(br, str) else br
need("main" in br, "phải chạy khi push vào main")
need(any(pm(x, STAGE) for x in (push.get("paths") or [])), f"on.push.paths phải khớp {STAGE} (chạy khi PR pool merge, không chạy mọi push); chấp nhận chuỗi đúng hoặc glob như matcher-data/**")
need("workflow_dispatch" in on, "phải có workflow_dispatch")
need(not any(str(k).startswith("pull_request") for k in on), "không được chạy theo pull_request*")
need(not any(j.get("continue-on-error") for j in (wf.get("jobs") or {}).values()), "không job nào được có continue-on-error (cả lượt chạy sẽ xanh dù bước lỗi)")
jobs = wf.get("jobs") or {}
perm = [wf.get("permissions")] + [j.get("permissions") for j in jobs.values()]
need(any(p == {"contents": "read"} for p in perm), "permissions: contents: read")
need(wf.get("concurrency") or all(j.get("concurrency") for j in jobs.values()), "phải có concurrency")
used = set(re.findall(r"secrets\.([A-Za-z0-9_]+)", raw)); allowed = {"GCP_SA_KEY", "GCP_PROJECT_ID", "MATCHER_URL", "MATCHER_API_KEY", "GITHUB_TOKEN"}
need(used <= allowed, f"chỉ dùng secret đã có, thấy thêm {sorted(used - allowed)}"); need("GCP_SA_KEY" in used, "phải dùng GCP_SA_KEY")
dm = os.path.join(B, ".github/workflows/deploy-matcher.yml")
if os.path.isfile(dm):
    d = yaml.safe_load(open(dm, encoding="utf-8")); don = d.get("on", d.get(True)) or {}
    for pat in (don.get("push") or {}).get("paths") or []:
        hit = pm(pat, STAGE)
        need(not hit, f"{STAGE} khớp on.push.paths '{pat}' của deploy-matcher.yml: PR pool sẽ chạy cả deploy-matcher")
if fails: print("FAIL " + "; ".join(fails)); sys.exit(1)
# ---- chạy thật các bước run: ----
FAKE = r'''#!/usr/bin/env python3
import json, os, shutil, sys
st = os.environ["FAKE_STATE"]; bk = os.path.join(st, "bucket"); tool = os.path.basename(sys.argv[0]); a = sys.argv[1:]
open(os.path.join(st, "calls.log"), "a").write(json.dumps([tool] + a) + "\n")
SA = "''' + SA + r'''"
def objpath(p):
    b, _, o = p[5:].partition("/"); return os.path.join(bk, b, o)
def pos(args): return [x for x in args if not x.startswith("-")]
def size_of(path):
    try:
        d = json.load(open(path, encoding="utf-8")); return len(d["vendors"] if isinstance(d, dict) else d)
    except Exception: return -1
def deny():
    sys.stderr.write("AccessDeniedException: 403 %s does not have storage.objects.create access to the Google Cloud Storage object.\n" % SA); sys.exit(1)
if tool == "curl":
    url = next((x for x in a if x.startswith("http")), "")
    n = int(open(os.path.join(st, "health_n")).read()) if os.path.exists(os.path.join(st, "health_n")) else 0
    rev = os.path.join(st, "revision.json"); size = json.load(open(rev))["pool_size"]
    if url.endswith("/health"):
        open(os.path.join(st, "health_n"), "w").write(str(n + 1))
        if os.environ.get("FAKE_HEALTH_FORCE"): size = int(os.environ["FAKE_HEALTH_FORCE"])
        elif n < int(os.environ.get("FAKE_HEALTH_STALE_CALLS", "0")): size = json.load(open(os.path.join(st, "revision_old.json")))["pool_size"]
        body = json.dumps({"status": "ok", "pool_size": size, "active_size": size, "verified_size": 0, "demo_pool": False})
    else: body = json.dumps({"ok": True, "vendor_count": size, "total": size})
    if "-o" in a: open(a[a.index("-o") + 1], "w").write(body)
    else: print(body)
    sys.exit(0)
if tool == "gcloud" and a[:1] == ["storage"]: a = a[1:]; tool = "gsutil"
if tool == "gsutil":
    cmd, rest = a[0], pos(a[1:])
    if cmd == "cp":
        src, dst = rest[0], rest[1]
        if dst.startswith("gs://") and os.environ.get("FAKE_DENY_WRITE"): deny()
        if src.startswith("gs://"):
            if not os.path.exists(objpath(src)): sys.stderr.write("CommandException: No URLs matched: %s\n" % src); sys.exit(1)
            data = open(objpath(src), "rb").read()
        else: data = open(src, "rb").read()
        if dst.startswith("gs://"): os.makedirs(os.path.dirname(objpath(dst)), exist_ok=True); open(objpath(dst), "wb").write(data)
        else: open(dst, "wb").write(data)
        sys.exit(0)
    if cmd in ("ls", "stat", "cat", "du"):
        p = objpath(rest[0]) if rest else bk
        if not os.path.exists(p): sys.stderr.write("CommandException: One or more URLs matched no objects.\n"); sys.exit(1)
        if cmd == "cat": sys.stdout.write(open(p, encoding="utf-8").read())
        else: print(rest[0])
        sys.exit(0)
    if cmd in ("mv", "rm", "rsync", "setmeta", "iam"):
        if os.environ.get("FAKE_DENY_WRITE"): deny()
        if cmd == "mv": os.makedirs(os.path.dirname(objpath(rest[1])), exist_ok=True); shutil.move(objpath(rest[0]), objpath(rest[1]))
        sys.exit(0)
    sys.stderr.write("fake gsutil: lệnh chưa giả lập: %s\n" % a); sys.exit(2)
if tool == "gcloud":
    if a[:1] == ["run"] and a[1:2] == ["services"] and a[2:3] in (["update"], ["deploy"]):
        if os.environ.get("FAKE_DENY_WRITE"): deny()
        rev = os.path.join(st, "revision.json"); shutil.copy(rev, os.path.join(st, "revision_old.json")) if not os.path.exists(os.path.join(st, "revision_old.json")) else None
        json.dump({"pool_size": size_of(os.path.join(bk, "''' + BUCKET + r'''", "vendors.json")), "args": a}, open(rev, "w")); sys.exit(0)
    if a[:1] == ["run"] and "describe" in a: print("https://matcher.test"); sys.exit(0)
    if a[:2] == ["config", "get-value"] or a[:2] == ["auth", "list"]: print(SA); sys.exit(0)
    if a[:1] in (["auth"], ["config"], ["components"], ["info"]): sys.exit(0)
    sys.stderr.write("fake gcloud: lệnh chưa giả lập: %s\n" % a); sys.exit(2)
'''
def vend(ids): return json.dumps({"vendors": [{"id": i, "categories": ["photography"], "verification_status": "auto_scraped"} for i in ids]}, indent=1).encode()
POOL_IDS = ["marry_aaaaaaaaaaa1", "marry_aaaaaaaaaaa2", "marry_aaaaaaaaaaa3"]
OLD = vend(["marry_photography_old-slug"])
def run_case(file_bytes, extra=None):
    T = tempfile.mkdtemp(prefix="t136-b4-"); ws = os.path.join(T, "ws"); st = os.path.join(T, "st"); bn = os.path.join(T, "bin")
    shutil.copytree(B, ws, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"))
    shutil.copy(os.path.join(HERE, "fixtures", "pool_ok.js"), os.path.join(ws, "lib", "vendorPool.generated.js"))
    os.makedirs(os.path.join(ws, "matcher-data"), exist_ok=True); open(os.path.join(ws, STAGE), "wb").write(file_bytes)
    os.makedirs(os.path.join(st, "bucket", BUCKET)); open(os.path.join(st, "bucket", BUCKET, "vendors.json"), "wb").write(OLD)
    json.dump({"pool_size": 1}, open(os.path.join(st, "revision.json"), "w")); open(os.path.join(st, "calls.log"), "w").close()
    os.makedirs(bn)
    for n in ("gcloud", "gsutil", "curl"): open(os.path.join(bn, n), "w").write(FAKE); os.chmod(os.path.join(bn, n), 0o755)
    open(os.path.join(bn, "sleep"), "w").write("#!/bin/sh\nexit 0\n"); os.chmod(os.path.join(bn, "sleep"), 0o755)
    secrets = {"GCP_SA_KEY": json.dumps({"type": "service_account", "client_email": SA}), "GCP_PROJECT_ID": "proj-test", "MATCHER_URL": "https://matcher.test", "MATCHER_API_KEY": "k-test", "GITHUB_TOKEN": "gh-test"}
    genv = {"PATH": bn + ":/usr/local/bin:/usr/bin:/bin", "HOME": T, "FAKE_STATE": st, "GITHUB_WORKSPACE": ws, "GITHUB_SHA": "abc1234def", "GITHUB_RUN_ID": "1", "GITHUB_REPOSITORY": "phungrk/tohong-back",
            "GITHUB_OUTPUT": os.path.join(T, "out"), "GITHUB_ENV": os.path.join(T, "genv"), "GITHUB_STEP_SUMMARY": os.path.join(T, "sum"), "RUNNER_TEMP": T, "CI": "true", "GITHUB_ACTIONS": "true", **(extra or {})}
    for f in ("out", "genv", "sum"): open(os.path.join(T, f), "w").close()
    outputs = {}
    def val(e, env):
        e = e.strip()
        if e.startswith("secrets."): return secrets.get(e[8:], "")
        if e == "github.sha": return "abc1234def"
        if e in ("github.run_id", "github.run_number"): return "1"
        if e == "github.workspace": return ws
        if e == "github.repository": return "phungrk/tohong-back"
        if e.startswith("env."): return env.get(e[4:], "")
        GH = {"event_name": "push", "ref": "refs/heads/main", "ref_name": "main", "run_attempt": "1", "actor": "capu", "repository_owner": "phungrk", "server_url": "https://github.com", "job": "sync", "workflow": "sync-matcher-vendors", "run_number": "1"}
        if e.startswith("github."): return GH.get(e[7:], "")
        if e.startswith("runner."): return {"os": "Linux", "temp": T}.get(e[7:], "")
        if e.startswith("vars."): return ""
        m = re.match(r"steps\.([\w-]+)\.outputs\.(\w+)$", e)
        if m: return outputs.get((m.group(1), m.group(2)), "")
        raise ValueError("biểu thức chưa giả lập: ${{ %s }}" % e)
    sub = lambda s, env: re.sub(r"\$\{\{\s*(.*?)\s*\}\}", lambda m: str(val(m.group(1), env)), str(s))
    outcomes = {}
    def cond_ok(c, failed, env, outcomes):
        """đánh giá `if:` cơ bản: always() failure() success() cancelled(), && || !, ==, !=, github.* env.* steps.<id>.outcome|conclusion, chuỗi/true/false. Không có hàm trạng thái thì ngầm success() &&."""
        if c is None or str(c).strip() == "": return not failed
        e = str(c).strip()
        if e.startswith("${{") and e.endswith("}}"): e = e[3:-2].strip()
        has_status = re.search(r"\b(always|failure|success|cancelled)\(\)", e) is not None
        def atom(m):
            t = m.group(0)
            if t == "always()": return "True"
            if t == "failure()": return repr(failed)
            if t == "success()": return repr(not failed)
            if t == "cancelled()": return "False"
            if t in ("true", "false"): return t.capitalize()
            mm = re.match(r"steps\.([\w-]+)\.(outcome|conclusion)$", t)
            if mm: return repr(outcomes.get((mm.group(1), mm.group(2)), "skipped"))
            return repr(val(t, env))
        try:
            py = re.sub(r"always\(\)|failure\(\)|success\(\)|cancelled\(\)|\b(?:github|env|vars|runner|secrets)\.[\w.]+|steps\.[\w-]+\.(?:outcome|conclusion)|\btrue\b|\bfalse\b", atom, e)
            py = py.replace("&&", " and ").replace("||", " or "); py = re.sub(r"!(?!=)", " not ", py)
            ok = bool(eval(py, {"__builtins__": {}}, {"True": True, "False": False}))
        except Exception: return not failed
        return ok if has_status else (ok and not failed)
    log, failed, red = [], False, False
    env = dict(genv); env.update({k: sub(v, env) for k, v in (wf.get("env") or {}).items()})
    steps = []
    for j in jobs.values():
        jenv = {k: sub(v, env) for k, v in (j.get("env") or {}).items()}; env.update(jenv)
        for s in j.get("steps") or []: steps.append((s, (j.get("defaults") or {}).get("run", {}).get("shell") or (wf.get("defaults") or {}).get("run", {}).get("shell")))
    for s, dshell in steps:
        runs = cond_ok(s.get("if"), failed, env, outcomes)
        if not runs: continue
        if "uses" in s:
            continue   # mọi bước `uses:` (checkout, setup-node, auth, setup-gcloud, ...) là no-op: workspace đã có code; tác dụng lên bucket chỉ qua gcloud/gsutil giả (một action ghi bucket kiểu khác sẽ làm ca (i) FAIL)
        shell = s.get("shell") or dshell
        argv = ["bash", "-e"] if not shell else (["bash", "--noprofile", "--norc", "-eo", "pipefail"] if shell == "bash" else None)
        if argv is None: return {"err": "shell chưa giả lập: " + str(shell)}
        senv = dict(env)
        try:
            for k, v in (s.get("env") or {}).items(): senv[k] = sub(v, senv)
            script = sub(s.get("run", ""), senv)
        except ValueError as e: return {"err": str(e)}
        sf = os.path.join(T, "step.sh"); open(sf, "w", encoding="utf-8").write(script)
        wd = os.path.join(ws, s["working-directory"]) if s.get("working-directory") else ws
        try: p = subprocess.run(argv + [sf], cwd=wd, env=senv, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired: return {"err": "bước '%s' treo quá 60 giây (vòng thử lại không có giới hạn?)" % (s.get("name") or s.get("id") or "?")}
        log.append(p.stdout + p.stderr)
        for line in open(os.path.join(T, "genv"), encoding="utf-8").read().splitlines():
            if "=" in line: k, _, v = line.partition("="); env[k] = v
        for line in open(os.path.join(T, "out"), encoding="utf-8").read().splitlines():
            if "=" in line: k, _, v = line.partition("="); outputs[(s.get("id", ""), k)] = v
        if s.get("id"): outcomes[(s["id"], "outcome")] = "success" if p.returncode == 0 else "failure"; outcomes[(s["id"], "conclusion")] = "success" if (p.returncode == 0 or s.get("continue-on-error")) else "failure"
        if p.returncode != 0 and not s.get("continue-on-error"): failed = red = True
    calls = [json.loads(l) for l in open(os.path.join(st, "calls.log")) if l.strip()]
    bucket = {}
    for r, _, fs in os.walk(os.path.join(st, "bucket")):
        for f in fs: bucket[os.path.relpath(os.path.join(r, f), os.path.join(st, "bucket"))] = open(os.path.join(r, f), "rb").read()
    shutil.rmtree(T, ignore_errors=True)
    return {"red": red, "calls": calls, "bucket": bucket, "out": "\n".join(log)}
is_write = lambda c: (c[0] in ("gsutil", "gcloud") and ((c[1:2] == ["storage"] and c[2:3] in (["cp"], ["mv"], ["rm"])) or c[1:2] in (["cp"], ["mv"], ["rm"]))) and any(x.startswith("gs://") for x in c[1:])
is_rev = lambda c: c[0] == "gcloud" and c[1:4] in (["run", "services", "update"], ["run", "services", "deploy"])
is_hl = lambda c: c[0] == "curl" and any(x.endswith("/health") for x in c)
key = BUCKET + "/vendors.json"; pkey = BUCKET + "/vendors.prev.json"
good = vend(POOL_IDS)
# (i)
r = run_case(good)
if "err" in r: print("FAIL (i) " + r["err"]); sys.exit(1)
if r["red"]: print("FAIL (i) file khớp pool mà workflow đỏ:", r["out"][-300:].replace("\n", " ")); sys.exit(1)
if r["bucket"].get(key) != good: print("FAIL (i) bucket vendors.json không phải file mới"); sys.exit(1)
if r["bucket"].get(pkey) != OLD: print("FAIL (i) vendors.prev.json phải là BẢN CŨ (sao trước khi ghi đè)"); sys.exit(1)
ix = lambda pred: next((i for i, c in enumerate(r["calls"]) if pred(c)), -1)
i_prev = ix(lambda c: is_write(c) and any("vendors.prev.json" in x for x in c)); i_up = ix(lambda c: is_write(c) and not any("prev" in x for x in c) and any(x.endswith(BUCKET + "/vendors.json") for x in c))
i_rev = ix(is_rev); i_h = next((i for i, c in enumerate(r["calls"]) if is_hl(c) and i > i_rev >= 0), -1) if i_rev >= 0 else -1
if not (0 <= i_prev < i_up < i_rev < i_h): print(f"FAIL (i) thứ tự lệnh phải là sao prev < ghi đè < cập nhật revision < health (thấy {i_prev},{i_up},{i_rev},{i_h})"); sys.exit(1)
if "POOL_VERSION" not in json.dumps(r["calls"][i_rev]): print("FAIL (i) cập nhật revision phải đặt POOL_VERSION (để mọi instance nạp lại)"); sys.exit(1)
# (ii)
bad = {"id thừa": vend(POOL_IDS + ["marry_zzzzzzzzzzzz"]), "id thiếu": vend(POOL_IDS[:2]), "id khác, cùng số lượng": vend(POOL_IDS[:2] + ["marry_zzzzzzzzzzzz"]), "mảng rỗng": vend([]), "JSON hỏng": b'{"vendors": [', "không có khoá vendors": b'{"x":1}'}
for label, fb in bad.items():
    r = run_case(fb)
    if "err" in r: print(f"FAIL (ii {label}) " + r["err"]); sys.exit(1)
    if not r["red"]: print(f"FAIL (ii {label}) file lệch pool mà workflow XANH"); sys.exit(1)
    if r["bucket"] != {key: OLD}: print(f"FAIL (ii {label}) bucket bị đổi dù file lệch pool: {sorted(r['bucket'])}"); sys.exit(1)
    if any(is_write(c) or is_rev(c) for c in r["calls"]): print(f"FAIL (ii {label}) đã gọi lệnh ghi / cập nhật revision dù file lệch pool"); sys.exit(1)
# (iii)
r = run_case(good, {"FAKE_HEALTH_FORCE": "999"})
if "err" in r: print("FAIL (iii) " + r["err"]); sys.exit(1)
if not r["red"]: print("FAIL (iii) health luôn lệch pool_size mà workflow XANH"); sys.exit(1)
if sum(1 for c in r["calls"] if is_hl(c)) < 2: print("FAIL (iii) phải thử lại /health ít nhất 2 lần trước khi đỏ"); sys.exit(1)
r = run_case(good, {"FAKE_HEALTH_STALE_CALLS": "1"})
if "err" in r: print("FAIL (iii-b) " + r["err"]); sys.exit(1)
if r["red"] or sum(1 for c in r["calls"] if is_hl(c)) < 2: print("FAIL (iii-b) health lệch 1 lượt rồi đúng: phải thử lại và xanh"); sys.exit(1)
# (iv)
r = run_case(good, {"FAKE_DENY_WRITE": "1"})
if "err" in r: print("FAIL (iv) " + r["err"]); sys.exit(1)
if not r["red"]: print("FAIL (iv) ghi bucket 403 mà workflow XANH"); sys.exit(1)
if r["bucket"] != {key: OLD}: print("FAIL (iv) bucket đổi dù ghi bị từ chối"); sys.exit(1)
if any(is_rev(c) for c in r["calls"]): print("FAIL (iv) vẫn cập nhật revision sau khi ghi bị từ chối"); sys.exit(1)
if f"gsutil iam ch serviceAccount:{SA}:roles/storage.objectUser gs://{BUCKET}" not in r["out"]: print("FAIL (iv) thiếu dòng hướng dẫn `gsutil iam ch serviceAccount:<email SA>:roles/storage.objectUser gs://" + BUCKET + "`"); sys.exit(1)
print("PASS")
