"""Hạ tầng chung cho eval đối kháng T-063: sổ cái giả (TOHONG_ROOT) + GitHub giả trong tiến trình.
Không gọi mạng: urllib.request.urlopen bị thay bằng bản giả, ghi lại mọi request vào calls.json."""
import json, os, subprocess, sys, tempfile, pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parents[2]

RUNNER = r'''
import json, os, re, sys, io, urllib.request, urllib.error
st = os.environ["FAKE_GH"]
comments = json.load(open(os.path.join(st, "comments.json"))) if os.path.exists(os.path.join(st, "comments.json")) else {}
calls = []
class R(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *a): return False
def fake(req, timeout=None):
    url = req.full_url; m = req.get_method()
    body = json.loads(req.data.decode()) if req.data else None
    calls.append({"method": m, "url": url, "body": body})
    json.dump(calls, open(os.path.join(st, "calls.json"), "w"), ensure_ascii=False)
    mm = re.fullmatch(r"https://api\.github\.com/repos/[^/]+/[^/]+/issues/(\d+)(/comments)?(\?.*)?", url)
    if not mm:
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, io.BytesIO(b'{"message":"Not Found"}'))
    n = mm.group(1)
    if m == "GET":
        return R(json.dumps(comments.get(n, [])).encode())
    if m == "POST" and mm.group(2):
        comments.setdefault(n, []).append({"body": body["body"], "user": {"login": "github-actions[bot]"}})
        json.dump(comments, open(os.path.join(st, "comments.json"), "w"), ensure_ascii=False)
    return R(b"{}")
urllib.request.urlopen = fake
sys.argv = ["mirror_issue.py"] + sys.argv[1:]
sys.path.insert(0, os.path.join(os.environ["TOHONG_ROOT"], "scripts"))
import runpy
runpy.run_path(os.path.join(os.environ["TOHONG_ROOT"], "scripts", "mirror_issue.py"), run_name="__main__")
'''

class Ledger:
    def __init__(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        for d in ("scripts", "templates"):
            shutil.copytree(ROOT / d, self.tmp / d)
        for d in ("board", "ledger", "eval", "handoffs", "products", "inbox/capu", "gh", "state"):
            (self.tmp / d).mkdir(parents=True)
        (self.tmp / "runner.py").write_text(RUNNER)
        self.env = dict(os.environ, TOHONG_ROOT=str(self.tmp), FAKE_GH=str(self.tmp / "gh"),
                        GH_TOKEN="fake", CAPU_LOGIN="capu-login", GITHUB_REPOSITORY="o/r")
        for k in [k for k in self.env if k.startswith("TOHONG_LIVE") or k in ("GITHUB_TOKEN", "BOT_LOGIN")]:
            del self.env[k]   # sổ cái giả không được đẩy sự kiện lên dashboard thật

    def task(self, *args, ok=True):
        r = subprocess.run([sys.executable, "scripts/task.py", *args], cwd=self.tmp, env=self.env,
                           capture_output=True, text=True)
        if ok:
            assert r.returncode == 0, f"task.py {args}: {r.stderr}{r.stdout}"
        return r

    def comments(self, data):
        (self.tmp / "gh" / "comments.json").write_text(json.dumps(data))

    def mirror(self):
        """Chạy mirror_issue.py 'thật' với GitHub giả. Trả (returncode, stdout+stderr, calls)."""
        r = subprocess.run([sys.executable, "-I", str(self.tmp / "runner.py"), "--state", str(self.tmp / "state")],
                           cwd=self.tmp, env=self.env, capture_output=True, text=True)
        cf = self.tmp / "gh" / "calls.json"
        calls = json.loads(cf.read_text()) if cf.exists() else []
        return r.returncode, r.stdout + r.stderr, calls

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

def posted(calls, issue):
    return [c["body"]["body"] for c in calls if c["method"] == "POST" and c["url"].endswith(f"/issues/{issue}/comments")]

def patched(calls, issue):
    return [c["body"] for c in calls if c["method"] == "PATCH" and c["url"].endswith(f"/issues/{issue}")]
