#!/usr/bin/env python3
"""Thư viện dùng chung của eval T-145 (không phải eval). Chạy NGUYÊN VĂN bước `run:` của workflow publish-dashboard-data.yml
bằng GIT THẬT, chỉ chuyển hướng URL đẩy `https://x-access-token:<token>@github.com/phungrk/tohong-hq-dashboard(.git)` sang một bare repo cục bộ
(GIT_CONFIG_COUNT, url.<bare>.insteadOf; mọi URL https khác trỏ vào chỗ không tồn tại nên push hỏng). Rồi đo trên ref đích của bare repo.
Một wrapper mỏng quanh git thật ghi argv và tiêm lỗi (FAKE_GIT_FAIL=<lệnh con>). HOME giả KHÔNG có user.name/user.email và đặt user.useConfigOnly.
Không mạng, không ghi vào repo hay git của tohong-hq."""
import json, os, pathlib, shutil, stat, subprocess, sys, tempfile
sys.dont_write_bytecode = True
import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WF = pathlib.Path(os.environ.get("T145_WORKFLOW") or ROOT / ".github/workflows/publish-dashboard-data.yml")
# Token thử sinh lúc chạy: mã nguồn không chứa chuỗi khớp mẫu secret của _shared/inv-001
TOKEN = "gh" + "p_" + "FAKE" * 9
REAL_GIT = shutil.which("git")
WRAPPER = '''#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
i = 0
while i < len(args) and args[i].startswith("-"):      # bỏ tuỳ chọn toàn cục của git trước lệnh con
    i += 2 if args[i] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--super-prefix", "--config-env") else 1
sub = args[i] if i < len(args) else ""
with open(os.environ["FAKE_GIT_LOG"], "a") as fh:
    fh.write(json.dumps({"args": args, "sub": sub, "cwd": os.getcwd()}) + "\\n")
if sub and sub == os.environ.get("FAKE_GIT_FAIL"):
    sys.stderr.write("fatal: giả lập lỗi git %s\\n" % sub); sys.exit(1)
os.execv(os.environ["REAL_GIT"], [os.environ["REAL_GIT"]] + args)
'''
NET = ["https://", "http://", "ssh://", "git://", "git@github.com:"]
SEED_ENV = {"GIT_AUTHOR_NAME": "seed", "GIT_AUTHOR_EMAIL": "seed@example.invalid", "GIT_COMMITTER_NAME": "seed", "GIT_COMMITTER_EMAIL": "seed@example.invalid"}


def load():
    wf = yaml.safe_load(WF.read_text(encoding="utf-8"))
    job = next(iter(wf["jobs"].values()))
    return wf, job, job["steps"]


def find_steps(steps):
    exp = [s for s in steps if "export_dashboard.py" in str(s.get("run", ""))]
    push = [s for s in steps if "secrets.DASHBOARD_DATA_TOKEN" in json.dumps(s.get("env", {}) or {})]
    return exp, push


def shell_argv(wf, job, step, script):
    sh = step.get("shell") or (job.get("defaults", {}).get("run", {}) or {}).get("shell") or (wf.get("defaults", {}).get("run", {}) or {}).get("shell")
    if sh == "bash":
        return ["bash", "--noprofile", "--norc", "-eo", "pipefail", script]
    if sh is None:
        return ["bash", "-e", script]            # Linux, không khai shell: KHÔNG pipefail (docs GitHub)
    return None


