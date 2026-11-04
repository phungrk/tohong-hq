"""Mở rộng _advlib cho T-063: GitHub giả có thể trả lỗi theo issue/method, đếm số lần (fails.json).
FAKE_FAIL = JSON list: {"issue": "8", "method": "PATCH"|"*", "code": 500, "times": n (-1 = mãi)}.
Comment seed có thể mang user tuỳ ý (login/type) để thử luật tác giả marker. Không gọi mạng."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _advlib import Ledger as _L, RUNNER, posted, patched  # noqa: F401

FAIL_HOOK = r'''
_fails = json.loads(os.environ.get("FAKE_FAIL", "[]"))
_cnt_f = os.path.join(st, "fails.json")
_orig = fake
def fake(req, timeout=None):
    mm = re.search(r"/issues/(\d+)", req.full_url)
    n = mm.group(1) if mm else ""
    cnt = json.load(open(_cnt_f)) if os.path.exists(_cnt_f) else {}
    for i, f in enumerate(_fails):
        if f["issue"] == n and f.get("method", "*") in ("*", req.get_method()):
            used = cnt.get(str(i), 0)
            if f.get("times", -1) < 0 or used < f["times"]:
                cnt[str(i)] = used + 1; json.dump(cnt, open(_cnt_f, "w"))
                calls.append({"method": req.get_method(), "url": req.full_url, "body": None, "failed": f.get("code", 500)})
                json.dump(calls, open(os.path.join(st, "calls.json"), "w"), ensure_ascii=False)
                raise urllib.error.HTTPError(req.full_url, f.get("code", 500), "x", {}, io.BytesIO(b'{"message":"boom"}'))
    return _orig(req, timeout)
urllib.request.urlopen = fake
'''

class Ledger(_L):
    def __init__(self, fail=None, **env):
        super().__init__()
        runner = RUNNER.replace("urllib.request.urlopen = fake\n", "urllib.request.urlopen = fake\n" + FAIL_HOOK, 1)
        (self.tmp / "runner.py").write_text(runner)
        self.env["FAKE_FAIL"] = json.dumps(fail or [])
        self.env.pop("MIRROR_AUTHOR", None)
        self.env.update(env)

    def reset_calls(self):
        p = self.tmp / "gh" / "calls.json"
        if p.exists():
            p.unlink()

def new(L, n, issue, tier="B"):
    L.task("new", "--title", f"t{n}", "--to", "engineering", "--tier", tier, "--area", "hq/ledger", "--issue", str(issue),
           "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
