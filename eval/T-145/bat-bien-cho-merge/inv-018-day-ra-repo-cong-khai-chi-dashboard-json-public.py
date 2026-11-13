#!/usr/bin/env python3
"""Nguồn: T-145 (spec products/T-145-dashboard-doc-repo-cong-khai.md v3, mục "Bất biến đề xuất"; ADR-080), spec-critic rút ở Spec Gate 2026-11-13 (sau D1, D2).
INV-018 (hq/dashboard) · Mọi bước workflow có env lấy secrets.DASHBOARD_DATA_TOKEN (đẩy dữ liệu sang repo công khai phungrk/tohong-hq-dashboard):
  (a) thiếu secret (rỗng hoặc không đặt): bước xanh, in dòng ::warning::, không gọi git push, repo đích không đổi;
  (b) có secret: bước xanh; sau bước, repo đích chỉ có thêm refs/heads/dashboard-data, cây đúng một file dashboard.json giống từng byte
      output `export_dashboard.py --public` của bước xuất trong cùng job (public:true, sự kiện không detail/link); main giữ nguyên SHA;
      token không xuất hiện trong stdout/stderr;
  (c) có secret mà git push lỗi: bước đỏ, token không lộ.
Đo bằng git THẬT trên bare repo cục bộ (URL đẩy chuyển qua url.insteadOf; mọi URL mạng khác trỏ vào chỗ không tồn tại, GIT_SSH_COMMAND=false):
không mạng, không ghi vào git của tohong-hq. Chạy nguyên văn run: với shell GitHub dùng cho bước (không khai shell → bash -e, không pipefail).
Chưa có bước nào dùng DASHBOARD_DATA_TOKEN → PASS "chưa áp dụng".
Gốc HQ: dò ngược từ file này tới thư mục có scripts/gate.py (chạy được từ cwd bất kỳ, không cần biến môi trường).
Chạy: python3 -I <file này>"""
import json, os, pathlib, shutil, stat, subprocess, sys, tempfile
sys.dont_write_bytecode = True
try:
    import yaml
except ImportError:
    print("ERROR thiếu PyYAML"); sys.exit(2)

here = pathlib.Path(__file__).resolve().parent
ROOT = next((p for p in [here, *here.parents] if (p / "scripts" / "gate.py").is_file()), None)
if ROOT is None: print("ERROR không dò được gốc HQ (scripts/gate.py)"); sys.exit(2)
GIT = shutil.which("git")
if not GIT: print("ERROR thiếu git"); sys.exit(2)
TOKEN = "gh" + "p_" + "INVTEST" * 6          # ghép lúc chạy: nguồn không khớp mẫu _shared/inv-001
TARGET = "https://x-access-token:" + TOKEN + "@github.com/phungrk/tohong-hq-dashboard"
NET = ["https://", "http://", "ssh://", "git://", "git@github.com:"]
WRAP = '''#!/usr/bin/env python3
import json, os, sys
a = sys.argv[1:]; i = 0
while i < len(a) and a[i].startswith("-"):
    i += 2 if a[i] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env") else 1
sub = a[i] if i < len(a) else ""
open(os.environ["INV_GIT_LOG"], "a").write(json.dumps(sub) + "\\n")
if sub and sub == os.environ.get("INV_GIT_FAIL"):
    sys.stderr.write("fatal: giả lập lỗi\\n"); sys.exit(1)
os.execv(os.environ["INV_REAL_GIT"], [os.environ["INV_REAL_GIT"]] + a)
'''
SEED = {"GIT_AUTHOR_NAME": "s", "GIT_AUTHOR_EMAIL": "s@example.invalid", "GIT_COMMITTER_NAME": "s", "GIT_COMMITTER_EMAIL": "s@example.invalid"}


def shell(wf, job, st, script):
    sh = st.get("shell") or ((job.get("defaults") or {}).get("run") or {}).get("shell") or ((wf.get("defaults") or {}).get("run") or {}).get("shell")
    if sh == "bash": return ["bash", "--noprofile", "--norc", "-eo", "pipefail", script]
    if sh is None: return ["bash", "-e", script]
    return None


