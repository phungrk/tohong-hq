"""Khung dùng chung cho eval T-135 (và T-133): mô phỏng runner GitHub Actions ĐỦ TRUNG THỰC để chạy NGUYÊN VĂN các bước `run:` của workflow thật.
Bài học T-118/T-119/T-127/T-134: không đọc YAML rồi tin; chạy từng bước bằng cùng shell (`bash -e` hoặc `bash -eo pipefail` khi workflow khai shell bash), cùng thư mục
(defaults.run.working-directory), env đã thay `${{ }}`, `if:` đánh giá bằng bộ đánh giá biểu thức GitHub (so sánh lỏng, always()/failure()), outputs của bước, continue-on-error.
Giả lập (không thay đổi hợp đồng của chúng):
  - `gh` giả: đọc JSON ($FAKE_GH_DB), ghi mọi lệnh gọi (kể cả GH_TOKEN) vào $FAKE_LOG/gh.jsonl; như gh thật, KHÔNG có -R/--repo/GH_REPO và cwd không phải repo git thì thoát 1
    ("failed to run git: not a git repository", INV-031); `gh workflow run` không có token thì thoát 4.
  - `python`/`python3` giả chỉ ghi argv rồi chạy python thật; mạng bị chặn bằng sitecustomize (mọi kết nối ném OSError) nên không thể gọi Google; `npm`, `pip` ghi lại rồi thoát 0; `curl` thoát 7.
  - `uses:` actions/checkout, setup-*, cache, upload-artifact không làm gì (bản sao đã ở đúng nhánh); `peter-evans/create-pull-request@v6` mô hình hoá THEO HỢP ĐỒNG: tạo nhánh `branch` từ `base`
    chỉ chứa thay đổi khớp `add-paths`, commit `commit-message`, trả outputs pull-request-number/head-sha/operation/branch; không còn thay đổi thì operation=none.
Không mạng, không Google. Repo: TOHONG_REPO / TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back cạnh tohong-hq."""
import json, os, re, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
try:
    import yaml
except ImportError:  # pragma: no cover
    print("FAIL thiếu PyYAML"); sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
_d = HERE
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
HQ = _d


def _find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)):
            return os.path.abspath(c)


TOHONG = _find("TOHONG_REPO", os.path.join("tools", "scraper", "enrich.py"), "tohong")
BACK = _find("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")
NONET = os.path.join(HQ, "eval", "T-124", "lib", "nonet_sitecustomize.py")
INV_IMAGES = os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images")
REPORT_REL = "tools/scraper/output/HCMC/enrich-report.json"
MO_REL = "tools/scraper/output/HCMC/manual_overrides.json"
BACK_REPO_NAME = "phungrk/tohong-back"
POOL_WF = "sync-vendor-pool.yml"


def done(bad, ok_msg):
    if bad:
        print("FAIL " + bad[0] + (" (+%d lỗi nữa: %s)" % (len(bad) - 1, "; ".join(x[:70] for x in bad[1:3])) if len(bad) > 1 else ""))
        sys.exit(1)
    print("PASS " + ok_msg)
    sys.exit(0)


def need_repos(back=False):
    if not TOHONG or (back and not BACK):
        print("PASS chưa áp dụng (không thấy repo tohong%s)" % (" / tohong-back" if back else "")); sys.exit(0)


def load_wf(repo, name):
    p = os.path.join(repo, ".github", "workflows", name)
    if not os.path.isfile(p):
        return None, None
    raw = open(p, encoding="utf-8").read()
    return raw, (yaml.safe_load(raw) or {})


def on_of(wf):
    on = wf.get("on", wf.get(True))
    if isinstance(on, str):
        return {on: {}}
    if isinstance(on, list):
        return {k: {} for k in on}
    return on or {}