class Sandbox:
    def __init__(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="t145-"))
        self.bin = self.tmp / "bin"; self.bin.mkdir()
        g = self.bin / "git"; g.write_text(WRAPPER); g.chmod(g.stat().st_mode | stat.S_IEXEC)
        (self.tmp / "home").mkdir(); (self.tmp / "runner").mkdir(); (self.tmp / "remote").mkdir()
        self.log = self.tmp / "git.log"
        self.bare = self.tmp / "remote" / "dash.git"
        self.wf, self.job, self.steps = load()
        self.exp, self.push = find_steps(self.steps)
        self.seed()

    def git(self, *a, cwd=None, raw=False, env=None):
        e = {"PATH": os.environ["PATH"], "HOME": str(self.tmp / "home"), "GIT_CONFIG_NOSYSTEM": "1"}; e.update(env or {})
        r = subprocess.run([REAL_GIT, *a], cwd=cwd, env=e, capture_output=True)
        return r.stdout if raw else r.stdout.decode("utf-8", "replace").strip()

    def seed(self):
        """Bare repo đích có sẵn nhánh main (một commit) để kiểm main không đổi."""
        self.git("init", "-q", "--bare", "-b", "main", str(self.bare))
        w = self.tmp / "seed"; w.mkdir()
        self.git("init", "-q", "-b", "main", cwd=w)
        (w / "index.html").write_text("trang\n")
        self.git("add", "-A", cwd=w); self.git("commit", "-q", "-m", "seed", cwd=w, env=SEED_ENV)
        self.git("push", "-q", str(self.bare), "main", cwd=w)
        os.symlink(self.bare, self.tmp / "remote" / "dash")      # URL không có .git cũng tới đúng bare repo
        self.main_sha = self.git("rev-parse", "refs/heads/main", cwd=self.bare)

    def env(self, token, fail=None):
        e = {"PATH": f"{self.bin}:{os.environ['PATH']}", "HOME": str(self.tmp / "home"), "RUNNER_TEMP": str(self.tmp / "runner"),
             "GITHUB_SHA": "0123456789abcdef0123456789abcdef01234567", "GITHUB_REPOSITORY": "phungrk/tohong-hq",
             "GITHUB_WORKSPACE": str(ROOT), "GITHUB_REF": "refs/heads/main", "CI": "true", "GITHUB_ACTIONS": "true",
             "FAKE_GIT_LOG": str(self.log), "REAL_GIT": REAL_GIT, "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0",
             "GIT_SSH_COMMAND": "false", "GIT_ASKPASS": "false", 
             "GIT_CONFIG_KEY_0": "user.useConfigOnly", "GIT_CONFIG_VALUE_0": "true",       # không đoán danh tính: bản thiếu git config phải lỗi như runner thật
             "GIT_CONFIG_KEY_1": f"url.{self.tmp}/remote/dash.insteadOf",
             "GIT_CONFIG_VALUE_1": f"https://x-access-token:{TOKEN}@github.com/phungrk/tohong-hq-dashboard"}
        for n, pre in enumerate(NET):                # mọi dạng URL mạng khác trỏ vào chỗ không tồn tại: không bao giờ ra mạng
            e[f"GIT_CONFIG_KEY_{2 + n}"] = f"url.{self.tmp}/remote/khong-co/.insteadOf"; e[f"GIT_CONFIG_VALUE_{2 + n}"] = pre
        e["GIT_CONFIG_COUNT"] = str(2 + len(NET))
        if fail: e["FAKE_GIT_FAIL"] = fail
        if token is not None:
            for k, v in (self.push[0].get("env") or {}).items():
                if "secrets.DASHBOARD_DATA_TOKEN" in str(v): e[k] = token
        return e

    def run_step(self, step, env):
        script = self.tmp / "step.sh"; script.write_text(step["run"])
        argv = shell_argv(self.wf, self.job, step, str(script))
        if argv is None: raise RuntimeError("shell lạ: " + str(step.get("shell")))
        return subprocess.run(argv, cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)

    def export(self):
        r = self.run_step(self.exp[0], self.env(None))
        if r.returncode != 0: raise RuntimeError("bước Xuất dữ liệu lỗi: " + r.stderr[-300:])
        return pathlib.Path(self.tmp / "runner" / "out" / "dashboard.json")

    def calls(self):
        if not self.log.exists(): return []
        return [json.loads(l) for l in self.log.read_text().splitlines() if l.strip()]

    def reset(self):
        """Đưa bare repo và log về trạng thái ban đầu giữa các ca."""
        if self.log.exists(): self.log.unlink()
        for ref in self.git("for-each-ref", "--format=%(refname)", cwd=self.bare).split():
            if ref != "refs/heads/main": self.git("update-ref", "-d", ref, cwd=self.bare)

    def refs(self):
        return {l.split()[1]: l.split()[0] for l in self.git("for-each-ref", "--format=%(objectname) %(refname)", cwd=self.bare).splitlines()}

    def target(self):
        """Nội dung ref đích: (danh sách file, {tên: bytes}, số commit)."""
        ref = "refs/heads/dashboard-data"
        if ref not in self.refs(): return None
        names = self.git("ls-tree", "-r", "--name-only", ref, cwd=self.bare).splitlines()
        blobs = {n: self.git("cat-file", "blob", f"{ref}:{n}", cwd=self.bare, raw=True) for n in names}
        return names, blobs, int(self.git("rev-list", "--count", ref, cwd=self.bare))

    def cleanup(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