class Box:
    def __init__(self):
        self.t = pathlib.Path(tempfile.mkdtemp(prefix="inv018-"))
        b = self.t / "bin"; b.mkdir(); g = b / "git"; g.write_text(WRAP); g.chmod(g.stat().st_mode | stat.S_IEXEC)
        for d in ("home", "runner", "remote", "seed"): (self.t / d).mkdir()
        self.bare = self.t / "remote" / "dash.git"; self.log = self.t / "git.log"
        self.g("init", "-q", "--bare", "-b", "main", str(self.bare))
        w = self.t / "seed"; self.g("init", "-q", "-b", "main", cwd=w); (w / "index.html").write_text("x\n")
        self.g("add", "-A", cwd=w); self.g("commit", "-qm", "seed", cwd=w, env=SEED); self.g("push", "-q", str(self.bare), "main", cwd=w)
        os.symlink(self.bare, self.t / "remote" / "dash")
        self.main = self.g("rev-parse", "refs/heads/main", cwd=self.bare)

    def g(self, *a, cwd=None, env=None, raw=False):
        e = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": str(self.t / "home"), "GIT_CONFIG_NOSYSTEM": "1"}; e.update(env or {})
        r = subprocess.run([GIT, *a], cwd=cwd, env=e, capture_output=True)
        return r.stdout if raw else r.stdout.decode("utf-8", "replace").strip()

    def env(self, st, token, fail=None):
        e = {"PATH": f"{self.t / 'bin'}:{os.environ.get('PATH', '/usr/bin:/bin')}", "HOME": str(self.t / "home"), "RUNNER_TEMP": str(self.t / "runner"),
             "GITHUB_SHA": "0" * 40, "GITHUB_REPOSITORY": "phungrk/tohong-hq", "GITHUB_WORKSPACE": str(ROOT), "GITHUB_REF": "refs/heads/main",
             "CI": "true", "GITHUB_ACTIONS": "true", "INV_GIT_LOG": str(self.log), "INV_REAL_GIT": GIT, "GIT_CONFIG_NOSYSTEM": "1",
             "GIT_TERMINAL_PROMPT": "0", "GIT_SSH_COMMAND": "false", "GIT_ASKPASS": "false",
             "GIT_CONFIG_KEY_0": "user.useConfigOnly", "GIT_CONFIG_VALUE_0": "true",
             "GIT_CONFIG_KEY_1": f"url.{self.t}/remote/dash.insteadOf", "GIT_CONFIG_VALUE_1": TARGET}
        for n, p in enumerate(NET):
            e[f"GIT_CONFIG_KEY_{2 + n}"] = f"url.{self.t}/remote/khong-co/.insteadOf"; e[f"GIT_CONFIG_VALUE_{2 + n}"] = p
        e["GIT_CONFIG_COUNT"] = str(2 + len(NET))
        if fail: e["INV_GIT_FAIL"] = fail
        if token is not None:
            for k, v in (st.get("env") or {}).items():
                if "secrets.DASHBOARD_DATA_TOKEN" in str(v): e[k] = token
        return e

    def run(self, argv_fn, st, env):
        s = self.t / "step.sh"; s.write_text(st.get("run", ""))
        argv = argv_fn(str(s))
        return subprocess.run(argv, cwd=ROOT, env=env, capture_output=True, text=True, timeout=180)

    def reset(self):
        if self.log.exists(): self.log.unlink()
        for r in self.g("for-each-ref", "--format=%(refname)", cwd=self.bare).split():
            if r != "refs/heads/main": self.g("update-ref", "-d", r, cwd=self.bare)

    def refs(self):
        return dict(reversed(l.split()) for l in self.g("for-each-ref", "--format=%(objectname) %(refname)", cwd=self.bare).splitlines())

    def subs(self):
        return [json.loads(l) for l in self.log.read_text().splitlines()] if self.log.exists() else []


