#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT (T-219, vùng planner/vendor; số do Chief đặt khi Spec Gate qua). Khoá Google/Gemini chỉ đi vào workflow qua `env:` bằng `${{ secrets.… }}`:
 (1) trong workflow tohong, GOOGLE_MAPS_API_KEY/GEMINI_API_KEY chỉ xuất hiện ở khoá env với giá trị `${{ secrets.<đúng tên> }}`; văn bản `run:` không `echo`/`printf` biến đó, không `set -x`, không `printenv`;
 (2) không file nào của tohong (tools/, .github/, src/ nếu có; bỏ qua test_*.py và testdata, là dữ liệu thử) chứa URL Google/Gemini có tham số `key=` hoặc `?key`; không chuỗi dạng khoá `AIza[0-9A-Za-z_-]{35}`.
Tĩnh, offline. Repo: $TOHONG_REPO hoặc ../tohong cạnh tohong-hq. Không thấy repo: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
import glob, os, re, sys
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML"); sys.exit(1)
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isdir(os.path.join(c, ".github", "workflows"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tohong/.github/workflows)"); sys.exit(0)
bad = []
KEYS = ("GOOGLE_MAPS_API_KEY", "GEMINI_API_KEY")
for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    n, wf = os.path.basename(p), yaml.safe_load(open(p, encoding="utf-8")) or {}
    envs = [("workflow", wf.get("env") or {})]
    for jn, j in (wf.get("jobs") or {}).items():
        envs.append((jn, j.get("env") or {}))
        for s in j.get("steps") or []:
            envs.append((str(s.get("name")), s.get("env") or {}))
            run = str(s.get("run") or "")
            if any(k in run for k in KEYS) and re.search(r"echo[^\n]*(%s)|printf[^\n]*(%s)" % ("|".join(KEYS), "|".join(KEYS)), run):
                bad.append("%s/%s: echo/printf khoá" % (n, s.get("name")))
            if re.search(r"set\s+-\w*x|printenv", run) and any(k in str(s.get("env") or {}) for k in KEYS):
                bad.append("%s/%s: set -x/printenv ở bước có khoá" % (n, s.get("name")))
    for where, e in envs:
        for k in KEYS:
            if k in e and not re.fullmatch(r"\$\{\{\s*secrets\.%s\s*\}\}" % k, str(e[k])):
                bad.append("%s/%s: %s không lấy từ secrets" % (n, where, k))
PAT = re.compile(r"(googleapis\.com[^\s\"']*[?&]key=|[?&]key=\$|AIza[0-9A-Za-z_-]{35})")
for root, dirs, fs in os.walk(repo):
    dirs[:] = [x for x in dirs if x not in (".git", "node_modules", "__pycache__", "output")]
    for f in fs:
        if not f.startswith("test_") and f.endswith((".py", ".yml", ".yaml", ".js", ".mjs", ".sh", ".md", ".json")) and os.path.getsize(os.path.join(root, f)) < 2_000_000:
            try:
                t = open(os.path.join(root, f), encoding="utf-8").read()
            except (OSError, UnicodeDecodeError):
                continue
            m = PAT.search(t)
            if m:
                bad.append("%s: chuỗi %r" % (os.path.relpath(os.path.join(root, f), repo), m.group(0)[:30]))
print(("FAIL " + "; ".join(bad[:6])) if bad else "PASS khoá chỉ qua env/secrets, không key= trong URL"); sys.exit(1 if bad else 0)
