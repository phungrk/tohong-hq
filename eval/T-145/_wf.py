#!/usr/bin/env python3
"""Thư viện dùng chung của eval T-145 (không phải eval). Chạy NGUYÊN VĂN bước `run:` của workflow publish-dashboard-data.yml
với `git` giả (ghi lại lệnh, URL, nhánh, nội dung thư mục lúc push) và đúng shell mà GitHub Actions dùng cho bước đó.
Không mạng, không git thật, không ghi vào repo."""
import json, os, pathlib, re, shutil, stat, subprocess, sys, tempfile
import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WF = pathlib.Path(os.environ.get("T145_WORKFLOW") or ROOT / ".github/workflows/publish-dashboard-data.yml")
TOKEN = "ghp_FAKEtoken0123456789ABCDEFGHIJKLMNOPQRSTUV"   # chuỗi thử, không phải khóa thật
FAKE_GIT = r'''#!/usr/bin/env python3
import json, os, shutil, sys
log = os.environ["FAKE_GIT_LOG"]; snap = os.environ["FAKE_GIT_SNAP"]
args = sys.argv[1:]; cwd = os.getcwd(); eff = cwd; i = 0
while i < len(args) and args[i].startswith("-"):
    if args[i] == "-C" and i + 1 < len(args):
        eff = os.path.join(eff, args[i + 1]); i += 2
    elif args[i] == "-c": i += 2
    else: i += 1
sub = args[i] if i < len(args) else ""
files = {}
if sub == "push" and os.path.isdir(eff):
    for dp, dn, fn in os.walk(eff):
        dn[:] = [d for d in dn if d != ".git"]
        for f in fn:
            p = os.path.join(dp, f); files[os.path.relpath(p, eff)] = open(p, "rb").read().decode("utf-8", "replace")
with open(log, "a") as fh:
    fh.write(json.dumps({"args": args, "sub": sub, "cwd": cwd, "eff": eff, "files": files}) + "\n")
if sub and sub == os.environ.get("FAKE_GIT_FAIL"):
    sys.stderr.write("fatal: giả lập lỗi git %s\n" % sub); sys.exit(1)
sys.exit(0)
'''


def load():
    wf = yaml.safe_load(WF.read_text(encoding="utf-8"))
    job = next(iter(wf["jobs"].values()))
    return wf, job, job["steps"]


def find_steps(steps):
    exp = [s for s in steps if "export_dashboard.py" in str(s.get("run", ""))]
    push = [s for s in steps if "DASHBOARD_DATA_TOKEN" in json.dumps(s.get("env", {}) or {}) and "secrets.DASHBOARD_DATA_TOKEN" in json.dumps(s.get("env", {}) or {})]
    return exp, push


def shell_argv(wf, job, step, script):
    sh = step.get("shell") or (job.get("defaults", {}).get("run", {}) or {}).get("shell") or (wf.get("defaults", {}).get("run", {}) or {}).get("shell")
    if sh == "bash":
        return ["bash", "--noprofile", "--norc", "-eo", "pipefail", script]
    if sh is None:
        return ["bash", "-e", script]            # Linux, không khai shell: KHÔNG pipefail (docs GitHub)
    return None


class Sandbox:
    """Một lượt chạy: export --public thật (chỉ đọc sổ cái) → bước đẩy với git giả."""
    def __init__(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="t145-"))
        self.bin = self.tmp / "bin"; self.bin.mkdir()
        g = self.bin / "git"; g.write_text(FAKE_GIT); g.chmod(g.stat().st_mode | stat.S_IEXEC)
        (self.tmp / "home").mkdir(); (self.tmp / "runner").mkdir()
        self.log = self.tmp / "git.log"; self.snap = self.tmp / "snap"
        self.wf, self.job, self.steps = load()
        self.exp, self.push = find_steps(self.steps)

    def env(self, token, fail=None):
        e = {"PATH": f"{self.bin}:{os.environ['PATH']}", "HOME": str(self.tmp / "home"), "RUNNER_TEMP": str(self.tmp / "runner"),
             "GITHUB_SHA": "0123456789abcdef0123456789abcdef01234567", "GITHUB_REPOSITORY": "phungrk/tohong-hq",
             "GITHUB_WORKSPACE": str(ROOT), "GITHUB_REF": "refs/heads/main", "CI": "true", "GITHUB_ACTIONS": "true",
             "FAKE_GIT_LOG": str(self.log), "FAKE_GIT_SNAP": str(self.snap), "GIT_CONFIG_NOSYSTEM": "1"}
        if fail: e["FAKE_GIT_FAIL"] = fail
        if token is not None:
            for k, v in (self.push[0].get("env") or {}).items():
                if "secrets.DASHBOARD_DATA_TOKEN" in str(v): e[k] = token
        return e

    def run_step(self, step, env):
        script = self.tmp / "step.sh"; script.write_text(step["run"])
        argv = shell_argv(self.wf, self.job, step, str(script))
        if argv is None:
            raise RuntimeError("shell lạ: " + str(step.get("shell")))
        return subprocess.run(argv, cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)

    def export(self):
        r = self.run_step(self.exp[0], self.env(None))
        if r.returncode != 0:
            raise RuntimeError("bước Xuất dữ liệu lỗi: " + r.stderr[-300:])
        return pathlib.Path(self.tmp / "runner" / "out" / "dashboard.json")

    def calls(self):
        if not self.log.exists(): return []
        return [json.loads(l) for l in self.log.read_text().splitlines() if l.strip()]

    def reset_log(self):
        if self.log.exists(): self.log.unlink()

    def cleanup(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
