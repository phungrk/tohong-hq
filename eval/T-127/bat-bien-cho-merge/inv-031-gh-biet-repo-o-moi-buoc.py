#!/usr/bin/env python3
"""Nguồn: T-127 Code Gate (adversary, 2026-11-11), eval/T-127/adv-02: bước "Cổng" và "Dựng lại body PR" của apply-review-rule.yml gọi `gh pr ...` ở thư mục không phải repo git,
không GH_REPO: gh thật (2.89.0, đã kiểm) thoát 1 "failed to run git: fatal: not a git repository", nên workflow không bao giờ chạy được, dù check_9 (gh giả bỏ qua cwd) xanh.
Cùng họ lỗi với T-118/T-119 (workflow qua gate nhưng hỏng khi chạy thật). Chờ PR code T-127 sửa và merge (ADR-028), Chief of Staff đưa vào eval/invariants/planner/vendor/images/.
INV-031 (planner/vendor/images) · Mọi lệnh `gh` (trừ `gh api`) trong workflow biết repo nào: chạy trong thư mục của một checkout, hoặc có GH_REPO, hoặc --repo/-R.
Với mọi file .github/workflows/*.yml|yaml của repo tohong, mọi job, mọi bước có `run:` chứa lệnh `gh <lệnh con>` (không tính `gh api`):
  thư mục chạy của bước (working-directory của bước, rồi defaults.run.working-directory của job/workflow, mặc định ".") phải nằm trong `path` của một bước actions/checkout
  ĐỨNG TRƯỚC nó trong cùng job (path mặc định "." bao mọi thư mục), HOẶC env của bước/job/workflow có GH_REPO, HOẶC chính dòng gh đó có --repo / -R.
Lý do: GitHub Actions không tự đặt GH_REPO; $GITHUB_WORKSPACE trước checkout (hay khi checkout vào thư mục con) không phải repo git.
Không mạng. Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Không thấy .github/workflows: PASS "chưa áp dụng". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import glob, os, re, sys
try:
    import yaml
except ImportError:  # pragma: no cover
    print("FAIL thiếu PyYAML"); sys.exit(1)
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 3))
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isdir(os.path.join(c, ".github", "workflows"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy .github/workflows của repo tohong)"); sys.exit(0)
GH = re.compile(r"(?:^|[\s;&|(`$])gh\s+(?!api\b)([a-z][a-z-]*)")
norm = lambda p: os.path.normpath(str(p or ".")).lstrip("./") if str(p or ".") not in (".", "./", "") else ""  # noqa: E731
bad, n = [], 0
for f in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    try:
        wf = yaml.safe_load(open(f, encoding="utf-8")) or {}
    except yaml.YAMLError as e:
        bad.append("%s: YAML hỏng (%s)" % (os.path.basename(f), str(e)[:60])); continue
    wenv = wf.get("env") or {}
    wwd = ((wf.get("defaults") or {}).get("run") or {}).get("working-directory")
    for jn, job in (wf.get("jobs") or {}).items():
        jenv = {**wenv, **(job.get("env") or {})}
        jwd = ((job.get("defaults") or {}).get("run") or {}).get("working-directory") or wwd
        checkouts = []
        for i, s in enumerate(job.get("steps") or []):
            if "actions/checkout" in str(s.get("uses", "")):
                checkouts.append(norm((s.get("with") or {}).get("path")))
                continue
            run = str(s.get("run") or "")
            lines = [l for l in run.splitlines() if GH.search(l) and not l.strip().startswith("#")]
            if not lines:
                continue
            n += len(lines)
            env = {**jenv, **(s.get("env") or {})}
            if "GH_REPO" in env:
                continue
            wd = norm(s.get("working-directory") or jwd)
            in_repo = any(c == "" or wd == c or wd.startswith(c + "/") for c in checkouts)
            for l in lines:
                if in_repo or re.search(r"\s(--repo|-R)(\s|=)", l):
                    continue
                bad.append("%s/%s bước %r: `%s` chạy ở %r, không trong checkout nào trước nó, không GH_REPO/--repo" % (
                    os.path.basename(f), jn, s.get("name") or i, l.strip()[:60], wd or "$GITHUB_WORKSPACE"))
if bad:
    print("FAIL %d lệnh gh không biết repo (gh thật thoát 1 'not a git repository'), vd: %s" % (len(bad), " | ".join(bad[:3]))); sys.exit(1)
print("PASS %d lệnh gh trong workflow đều biết repo (trong checkout, GH_REPO hoặc --repo)" % n)