bad, n = [], 0
for f in sorted((ROOT / ".github" / "workflows").glob("*.y*ml")):
    wf = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
    for jid, job in (wf.get("jobs") or {}).items():
        steps = job.get("steps") or []
        for i, st in enumerate(steps):
            if "secrets.DASHBOARD_DATA_TOKEN" not in json.dumps(st.get("env") or {}): continue
            n += 1; where = f"{f.name}:{jid}/{st.get('name') or i}"
            exp = [s for s in steps[:i] if "export_dashboard.py" in str(s.get("run", ""))]
            if not exp: bad.append(f"{where}: không có bước export_dashboard.py trước bước đẩy"); continue
            if "--public" not in str(exp[-1].get("run", "")): bad.append(f"{where}: bước xuất trước đó không dùng --public"); continue
            if shell(wf, job, st, "x") is None: bad.append(f"{where}: shell lạ"); continue
            bx = Box()
            try:
                r = bx.run(lambda s: shell(wf, job, exp[-1], s), exp[-1], bx.env(st, None))
                out = bx.t / "runner" / "out" / "dashboard.json"
                if r.returncode != 0 or not out.is_file(): bad.append(f"{where}: bước xuất lỗi"); continue
                pub = out.read_bytes()
                for label, tok in (("secret rỗng", ""), ("không đặt secret", None)):
                    bx.reset(); r = bx.run(lambda s: shell(wf, job, st, s), st, bx.env(st, tok))
                    if r.returncode != 0: bad.append(f"{where}: {label} → thoát {r.returncode}")
                    if "::warning::" not in "\n".join(l[:11] for l in (r.stdout + "\n" + r.stderr).splitlines()): bad.append(f"{where}: {label} → thiếu ::warning::")
                    if "push" in bx.subs(): bad.append(f"{where}: {label} → vẫn git push")
                    if bx.refs() != {"refs/heads/main": bx.main}: bad.append(f"{where}: {label} → repo đích đổi")
                bx.reset(); r = bx.run(lambda s: shell(wf, job, st, s), st, bx.env(st, TOKEN))
                if r.returncode != 0: bad.append(f"{where}: có secret → thoát {r.returncode}: {r.stderr.replace(TOKEN, '***')[-160:]}")
                if TOKEN in r.stdout + r.stderr: bad.append(f"{where}: token lộ trong log")
                refs = bx.refs()
                if refs.get("refs/heads/main") != bx.main: bad.append(f"{where}: main của repo đích đổi")
                if set(refs) - {"refs/heads/main", "refs/heads/dashboard-data"}: bad.append(f"{where}: ref lạ {sorted(set(refs) - {'refs/heads/main', 'refs/heads/dashboard-data'})}")
                if "refs/heads/dashboard-data" not in refs: bad.append(f"{where}: không có refs/heads/dashboard-data")
                else:
                    names = bx.g("ls-tree", "-r", "--name-only", "refs/heads/dashboard-data", cwd=bx.bare).splitlines()
                    if names != ["dashboard.json"]: bad.append(f"{where}: dashboard-data có {names}")
                    else:
                        blob = bx.g("cat-file", "blob", "refs/heads/dashboard-data:dashboard.json", cwd=bx.bare, raw=True)
                        if blob != pub: bad.append(f"{where}: dashboard.json khác output --public")
                        d = json.loads(blob)
                        if d.get("public") is not True: bad.append(f"{where}: public không phải true")
                        if any("detail" in e or "link" in e for e in d.get("events", [])): bad.append(f"{where}: sự kiện còn detail/link")
                bx.reset(); r = bx.run(lambda s: shell(wf, job, st, s), st, bx.env(st, TOKEN, fail="push"))
                if r.returncode == 0: bad.append(f"{where}: git push lỗi mà bước xanh")
                if TOKEN in r.stdout + r.stderr: bad.append(f"{where}: token lộ khi push lỗi")
            finally:
                shutil.rmtree(bx.t, ignore_errors=True)
if not n: print("PASS chưa áp dụng: không bước nào dùng secrets.DASHBOARD_DATA_TOKEN"); sys.exit(0)
if bad: print("FAIL " + " | ".join(bad)); sys.exit(1)
print(f"PASS {n} bước đẩy ra repo công khai: chỉ dashboard.json bản --public lên dashboard-data, main không đổi, thiếu secret xanh + ::warning::")