# ---------------------------------------------------------------- biểu thức GitHub
class _P:
    def __init__(self, s, ctx):
        self.t = re.findall(r"'(?:[^']|'')*'|\|\||&&|==|!=|<=|>=|[()!<>,]|[A-Za-z_][\w\-]*(?:\.[\w\-*]+)*|\d+(?:\.\d+)?", s)
        self.i, self.ctx = 0, ctx

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def eat(self):
        v = self.peek(); self.i += 1; return v

    def parse(self):
        v = self.or_()
        if self.peek() is not None:
            raise ValueError("biểu thức dư: %r" % self.peek())
        return v

    def or_(self):
        v = self.and_()
        while self.peek() == "||":
            self.eat(); r = self.and_(); v = v if _truthy(v) else r
        return v

    def and_(self):
        v = self.eq()
        while self.peek() == "&&":
            self.eat(); r = self.eq(); v = r if _truthy(v) else v
        return v

    def eq(self):
        v = self.un()
        while self.peek() in ("==", "!=", "<", ">", "<=", ">="):
            op = self.eat(); r = self.un(); v = _cmp(op, v, r)
        return v

    def un(self):
        if self.peek() == "!":
            self.eat(); return not _truthy(self.un())
        return self.pri()

    def pri(self):
        t = self.eat()
        if t is None:
            raise ValueError("biểu thức cụt")
        if t == "(":
            v = self.or_(); self.eat(); return v
        if t.startswith("'"):
            return t[1:-1].replace("''", "'")
        if re.fullmatch(r"\d+(\.\d+)?", t):
            return float(t)
        if t in ("true", "false"):
            return t == "true"
        if t == "null":
            return None
        if self.peek() == "(":
            self.eat(); args = []
            while self.peek() != ")":
                args.append(self.or_())
                if self.peek() == ",":
                    self.eat()
            self.eat()
            return self.call(t, args)
        return self.lookup(t)

    def call(self, f, a):
        st = self.ctx.get("_status", "success")
        f = f.lower()
        if f == "always": return True
        if f == "success": return st == "success"
        if f == "failure": return st == "failure"
        if f == "cancelled": return False
        if f == "contains": return str(a[1]).lower() in str(a[0]).lower()
        if f == "startswith": return str(a[0]).lower().startswith(str(a[1]).lower())
        if f == "endswith": return str(a[0]).lower().endswith(str(a[1]).lower())
        if f == "tostring": return _str(a[0])
        raise ValueError("hàm chưa hỗ trợ: " + f)

    def lookup(self, path):
        cur = self.ctx
        for k in path.split("."):
            if isinstance(cur, dict):
                cur = cur.get(k)
            else:
                return None
        return cur


def _truthy(v):
    return v not in (None, "", 0, 0.0, False)


def _num(v):
    if v is None or v == "": return 0.0
    if isinstance(v, bool): return 1.0 if v else 0.0
    if isinstance(v, (int, float)): return float(v)
    try: return float(v)
    except ValueError: return float("nan")


def _cmp(op, a, b):
    if type(a) is type(b) or (isinstance(a, str) and isinstance(b, str)):
        x, y = (a.lower(), b.lower()) if isinstance(a, str) else (a, b)
    else:
        x, y = _num(a), _num(b)
    return {"==": x == y, "!=": x != y, "<": x < y, ">": x > y, "<=": x <= y, ">=": x >= y}[op]


def _str(v):
    if v is None: return ""
    if v is True: return "true"
    if v is False: return "false"
    if isinstance(v, float) and v == int(v): return str(int(v))
    return str(v)


def ev(expr, ctx):
    return _P(expr, ctx).parse()


def interp(s, ctx):
    return re.sub(r"\$\{\{(.*?)\}\}", lambda m: _str(ev(m.group(1), ctx)), str(s), flags=re.S)


def cond(c, ctx):
    """`if:` của bước/job. Không có if thì là success()."""
    if c is None:
        return ctx.get("_status", "success") == "success"
    s = str(c).strip()
    m = re.fullmatch(r"\$\{\{(.*)\}\}", s, flags=re.S)
    s = m.group(1) if m else s
    if not re.search(r"\b(always|failure|success|cancelled)\s*\(", s):
        s = "success() && (" + s + ")"
    return _truthy(ev(s, ctx))


