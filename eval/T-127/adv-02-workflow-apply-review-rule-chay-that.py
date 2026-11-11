#!/usr/bin/env python3
"""T-127 adv-02 (adversary, tầng 3): chạy NGUYÊN VĂN workflow `.github/workflows/apply-review-rule.yml` theo đúng thứ tự bước, trên repo git THẬT (bản sao bare của TOHONG_REPO
làm `origin`: nhánh `main` = code đang xét, nhánh `enrich-vendors/run-1` = PR dữ liệu dựng từ fixture), với `gh` giả nhưng giả ĐÚNG cách gh thật chọn repo.
Bài học T-118/T-119: eval tầng 1 (check_9) chạy bước cổng với `gh` giả không quan tâm cwd, nên không thấy được:
  gh thật (đã kiểm gh 2.89.0) xác định repo từ remote git của THƯ MỤC HIỆN TẠI hoặc biến GH_REPO (hoặc --repo). Ngoài một repo git và không GH_REPO, mọi lệnh
  `gh pr list/view/edit` thoát 1 với "failed to run git: fatal: not a git repository". Trên runner, bước "Cổng" chạy TRƯỚC mọi checkout ở $GITHUB_WORKSPACE rỗng,
  và bước "Dựng lại body PR" chạy ở $GITHUB_WORKSPACE (chứa code/ và data/ nhưng bản thân không phải repo git). GitHub Actions KHÔNG tự đặt GH_REPO.
Mong (spec T-126 Hành vi 6, tiêu chí 9):
  (1) mọi bước thoát 0 với pr_branch hợp lệ có đúng một PR mở; (2) nhánh PR trên origin tiến đúng MỘT commit, chỉ đổi file dữ liệu dưới tools/scraper/output/HCMC/,
  `main` không đổi; (3) vendor 0 đánh giá đọc mới bị hạ, vendor 5 đánh giá giữ; (4) `gh pr edit` được gọi, body mới giữ mọi dòng body cũ (kể cả ký tự đặc biệt) và có mục
  "## Vendor bị hạ vì ít đánh giá Google (T-126)" với "Tổng: 1 vendor"; (5) chạy lần hai: không commit mới, mọi bước thoát 0, body không nhân đôi mục T-126.
  (B) nhánh PR dữ liệu hợp lệ khác (refresh-photos/run-2) không có vendor nào cần hạ, không có raw_vendors.json/name-match-accepted.csv: mọi bước thoát 0, không commit.
  Lỗi thứ hai (thấy khi đã đặt GH_REPO): `git add -- '<glob 1>' ... '<glob 5>'` thoát 128 "pathspec ... did not match any files" khi MỘT trong năm mẫu không khớp file nào
  (vd lần 2 sau khi name-match-accepted.csv cuối cùng bị xoá vì rỗng, hay nhánh không có sổ đó), nên nhánh "Không có thay đổi dữ liệu" không bao giờ tới được.
  (C, tuỳ chọn ADV02_REAL_REF) dữ liệu thật PR #83: 1 commit chỉ dữ liệu, body "Tổng: 23 vendor".
Đã kiểm eval xanh trên bản sửa thử (GH_REPO ở env job + `git ls-files -z -m -o -d --exclude-standard -- <mẫu> | xargs -0 -r git add --`; INV-030 vẫn xanh).
Bước `uses:` được giả lập: actions/checkout = git clone nhánh `ref` vào `path` (remote origin = bare); setup-python bỏ qua; pip install bỏ qua (dùng python hiện có).
Không mạng, không Google (HTTPS_PROXY trỏ cổng chết). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, shutil, subprocess, sys, tempfile
import yaml
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-126"))
import _t126 as k
t = k.t
repo = t.c.tohong()
wfp = os.path.join(repo, ".github", "workflows", "apply-review-rule.yml")
if not os.path.isfile(wfp):
    print("FAIL thiếu apply-review-rule.yml"); sys.exit(1)
wf = yaml.safe_load(open(wfp, encoding="utf-8"))
job = next(iter(wf["jobs"].values()))
steps = job["steps"]
JOB_ENV = {**(wf.get("env") or {}), **(job.get("env") or {})}
BR = "enrich-vendors/run-1"
tmp = tempfile.mkdtemp(prefix="t127-adv02-")
G = lambda *a, cwd=None: subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True)  # noqa: E731
GENV = {"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
os.environ.update(GENV)
bare = os.path.join(tmp, "origin.git")
head = G("rev-parse", "HEAD", cwd=repo).stdout.strip()
r = G("clone", "-q", "--bare", "--shared", repo, bare)
if r.returncode:
    print("FAIL không dựng được origin bare: %s" % r.stderr[-200:]); sys.exit(1)
G("update-ref", "refs/heads/main", head, cwd=bare)
# PR dữ liệu: cây của main + output/HCMC fixture (đọc mới: i0 có 0 đánh giá -> hạ; i5 có 5 -> giữ)
seedc = os.path.join(tmp, "seed")
G("clone", "-q", "--branch", "main", bare, seedc)
A = k.ADDR
files = {"makeup": [k.matched("t127_i0", "Input Zero Makeup", A % 90, "makeup", "Pi0", k.NEW_TS, None), k.matched("t127_i5", "Input Five Makeup", A % 91, "makeup", "Pi5", k.NEW_TS, 5)]}
fx = k.seed(files)
dst = os.path.join(seedc, "tools", "scraper", "output", "HCMC")
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(fx.out, dst)
shutil.copy(os.path.join(dst, "makeup", "vendors.json"), os.path.join(dst, "makeup", "raw_vendors.json"))   # như #83: mỗi category có raw_vendors.json
open(os.path.join(dst, "makeup", "name-match-accepted.csv"), "w", encoding="utf-8").write("\ufeffid,name\n")   # như #83: có name-match-accepted.csv
G("checkout", "-q", "-b", BR, cwd=seedc)
G("add", "-A", "tools/scraper/output", cwd=seedc)
G("commit", "-qm", "chore(vendors): fixture PR dữ liệu", cwd=seedc)
if G("push", "-q", "origin", BR, cwd=seedc).returncode:
    print("FAIL không đẩy được nhánh PR fixture"); sys.exit(1)
pr_head0 = G("rev-parse", BR, cwd=bare).stdout.strip()
# gh giả: chọn repo như gh thật (GH_REPO / --repo / remote git của cwd), rồi pr list|view|edit
bind = os.path.join(tmp, "bin"); os.makedirs(bind)
state = os.path.join(tmp, "ghstate"); os.makedirs(state)
BODY0 = ("## Báo cáo theo category\n\n| category | processed |\n| --- | --- |\n| makeup | 2 |\n\nLệnh: `python enrich.py --restore marry_x` ; $(echo không chạy) & \"ngoặc\" \\ gạch\n"
         "Tiếng Việt có dấu: Thiệp cưới thơm, La Petite Épicerie\n\n## Vendor nhận theo tên (không khớp địa chỉ): 1\n\n| id | tên |\n| --- | --- |\n| a | b |\n\n"
         "## Vendor bị gỡ vì không có trên Google Maps (REMOVED_VENDOR): 0\n\n## Sau khi merge\n\n1. tạo pool\n")
open(os.path.join(state, "body.md"), "w", encoding="utf-8").write(BODY0)
GH = r'''#!/usr/bin/env python3
import json, os, subprocess, sys
st = os.environ["FAKE_GH_STATE"]
a = sys.argv[1:]
open(os.path.join(st, "calls.log"), "a").write(json.dumps({"argv": a, "cwd": os.getcwd()}) + "\n")
repo = os.environ.get("GH_REPO") or ("--repo" in a or "-R" in a)
if not repo:
    r = subprocess.run(["git", "remote"], capture_output=True, text=True)
    if r.returncode != 0:
        print("failed to run git: fatal: not a git repository (or any of the parent directories): .git", file=sys.stderr); sys.exit(1)
    if not r.stdout.strip():
        print("no git remotes found", file=sys.stderr); sys.exit(1)
def opt(n):
    return a[a.index(n) + 1] if n in a else None
def out(obj):
    jq = opt("--jq")
    s = json.dumps(obj)
    if jq:
        s = subprocess.run(["jq", "-r", jq], input=s, capture_output=True, text=True).stdout
        sys.stdout.write(s)
    else:
        print(s)
if a[:2] == ["pr", "list"]:
    out([{"number": 7, "headRefName": opt("--head"), "isCrossRepository": False}] if opt("--head") == os.environ["FAKE_GH_BRANCH"] else [])
elif a[:2] == ["pr", "view"]:
    out({"body": open(os.path.join(st, "body.md"), encoding="utf-8").read()})
elif a[:2] == ["pr", "edit"]:
    open(os.path.join(st, "body.md"), "w", encoding="utf-8").write(open(opt("--body-file"), encoding="utf-8").read())
    open(os.path.join(st, "edits"), "a").write("1\n")
else:
    print("gh giả: lệnh lạ %r" % a, file=sys.stderr); sys.exit(1)
'''
open(os.path.join(bind, "gh"), "w").write(GH)
os.chmod(os.path.join(bind, "gh"), 0o755)
bad = []


def run_workflow(tag):
    ws = os.path.join(tmp, "ws-" + tag); os.makedirs(ws)
    rt = os.path.join(tmp, "rt-" + tag); os.makedirs(rt)
    summ = os.path.join(rt, "summary.md")
    env = {"PATH": bind + os.pathsep + os.environ["PATH"], "HOME": tmp, "GITHUB_WORKSPACE": ws, "RUNNER_TEMP": rt, "GITHUB_STEP_SUMMARY": summ,
           "FAKE_GH_STATE": state, "FAKE_GH_BRANCH": BR, "HTTPS_PROXY": "http://127.0.0.1:9", "HTTP_PROXY": "http://127.0.0.1:9", **GENV}
    failed = False
    for s in steps:
        name = s.get("name") or s.get("uses")
        if s.get("if") and "always()" not in str(s.get("if")) and failed:
            continue
        if failed and "always()" not in str(s.get("if", "")):
            continue
        senv = dict(env)
        for kk, vv in {**JOB_ENV, **(s.get("env") or {})}.items():
            vv = str(vv)
            if "github.event.inputs.pr_branch" in vv:
                vv = BR
            elif "github.repository" in vv:
                vv = "owner/tohong"
            elif "github.token" in vv:
                vv = "fake-token"
            senv[kk] = vv
        uses = str(s.get("uses", ""))
        if uses.startswith("actions/checkout"):
            w = s.get("with") or {}
            ref = str(w.get("ref", ""))
            ref = BR if "pr_branch" in ref else ref
            r = G("clone", "-q", "--branch", ref, bare, os.path.join(ws, w.get("path", ".")))
            rc, msg = r.returncode, r.stderr
        elif uses:
            rc, msg = 0, ""
        elif "pip install" in str(s.get("run", "")):
            rc, msg = 0, ""
        else:
            if "${{" in str(s["run"]):
                bad.append("[%s] bước %r còn nội suy ${{ }} trong run:" % (tag, name))
            cwd = os.path.join(ws, s.get("working-directory", "."))
            r = subprocess.run(["bash", "--noprofile", "--norc", "-e", "-c", s["run"]], cwd=cwd, env=senv, capture_output=True, text=True, timeout=1500)
            rc, msg = r.returncode, (r.stdout + r.stderr)
        if rc != 0:
            failed = True
            bad.append("[%s] bước %r thoát %d: %s" % (tag, name, rc, " / ".join(msg.strip().splitlines()[-2:])[:220]))
    return ws


ws1 = run_workflow("lan1")
pr_head1 = G("rev-parse", BR, cwd=bare).stdout.strip()
if G("rev-parse", "main", cwd=bare).stdout.strip() != head:
    bad.append("main trên origin bị đổi")
commits = G("rev-list", "%s..%s" % (pr_head0, pr_head1), cwd=bare).stdout.split()
if len(commits) != 1:
    bad.append("lần 1: nhánh PR mong tiến đúng 1 commit, thấy %d" % len(commits))
else:
    changed = G("diff", "--name-only", pr_head0, pr_head1, cwd=bare).stdout.split()
    stray = [p for p in changed if not p.startswith("tools/scraper/output/HCMC/")]
    if stray:
        bad.append("commit đổi file ngoài dữ liệu: %r" % stray[:5])
    vj = json.loads(G("show", "%s:tools/scraper/output/HCMC/makeup/vendors.json" % pr_head1, cwd=bare).stdout or "{}")
    vs = {v["id"]: v for v in vj.get("vendors", [])}
    if t.has_pid(vs.get("t127_i0", {})) or not t.has_pid(vs.get("t127_i5", {})):
        bad.append("dữ liệu sau workflow: mong i0 bị hạ, i5 giữ")
edits = len(open(os.path.join(state, "edits")).read().split()) if os.path.exists(os.path.join(state, "edits")) else 0
body1 = open(os.path.join(state, "body.md"), encoding="utf-8").read()
if edits != 1:
    bad.append("lần 1: mong `gh pr edit` đúng 1 lần, thấy %d" % edits)
else:
    lost = [l for l in BODY0.splitlines() if l.strip() and l not in body1.splitlines()]
    if lost:
        bad.append("body mới mất dòng của body cũ, vd %r" % lost[0][:80])
    if "## Vendor bị hạ vì ít đánh giá Google (T-126)" not in body1 or "Tổng: 1 vendor" not in body1:
        bad.append("body mới thiếu mục T-126 / 'Tổng: 1 vendor'")
if not bad:
    run_workflow("lan2")
    if G("rev-parse", BR, cwd=bare).stdout.strip() != pr_head1:
        bad.append("lần 2 (không còn gì để hạ) vẫn tạo commit mới")
    body2 = open(os.path.join(state, "body.md"), encoding="utf-8").read()
    if body2.count("## Vendor bị hạ vì ít đánh giá Google (T-126)") != 1:
        bad.append("lần 2: body có %d mục T-126 (mong 1)" % body2.count("## Vendor bị hạ vì ít đánh giá Google (T-126)"))
# Kịch bản B: nhánh PR dữ liệu hợp lệ khác (tiền tố refresh-photos/, cổng cho phép) không có vendor nào cần hạ và không có name-match-accepted.csv / raw_vendors.json.
# Mong: mọi bước thoát 0, không commit ("Không có thay đổi dữ liệu"), body giữ nguyên.
BR2 = "refresh-photos/run-2"
G("checkout", "-q", "-b", BR2, "main", cwd=seedc)
shutil.rmtree(dst, ignore_errors=True)
fx2 = k.seed({"makeup": [k.matched("t127_j5", "Jade Five Makeup", A % 92, "makeup", "Pj5", k.NEW_TS, 5)]})
shutil.copytree(fx2.out, dst)
G("add", "-A", "tools/scraper/output", cwd=seedc)
G("commit", "-qm", "chore(vendors): fixture PR dữ liệu B", cwd=seedc)
G("push", "-q", "origin", BR2, cwd=seedc)
h2 = G("rev-parse", BR2, cwd=bare).stdout.strip()
BR = BR2
open(os.path.join(state, "body.md"), "w", encoding="utf-8").write(BODY0)
nb = len(bad)
run_workflow("B")
if G("rev-parse", BR2, cwd=bare).stdout.strip() != h2:
    bad.append("[B] nhánh không có gì để hạ vẫn bị commit")
# Kịch bản C (tuỳ chọn, ADV02_REAL_REF = commit nhánh PR #83 trong TOHONG_REPO, vd origin/enrich-vendors/run-43026321789): dữ liệu thật, mong commit chỉ dữ liệu, body "Tổng: 23 vendor".
real = os.environ.get("ADV02_REAL_REF")
if real:
    sha = G("rev-parse", real, cwd=repo).stdout.strip()
    G("fetch", "-q", repo, sha, cwd=bare)
    BR = "enrich-vendors/run-43026321789"
    G("update-ref", "refs/heads/" + BR, sha, cwd=bare)
    open(os.path.join(state, "body.md"), "w", encoding="utf-8").write(BODY0)
    run_workflow("C")
    h3 = G("rev-parse", BR, cwd=bare).stdout.strip()
    cs = G("rev-list", "%s..%s" % (sha, h3), cwd=bare).stdout.split()
    ch = G("diff", "--name-only", sha, h3, cwd=bare).stdout.split()
    if len(cs) != 1 or [p_ for p_ in ch if not p_.startswith("tools/scraper/output/HCMC/")]:
        bad.append("[C] mong 1 commit chỉ dữ liệu, thấy %d commit, file ngoài dữ liệu %r" % (len(cs), [p_ for p_ in ch if not p_.startswith("tools/scraper/output/HCMC/")][:3]))
    if "Tổng: 23 vendor" not in open(os.path.join(state, "body.md"), encoding="utf-8").read():
        bad.append("[C] body #83 mong 'Tổng: 23 vendor'")
    print("C: %d file dữ liệu đổi" % len(ch))
shutil.rmtree(tmp, ignore_errors=True)
t.done(bad, "apply-review-rule.yml chạy nguyên văn từng bước trên repo git thật: cổng, 2 checkout, áp luật offline, commit chỉ dữ liệu lên nhánh PR, dựng lại body; lần 2 idempotent")
