#!/usr/bin/env python3
"""T-129 tiêu chí 5 (repo tohong): workflow `.github/workflows/apply-admin-reviews.yml` CHẠY ĐƯỢC từ đầu đến cuối trên repo thật và cho PR dữ liệu đúng ở mọi tình huống (bài học T-118/T-119/T-127: không chỉ đọc YAML).
Cách đo: mô phỏng runner. Mọi bước `run:` của workflow chạy NGUYÊN VĂN bằng `bash -eo pipefail` trong bản sao git của repo (thư mục theo defaults.run.working-directory, env của bước với secrets./vars./runner.temp thay bằng giá trị thử),
  `curl` và `pip` là bản giả đặt đầu PATH (curl giả chỉ trả export khi đúng URL `$ENRICH_BACK_URL/api/internal/vendor-enrich/export` và đúng `Authorization: Bearer <khoá>`, ngược lại thoát 22 như --fail), `python` là python3 thật không mạng, `date` giả luôn in một ngày khác.
  Các bước `uses:` actions/checkout, actions/setup-python không làm gì (bản sao đã ở nhánh main); `peter-evans/create-pull-request` được mô hình hoá THEO HỢP ĐỒNG CỦA NÓ (ràng buộc cài đặt, ghi trong spec Hành vi 4):
  nhánh `with.branch` đặt lại về `with.base` mỗi lần chạy rồi chỉ lấy thay đổi của `with.add-paths`; không còn thay đổi thì PR bị đóng; thân PR là file `with.body-path`.
Tình huống: (A) 3 cú bấm của Capu khác ngày -> PR chỉ có manual_overrides.json, 3 mục đúng, chữ ký kiểm được, approved_on = ngày bấm, thân PR ghi "Export lúc <exported_at>" và mỗi mục ADDED;
  (B) chạy lại cùng export (và ngày chạy khác) -> nội dung PR giống hệt byte (không viết lại khi không có cú bấm mới); (C) Capu Rút lại một mục -> PR dựng lại không còn mục đó; (D) export trống -> PR rỗng (đóng);
  (E) mục đã có trên main -> PR rỗng; (F) chữ ký bị sửa -> job đỏ ở bước áp, không có PR; (G) key_id lạ -> job đỏ; (H) curl --fail thoát 22 (sai khoá/URL/back 403) -> job đỏ, không PR.
Tĩnh: chỉ workflow_dispatch/schedule; permissions đúng {contents: write, pull-requests: write}; concurrency; chỉ hai secret ENRICH_EXPORT_TOKEN, GITHUB_TOKEN; không GOOGLE_MAPS_API_KEY, không chạy resolve_overrides/enrich/refresh_photos/main.py;
  không nội suy secrets/inputs vào run:; `uses` chỉ trong {actions/checkout, actions/setup-python, peter-evans/create-pull-request}; add-paths đúng một đường dẫn manual_overrides.json; branch cố định không phải main/master; không git push/--force/git add -A;
  requirements.txt có cryptography; và INV-030, INV-031 nguyên văn xanh trên repo.
Repo: TOHONG_REPO hoặc ../tohong. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import base64, importlib.util, json, os, re, shutil, stat, subprocess, sys, tempfile
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML"); sys.exit(1)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-124"))
import _t124 as t
_sp = importlib.util.spec_from_file_location("cd", os.path.join(HERE, "capu_decision.py")); CD = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(CD)
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

HQ = t.HQ
repo = t.tohong_root()
if not repo:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
fp = os.path.join(repo, ".github", "workflows", "apply-admin-reviews.yml")
if not os.path.isfile(fp):
    print("FAIL thiếu .github/workflows/apply-admin-reviews.yml"); sys.exit(1)
raw = open(fp, encoding="utf-8").read()
wf = yaml.safe_load(raw) or {}
bad = []

# ---------- tĩnh ----------
on = wf.get("on", wf.get(True)) or {}
trig = set(on) if isinstance(on, dict) else set([on] if isinstance(on, str) else on)
if not trig or trig - {"workflow_dispatch", "schedule"}: bad.append("kích hoạt %s (chỉ workflow_dispatch và/hoặc schedule)" % sorted(trig))
cc = wf.get("concurrency")
if not (isinstance(cc, dict) and cc.get("group")) or cc.get("cancel-in-progress") in (True, "true"): bad.append("thiếu concurrency.group hoặc cancel-in-progress bật")
if wf.get("permissions") != {"contents": "write", "pull-requests": "write"}: bad.append("permissions %r, mong đúng {contents: write, pull-requests: write}" % (wf.get("permissions"),))
if "GOOGLE_MAPS_API_KEY" in raw: bad.append("nhắc GOOGLE_MAPS_API_KEY")
secrets = set(re.findall(r"secrets\.([A-Za-z0-9_]+)", raw))
if secrets - {"ENRICH_EXPORT_TOKEN", "GITHUB_TOKEN"}: bad.append("bí mật lạ: %s" % sorted(secrets - {"ENRICH_EXPORT_TOKEN", "GITHUB_TOKEN"}))
jobs = wf.get("jobs") or {}
if len(jobs) != 1: bad.append("mong đúng một job")
job = next(iter(jobs.values()), {})
steps = job.get("steps") or []
runs = [s.get("run", "") for s in steps if s.get("run")]
alltext = "\n".join(runs)
for w in ("resolve_overrides.py", "enrich.py", "refresh_photos.py", "main.py"):
    if re.search(r"(?<![\w-])" + re.escape(w), alltext): bad.append("bước chạy %s (có thể gọi Google)" % w)
if re.search(r"\$\{\{\s*(secrets|github\.event\.inputs|inputs)\.", alltext): bad.append("nội suy secrets/inputs thẳng vào run:")
for s in steps:
    u = str(s.get("uses", ""))
    if u and not re.match(r"(actions/checkout|actions/setup-python|peter-evans/create-pull-request)@", u): bad.append("`uses` ngoài danh sách cho phép: %s" % u)
for r in runs:
    for ln in r.splitlines():
        if re.search(r"\bgit\s+push\b", ln) or re.search(r"\bgit\s+add\s+(-A|--all|\.)(\s|$)", ln) or "--force" in ln: bad.append("dòng cấm: %s" % ln.strip()[:80])
curl = next((r for r in runs if "curl" in r), "")
if not re.search(r"curl\b[^\n]*(\s--fail\b|\s-[a-zA-Z]*f[a-zA-Z]*\s)", curl) or "Authorization: Bearer $" not in curl: bad.append("curl phải có --fail và Authorization: Bearer lấy từ biến môi trường")
pr = next((s for s in steps if str(s.get("uses", "")).startswith("peter-evans/create-pull-request")), None)
if not pr: bad.append("thiếu bước peter-evans/create-pull-request")
req = os.path.join(repo, "tools", "scraper", "requirements.txt")
if not os.path.isfile(req) or "cryptography" not in open(req).read().lower(): bad.append("requirements.txt thiếu cryptography (apply kiểm chữ ký Ed25519)")
for n in ("inv-030-workflow-day-nhanh-an-toan.py", "inv-031-gh-biet-repo-o-moi-buoc.py"):
    p = subprocess.run([sys.executable, "-I", os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images", n)], env=dict(os.environ, TOHONG_REPO=repo), capture_output=True, text=True, timeout=120)
    if p.returncode != 0: bad.append("%s đỏ: %s" % (n[:7].upper(), p.stdout.strip()[:120]))
if pr is None or bad:
    print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
w = pr.get("with") or {}
paths = [x.strip() for x in str(w.get("add-paths", "")).split("\n") if x.strip()]
if paths != ["tools/scraper/output/HCMC/manual_overrides.json"]: bad.append("add-paths %r (chỉ manual_overrides.json)" % paths)
BRANCH, BASE, BODY = str(w.get("branch", "")), str(w.get("base", "")), str(w.get("body-path", ""))
if not BRANCH or BRANCH in ("main", "master") or "${{" in BRANCH or BASE not in ("main", "master") or not BODY: bad.append("branch %r / base %r / body-path %r không hợp lệ (nhánh cố định, base main, có body-path)" % (BRANCH, BASE, BODY))
if bad:
    print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)

# ---------- mô phỏng runner ----------
b64u = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
K1 = Ed25519PrivateKey.generate(); P1 = base64.b64encode(K1.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
KX = Ed25519PrivateKey.generate()
TOKEN, URL = "t129-khoa-may-0123456789abcdef", "https://back.test"
LABEL = "admin:2be188f6"
tmp = tempfile.mkdtemp(prefix="t129-wf-")
try:
    ws = os.path.join(tmp, "repo")
    os.makedirs(ws)
    for rel in ("tools", ".github"):
        shutil.copytree(os.path.join(repo, rel), os.path.join(ws, rel), ignore=shutil.ignore_patterns("__pycache__", "run-logs", ".git"))
    json.dump({"schema_version": 1, "keys": {"k1": P1}}, open(os.path.join(ws, "tools", "scraper", "admin_review_keys.json"), "w"))
    G = lambda *a: subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", *a], cwd=ws, capture_output=True, text=True)
    G("init", "-q", "-b", "main"); G("add", "-A"); G("commit", "-q", "-m", "main")
    fb = os.path.join(tmp, "fakebin"); os.makedirs(fb)
    def script(name, body):
        p = os.path.join(fb, name); open(p, "w").write(body); os.chmod(p, 0o755)
    script("curl", '#!%s\nimport os, sys\na = sys.argv[1:]\nout = a[a.index("-o") + 1] if "-o" in a else None\nhdr = [a[i + 1] for i, x in enumerate(a) if x == "-H"]\nurl = next((x for x in a if x.startswith("http")), "")\n'
           'ok = os.environ.get("FAKE_CURL_FAIL") != "1" and url == os.environ["FAKE_URL"] + "/api/internal/vendor-enrich/export" and ("Authorization: Bearer " + os.environ["FAKE_TOKEN"]) in hdr\n'
           'if not ok:\n    sys.stderr.write("curl: (22) The requested URL returned error: 403\\n"); sys.exit(22)\nopen(out, "w").write(open(os.environ["FAKE_EXPORT"]).read())\n' % sys.executable)
    script("pip", "#!/bin/sh\necho fake pip $@ >> \"$RUNNER_TEMP/pip.log\"\n")
    script("python", '#!/bin/sh\nexec %s "$@"\n' % sys.executable)
    script("date", "#!/bin/sh\necho 2031-01-01\n")
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd); shutil.copy(os.path.join(HERE, "..", "T-124", "lib", "nonet_sitecustomize.py"), os.path.join(nd, "sitecustomize.py"))

    def expr(s, rt):
        def sub(m):
            k = m.group(1).strip()
            if k == "secrets.ENRICH_EXPORT_TOKEN": return TOKEN
            if k == "vars.ENRICH_BACK_URL": return URL
            if k == "runner.temp": return rt
            if k in ("github.run_id", "github.run_number"): return "1"
            raise KeyError(k)
        return re.sub(r"\$\{\{\s*(.*?)\s*\}\}", sub, str(s))

    vendors = [f for f in t.facts_from_repo(repo)]
    cand = [f for f in vendors if t.classify(f) == "not_found"][:4]
    ids = [f["id"] for f in cand]
    def E(vid, action, i, key=K1, kid="k1"):
        at = "2026-11-%02dT0%d:04:05.678Z" % (10 + i, 3 + i)
        sig = b64u(key.sign(CD.payload(kid, vid, action, None, None, "Lý do %d" % i, LABEL, at)))
        return {"vendor_id": vid, "action": action, "reason": "Lý do %d" % i, "reviewer_label": LABEL, "reviewed_at": at, "by_capu": True, "key_id": kid, "sig": sig}
    ent = [E(ids[0], "remove", 0), E(ids[1], "temporarily_closed", 1), E(ids[2], "remove", 2)]
    EXPORTED = "2026-11-12T10:00:00.000Z"

    def simulate(entries, fail_curl=False, extra=None):
        """Chạy workflow trên bản sao sạch của main. Trả (job_ok, log, pr) với pr = None (job đỏ) hoặc {"files": {đường dẫn: nội dung}, "body": str}."""
        G("reset", "-q", "--hard", "main"); G("clean", "-qfd")
        rt = os.path.join(tmp, "rt"); shutil.rmtree(rt, ignore_errors=True); os.makedirs(rt)
        exp = os.path.join(tmp, "export.json"); json.dump({"exported_at": EXPORTED, "count": len(entries), "waiting_capu": 0, "entries": entries}, open(exp, "w"), ensure_ascii=False)
        wd = (job.get("defaults") or {}).get("run", {}).get("working-directory", ".")
        log = ""
        for s in steps:
            u = str(s.get("uses", ""))
            if u.startswith("actions/"): continue
            if u.startswith("peter-evans/"):
                g = {k: expr(v, rt) for k, v in (s.get("with") or {}).items()}
                files = {}
                for path in [x.strip() for x in g["add-paths"].split("\n") if x.strip()]:
                    d = G("diff", "--quiet", "HEAD", "--", path)
                    st = G("status", "--porcelain", "--", path).stdout
                    if st.strip():
                        files[path] = open(os.path.join(ws, path), encoding="utf-8").read()
                other = [l[3:] for l in G("status", "--porcelain").stdout.splitlines() if l[3:] not in paths and "__pycache__" not in l[3:]]
                return True, log, {"files": files, "body": open(g["body-path"], encoding="utf-8").read() if os.path.isfile(g["body-path"]) else None, "other": other}
            env = dict(os.environ, PATH=fb + os.pathsep + os.environ["PATH"], PYTHONPATH=nd, GOOGLE_MAPS_API_KEY="", RUNNER_TEMP=rt, GITHUB_WORKSPACE=ws, CI="true",
                       FAKE_EXPORT=exp, FAKE_URL=URL, FAKE_TOKEN=TOKEN, FAKE_CURL_FAIL="1" if fail_curl else "0")
            for k, v in (s.get("env") or {}).items(): env[k] = expr(v, rt)
            p = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", expr(s["run"], rt)], cwd=os.path.join(ws, s.get("working-directory", wd)), env=env, capture_output=True, text=True, timeout=600)
            log += "[%s] rc=%s %s%s\n" % (s.get("name", "run"), p.returncode, p.stdout[-200:] if p.returncode == 0 else p.stdout[-1500:], p.stderr[-300:])
            if p.returncode != 0:
                return False, log, None
        return True, log, {"files": {}, "body": None, "other": []}

    MO = "tools/scraper/output/HCMC/manual_overrides.json"
    def entries_of(pr): return json.loads(pr["files"][MO])["overrides"]
    keys = {"k1": P1}
    # A
    ok, log, a = simulate(ent)
    if not ok or a is None: bad.append("(A) workflow đỏ với 3 cú bấm của Capu: %s" % log[-300:])
    else:
        if list(a["files"]) != [MO] or a["other"]: bad.append("(A) PR phải chỉ chứa manual_overrides.json; thấy %s, ngoài add-paths: %s" % (list(a["files"]), a["other"][:3]))
        else:
            added = [e for e in entries_of(a) if e["vendor_id"] in ids]
            if sorted(e["vendor_id"] for e in added) != sorted(e["vendor_id"] for e in ent): bad.append("(A) PR không có đúng 3 mục của export")
            for e in added:
                src = next(x for x in ent if x["vendor_id"] == e["vendor_id"])
                okk, why = CD.check_entry(e, keys)
                if not okk or e["approved_on"] != src["reviewed_at"][:10]: bad.append("(A) mục %s không hợp lệ/approved_on != ngày bấm: %s" % (e["vendor_id"], why))
            body = a["body"] or ""
            if "Export lúc: " + EXPORTED not in body or not all(("ADDED %s %s" % (x["vendor_id"], x["action"])) in body for x in ent): bad.append("(A) thân PR thiếu 'Export lúc: <exported_at>' hoặc dòng ADDED từng mục: %r" % body[:200])
        a_files = a["files"]
        # B: chạy lại, ngày chạy khác (date giả luôn 2031-01-01), cùng export
        ok2, log2, b = simulate(ent)
        if not ok2 or b is None or b["files"] != a_files: bad.append("(B) chạy lại cùng export cho PR khác byte (không được viết lại khi không có cú bấm mới)")
        if any("2031-01-01" in v for v in (b or {"files": {}})["files"].values()): bad.append("(B) dữ liệu mang ngày chạy thay vì ngày bấm")
    # C: Rút lại một mục
    ok, log, c = simulate(ent[:2])
    if not ok or c is None: bad.append("(C) workflow đỏ khi Capu Rút lại: %s" % log[-200:])
    elif ids[2] in c["files"].get(MO, "") or ids[0] not in c["files"].get(MO, ""): bad.append("(C) PR dựng lại phải không còn mục đã Rút lại và vẫn giữ các mục còn lại")
    # D: export trống
    ok, log, d = simulate([])
    if not ok or d is None or d["files"]: bad.append("(D) export trống: PR phải rỗng (bị đóng); thấy %s %s" % (ok, list((d or {"files": {}})["files"])))
    # E: mục đã có trên main
    ok0, _, first = simulate(ent[:1])
    if ok0 and first and first["files"]:
        open(os.path.join(ws, MO), "w", encoding="utf-8").write(first["files"][MO]); G("add", "-A"); G("commit", "-q", "-m", "merged PR")
        ok, log, e_ = simulate(ent[:1])
        if not ok or e_ is None or e_["files"]: bad.append("(E) mục đã nằm trên main: PR phải rỗng; thấy %s" % list((e_ or {"files": {}})["files"]))
        G("reset", "-q", "--hard", "HEAD~1")
    else:
        bad.append("(E) không dựng được tình huống mục đã có trên main")
    # F, G, H
    tam = json.loads(json.dumps(ent)); tam[0]["reason"] += " x"
    ok, log, f = simulate(tam)
    if ok or f is not None or "bad_signature" not in log: bad.append("(F) chữ ký bị sửa: job phải đỏ ở bước áp (bad_signature) và không có PR; thấy ok=%s %s" % (ok, log[-160:]))
    ok, log, g = simulate([E(ids[0], "remove", 0, key=KX), ent[1]])
    if ok or g is not None: bad.append("(G') chữ ký của khoá kẻ tấn công: job phải đỏ")
    ok, log, g = simulate([E(ids[0], "remove", 0, kid="k9")])
    if ok or g is not None or "unknown_key" not in log: bad.append("(G) key_id lạ: job phải đỏ (unknown_key); thấy %s %s" % (ok, log[-120:]))
    ok, log, h = simulate(ent, fail_curl=True)
    if ok or h is not None or "22" not in log: bad.append("(H) curl --fail thoát 22: job phải đỏ ngay ở bước lấy export, không PR; thấy ok=%s %s" % (ok, log[-120:]))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
sys.exit(1 if bad else 0)