# ---------------------------------------------------------------- sandbox
GH_FAKE = r'''#!{py}
import json, os, subprocess, sys
a = sys.argv[1:]
db = json.load(open(os.environ["FAKE_GH_DB"])) if os.path.isfile(os.environ.get("FAKE_GH_DB", "")) else {{}}
tok = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
open(os.path.join(os.environ["FAKE_LOG"], "gh.jsonl"), "a").write(json.dumps({{"argv": a, "cwd": os.getcwd(), "token": tok, "gh_repo": os.environ.get("GH_REPO", "")}}) + "\n")
has_repo = os.environ.get("GH_REPO") or any(x in ("-R", "--repo") or x.startswith("--repo=") for x in a)
sub = a[0] if a else ""
if sub != "api" and not has_repo:
    if subprocess.run(["git", "rev-parse", "--git-dir"], capture_output=True).returncode != 0:
        sys.stderr.write("failed to run git: fatal: not a git repository (or any of the parent directories): .git\n"); sys.exit(1)
if not tok:
    sys.stderr.write("gh: To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN environment variable.\n"); sys.exit(4)
def val(flag):
    return a[a.index(flag) + 1] if flag in a else None
if a[:2] == ["run", "list"]:
    print(json.dumps(db.get("runs", {{}}).get(val("--workflow"), [])))
elif a[:2] == ["pr", "list"]:
    prs = db.get("prs", [])
    h = val("--head")
    print(json.dumps([p for p in prs if h is None or p.get("headRefName") == h]))
elif a[:1] == ["api"]:
    print(json.dumps(db.get("api", {{}}).get(a[1].split("?")[0], {{"jobs": []}})))
elif a[:2] == ["workflow", "run"]:
    sys.exit(int(db.get("workflow_run_rc", 0)))
else:
    sys.stderr.write("gh giả: lệnh chưa hỗ trợ %r\n" % (a,)); sys.exit(2)
'''
PY_SHIM = '#!/bin/sh\nprintf \'%s\\t%s\\n\' "$PWD" "$*" >> "$FAKE_LOG/python.calls"\nexec {py} "$@"\n'
NOOP = '#!/bin/sh\nprintf \'%s\\t%s\\n\' "$PWD" "$*" >> "$FAKE_LOG/$(basename $0).calls"\nexit 0\n'


def _copytree(src, dst):
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", ".git", "node_modules", "*.pyc"))


def git(cwd, *a):
    return subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", *a], cwd=cwd, capture_output=True, text=True)


class Box:
    """Thư mục thử: ws (bản sao git của repo, nhánh main), rt (RUNNER_TEMP), fakebin, log."""

    def __init__(self, repo, items=("tools", ".github"), name="t135"):
        self.tmp = tempfile.mkdtemp(prefix=name + "-")
        self.ws = os.path.join(self.tmp, "ws"); os.makedirs(self.ws)
        for it in items:
            p = os.path.join(repo, it)
            if os.path.isdir(p): _copytree(p, os.path.join(self.ws, it))
            elif os.path.isfile(p): shutil.copy(p, os.path.join(self.ws, it))
        self.rt = os.path.join(self.tmp, "rt"); os.makedirs(self.rt)
        self.log = os.path.join(self.tmp, "log"); os.makedirs(self.log)
        self.fb = os.path.join(self.tmp, "fakebin"); os.makedirs(self.fb)
        self.db = os.path.join(self.tmp, "gh.json"); self.gh_db({})
        nd = os.path.join(self.tmp, "nonet"); os.makedirs(nd); shutil.copy(NONET, os.path.join(nd, "sitecustomize.py")); self.nonet = nd
        for n, body in (("gh", GH_FAKE.format(py=sys.executable)), ("python", PY_SHIM.format(py=sys.executable)), ("python3", PY_SHIM.format(py=sys.executable)),
                        ("npm", NOOP), ("pip", NOOP), ("curl", NOOP.replace("exit 0", "exit 7"))):
            p = os.path.join(self.fb, n); open(p, "w").write(body); os.chmod(p, 0o755)
        git(self.ws, "init", "-q", "-b", "main"); git(self.ws, "add", "-A"); git(self.ws, "commit", "-q", "-m", "main")
        self.pr_log = []

    def gh_db(self, d):
        json.dump(d, open(self.db, "w"))

    def gh_calls(self):
        p = os.path.join(self.log, "gh.jsonl")
        return [json.loads(l) for l in open(p)] if os.path.isfile(p) else []

    def py_calls(self):
        p = os.path.join(self.log, "python.calls")
        return [l.rstrip("\n").split("\t", 1) for l in open(p)] if os.path.isfile(p) else []

    def reset(self):
        git(self.ws, "checkout", "-q", "-f", "main"); git(self.ws, "reset", "-q", "--hard", "main"); git(self.ws, "clean", "-qfd")
        for f in os.listdir(self.log): os.remove(os.path.join(self.log, f))
        shutil.rmtree(self.rt, ignore_errors=True); os.makedirs(self.rt)

    def cleanup(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


def gh_ctx(box, event_name, event=None, inputs=None, repo="phungrk/tohong", run_id="4242", attempt="1", secrets=None, vars_=None, extra=None):
    ev_ = dict(event or {}); ev_["inputs"] = inputs or {}
    c = {"github": {"run_id": run_id, "run_attempt": attempt, "run_number": "7", "event_name": event_name, "event": ev_, "repository": repo, "token": "GHTOKEN-sentinel",
                    "workspace": box.ws, "sha": "0" * 40, "ref": "refs/heads/main"},
         "secrets": dict({"GITHUB_TOKEN": "GHTOKEN-sentinel"}, **(secrets or {})), "vars": dict(vars_ or {}), "runner": {"temp": box.rt}, "steps": {}, "env": {}, "job": {"status": "success"}}
    c.update(extra or {})
    return c


def run_job(box, wf, job_name, ctx, uses=None, stop_on_fail=False, only=None):
    """Chạy các bước của một job. Trả dict: status, steps{id|name:{outcome,outputs,rc,log}}, order[(name, outcome)], log."""
    job = wf["jobs"][job_name]
    wf_env, job_env = wf.get("env") or {}, job.get("env") or {}
    dflt = {**((wf.get("defaults") or {}).get("run") or {}), **((job.get("defaults") or {}).get("run") or {})}
    res = {"status": "success", "steps": {}, "order": [], "log": ""}
    ctx["_status"] = "success"; ctx["steps"] = {}
    ctx["env"] = {**{k: interp(v, ctx) for k, v in wf_env.items()}, **{k: interp(v, ctx) for k, v in job_env.items()}}
    for n, s in enumerate(job.get("steps") or []):
        name = s.get("name") or s.get("uses") or "bước %d" % n
        sid = s.get("id") or name
        if only is not None and not only(s):
            continue
        if not cond(s.get("if"), ctx):
            res["order"].append((name, "skipped")); ctx["steps"][s.get("id", "_%d" % n)] = {"outcome": "skipped", "conclusion": "skipped", "outputs": {}}
            res["steps"][sid] = {"outcome": "skipped", "outputs": {}, "rc": None, "log": ""}
            continue
        outputs, rc, log = {}, 0, ""
        if s.get("uses"):
            u = str(s["uses"]); w = {k: (interp(v, ctx) if isinstance(v, str) else v) for k, v in (s.get("with") or {}).items()}
            h = next((f for k, f in (uses or {}).items() if u.startswith(k)), None)
            if h:
                try:
                    outputs = h(w, s) or {}
                except Exception as e:  # noqa: BLE001
                    rc, log = 1, "uses %s lỗi: %s" % (u, e)
        else:
            senv = {k: (interp(v, ctx) if isinstance(v, str) else _str(v)) for k, v in (s.get("env") or {}).items()}
            ctx["env"] = {**ctx["env"], **senv}
            shell = s.get("shell") or dflt.get("shell")
            argv = ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c"] if shell == "bash" else ["bash", "-e", "-c"]
            wd = s.get("working-directory") or dflt.get("working-directory") or "."
            cwd = os.path.join(box.ws, wd) if not os.path.isabs(wd) else wd
            outf, sumf = os.path.join(box.rt, "gh_output"), os.path.join(box.rt, "gh_summary")
            for p in (outf, sumf): open(p, "w").close()
            env = dict(os.environ, PATH=box.fb + os.pathsep + os.environ["PATH"], PYTHONPATH=box.nonet, PYTHONDONTWRITEBYTECODE="1", FAKE_LOG=box.log, FAKE_GH_DB=box.db,
                       RUNNER_TEMP=box.rt, GITHUB_WORKSPACE=box.ws, GITHUB_RUN_ID=ctx["github"]["run_id"], GITHUB_RUN_ATTEMPT=ctx["github"]["run_attempt"], GITHUB_REPOSITORY=ctx["github"]["repository"],
                       GITHUB_OUTPUT=outf, GITHUB_STEP_SUMMARY=sumf, GITHUB_ENV=os.path.join(box.rt, "gh_env"), CI="true", HTTPS_PROXY="http://127.0.0.1:9", HTTP_PROXY="http://127.0.0.1:9",
                       GOOGLE_MAPS_API_KEY="", GH_TOKEN="", GITHUB_TOKEN="", GH_REPO="", GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
            env.update({k: str(v) for k, v in ctx["env"].items()})
            for k in ("GH_REPO",):
                if not env.get(k): env.pop(k, None)
            if not os.path.isdir(cwd):
                rc, log = 1, "thư mục chạy của bước không tồn tại: %s" % wd
            else:
                p = subprocess.run(argv + [interp(s["run"], ctx)], cwd=cwd, env=env, capture_output=True, text=True, timeout=900)
                rc, log = p.returncode, (p.stdout or "") + (p.stderr or "")
                txt = open(outf).read()
                for m in re.finditer(r"^([\w\-]+)<<(\S+)\n(.*?)\n\2$", txt, flags=re.M | re.S): outputs[m.group(1)] = m.group(3)
                txt2 = re.sub(r"^([\w\-]+)<<(\S+)\n.*?\n\2$", "", txt, flags=re.M | re.S)
                for m in re.finditer(r"^([\w\-]+)=(.*)$", txt2, flags=re.M): outputs[m.group(1)] = m.group(2)
            ctx["env"] = {k: v for k, v in ctx["env"].items() if k not in senv or k in {**wf_env, **job_env}}
        outcome = "failure" if rc else "success"
        res["log"] += "[%s] rc=%s %s\n" % (name, rc, log[-1200:])
        ctx["steps"][s.get("id", "_%d" % n)] = {"outcome": outcome, "conclusion": "success" if (outcome == "success" or s.get("continue-on-error")) else "failure", "outputs": outputs}
        res["steps"][sid] = {"outcome": outcome, "outputs": outputs, "rc": rc, "log": log}
        res["order"].append((name, outcome))
        if rc and not s.get("continue-on-error"):
            ctx["_status"] = "failure"; res["status"] = "failure"
            if stop_on_fail:
                break
    return res


def make_cpr(box, record):
    """Mô hình peter-evans/create-pull-request theo hợp đồng. record: list nhận dict mô tả PR."""
    def h(w, s):
        base = w.get("base") or "main"
        branch = w["branch"]
        paths = [x.strip() for x in str(w.get("add-paths", "")).split("\n") if x.strip()]
        chosen = []
        for pat in paths:
            r = git(box.ws, "ls-files", "-z", "-m", "-o", "-d", "--exclude-standard", "--", pat).stdout
            chosen += [x for x in r.split("\0") if x]
        chosen = sorted(set(chosen))
        allch = [l[3:] for l in git(box.ws, "status", "--porcelain", "-uall").stdout.splitlines()]
        other = sorted(set(x for x in allch if x not in chosen and "__pycache__" not in x))
        body = ""
        if w.get("body-path") and os.path.isfile(os.path.join(box.ws, w["body-path"]) if not os.path.isabs(w["body-path"]) else w["body-path"]):
            bp = w["body-path"]; body = open(bp if os.path.isabs(bp) else os.path.join(box.ws, bp), encoding="utf-8").read()
        elif w.get("body"):
            body = w["body"]
        if not chosen:
            record.append({"operation": "none", "branch": branch, "files": [], "other": other, "body": body, "title": w.get("title", "")})
            return {"pull-request-operation": "none"}
        git(box.ws, "checkout", "-q", "-B", branch, base)
        for f in chosen:
            git(box.ws, "add", "-A", "--", f)
        git(box.ws, "commit", "-q", "-m", w.get("commit-message", "chore"))
        sha = git(box.ws, "rev-parse", "HEAD").stdout.strip()
        files = {f: git(box.ws, "show", "HEAD:" + f).stdout for f in chosen if git(box.ws, "cat-file", "-e", "HEAD:" + f).returncode == 0}
        snap = os.path.join(box.tmp, "snap-%s" % sha[:8]); os.makedirs(snap, exist_ok=True)
        subprocess.run("git archive %s | tar -x -C %s" % (sha, snap), shell=True, cwd=box.ws, capture_output=True)
        git(box.ws, "checkout", "-q", "-f", base)
        rec = {"operation": "created", "branch": branch, "sha": sha, "files": chosen, "contents": files, "other": other, "body": body, "title": w.get("title", ""), "number": "77", "with": w, "tree": snap}
        record.append(rec)
        return {"pull-request-operation": "created", "pull-request-head-sha": sha, "pull-request-number": "77", "pull-request-branch": branch}
    return h


def first_step(job, pred):
    for s in job.get("steps") or []:
        if pred(s): return s


def inv(name, repo_env=None):
    """Chạy một bất biến của bể nguyên văn (python3 -I) với TOHONG_REPO / TOHONG_BACK_REPO. Trả (thoát, dòng cuối)."""
    p = subprocess.run([sys.executable, "-I", name], env=dict(os.environ, **(repo_env or {})), capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout.strip().splitlines() or [p.stderr.strip()[-200:]])[-1][:200]


def mutate_fixture_overrides(box, n_extra=2):
    """Thêm vào manual_overrides.json của sandbox `n_extra` mục `remove` (một venue, một category khác) như một lô mới của Capu. Trả danh sách id."""
    out_dir = os.path.join(box.ws, "tools", "scraper", "output", "HCMC")
    mo_path = os.path.join(out_dir, "manual_overrides.json")
    mo = json.load(open(mo_path, encoding="utf-8"))
    have = {e["vendor_id"] for e in mo["overrides"]}
    ids = []
    for cat in ("venue", "photography", "makeup", "flower"):
        vp = os.path.join(out_dir, cat, "vendors.json")
        if not os.path.isfile(vp): continue
        v = next((x for x in json.load(open(vp, encoding="utf-8"))["vendors"] if x["id"] not in have and x["id"] not in ids), None)
        if v: ids.append((cat, v["id"]))
        if len(ids) >= n_extra: break
    for cat, vid in ids:
        mo["overrides"].append({"vendor_id": vid, "action": "remove", "reason": "Capu: lô thử T-135", "approved_by": "capu", "approved_on": "2026-11-13",
                                "decision": "decisions/2026-11-08-adr-048-capu-duyet-tay-4-venue.md"})
    json.dump(mo, open(mo_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    git(box.ws, "add", "-A"); git(box.ws, "commit", "-q", "-m", "main + lô thử (manual_overrides đã merge)")
    return ids


def fresh_report(box, root=None):
    """Báo cáo sinh lại từ dữ liệu của sandbox bằng chính build_enrich_report.py (như INV-003). Trả bytes hoặc None."""
    root = root or box.ws
    sc = os.path.join(root, "tools", "scraper")
    out = os.path.join(box.tmp, "fresh-report-%d.json" % len(os.listdir(box.tmp)))
    p = subprocess.run([sys.executable, os.path.join(sc, "build_enrich_report.py"), "--state", "HCMC", "--output-dir", os.path.join(sc, "output"), "--out", out],
                       cwd=box.tmp, env=dict(os.environ, PYTHONPATH=box.nonet, PYTHONDONTWRITEBYTECODE="1"), capture_output=True, text=True, timeout=300)
    return open(out, "rb").read() if p.returncode == 0 and os.path.isfile(out) else None


def pr_event(number=12, ref="admin-reviews/capu", repo="phungrk/tohong", merged=True):
    return {"action": "closed", "pull_request": {"number": number, "merged": merged, "head": {"ref": ref, "repo": {"full_name": repo}}, "base": {"ref": "main"}}}


def pick_pool_vendor(tohong_root):
    """Một vendor có trong venue/vendors.json của tohong VÀ trong pool của tohong-back (để dựng 'vendor đã gỡ nhưng còn trong pool')."""
    s = open(os.path.join(BACK, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
    pool = {v["id"] for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])}
    out = os.path.join(tohong_root, "tools", "scraper", "output", "HCMC")
    for cat in ("venue", "photography", "makeup"):
        vp = os.path.join(out, cat, "vendors.json")
        for v in json.load(open(vp, encoding="utf-8"))["vendors"]:
            if v["id"] in pool:
                yield cat, v["id"]


def remove_vendor_in_tree(tohong_root, cat, vid):
    """Đưa vendor `vid` từ vendors.json sang removed_vendors.json (như một PR dữ liệu đã gỡ nó), rồi sinh lại enrich-report.json bằng chính build_enrich_report.py."""
    d = os.path.join(tohong_root, "tools", "scraper", "output", "HCMC", cat)
    vp = os.path.join(d, "vendors.json"); doc = json.load(open(vp, encoding="utf-8"))
    v = next(x for x in doc["vendors"] if x["id"] == vid)
    doc["vendors"] = [x for x in doc["vendors"] if x["id"] != vid]
    json.dump(doc, open(vp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    rp = os.path.join(d, "removed_vendors.json")
    rem = json.load(open(rp, encoding="utf-8")) if os.path.isfile(rp) else []
    rem.append({"removed_at": "2026-11-13T00:00:00Z", "reason": "Capu: lô thử T-135 (manual)", "manual": True, "vendor": v})
    json.dump(rem, open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def tohong_tree_with_removed(n=1):
    """Bản sao tohong (tools) với n vendor-còn-trong-pool đã bị gỡ; trả (thư mục gốc, [(cat, id)], đường dẫn các thư mục cần dọn)."""
    tmp = tempfile.mkdtemp(prefix="t135-tohong-")
    root = os.path.join(tmp, "tohong"); os.makedirs(root)
    _copytree(os.path.join(TOHONG, "tools"), os.path.join(root, "tools"))
    picked = []
    for cat, vid in pick_pool_vendor(root):
        picked.append((cat, vid))
        if len(picked) >= n: break
    for cat, vid in picked:
        remove_vendor_in_tree(root, cat, vid)
    sc = os.path.join(root, "tools", "scraper")
    out = os.path.join(sc, "output", "HCMC", "enrich-report.json")
    subprocess.run([sys.executable, os.path.join(sc, "build_enrich_report.py"), "--state", "HCMC", "--output-dir", os.path.join(sc, "output"), "--out", out],
                   cwd=tmp, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"), capture_output=True, text=True)
    return root, picked, tmp


def run_back_sync(bk, wf, tohong_root, sha, branch, secrets=None, rec=None, checkouts=None, inputs=None, run_id="9001"):
    """Chạy NGUYÊN VĂN job của workflow pool ở tohong-back trong Box `bk` (bản sao git của back). Trả kết quả run_job."""
    rec = rec if rec is not None else []
    checkouts = checkouts if checkouts is not None else []
    secrets = {"TOHONG_READ_TOKEN": "READTOKEN-sentinel"} if secrets is None else secrets

    def checkout(w, s):
        repo = w.get("repository") or "phungrk/tohong-back"
        checkouts.append({"repository": repo, "ref": w.get("ref"), "path": w.get("path"), "token": w.get("token"), "persist": w.get("persist-credentials")})
        if repo.endswith("/tohong"):
            if not w.get("token"):
                raise RuntimeError("không có token: repo tohong là private (clone thất bại)")
            dst = os.path.join(bk.ws, w.get("path") or "tohong")
            shutil.rmtree(dst, ignore_errors=True); _copytree(tohong_root, dst)
        return {}
    uses = {"actions/checkout": checkout, "actions/": lambda w, s: {}, "peter-evans/create-pull-request": make_cpr(bk, rec)}
    ctx = gh_ctx(bk, "workflow_dispatch", inputs=inputs if inputs is not None else {"tohong_ref": sha, "tohong_branch": branch}, repo=BACK_REPO_NAME, secrets=secrets, run_id=run_id)
    job = next(iter(wf["jobs"]))
    return run_job(bk, wf, job, ctx, uses=uses), rec, checkouts


def back_box():
    return Box(BACK, items=("lib", "tools", "package.json", ".github"), name="t135-back")


def pool_ids(text):
    return {v["id"] for v in json.loads(text[text.index("= [") + 2:text.rindex("]") + 1])}
