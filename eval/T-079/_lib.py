"""Hạ tầng chung eval T-079. Không mạng, không GitHub thật. Sổ cái giả qua TOHONG_ROOT.
Hợp đồng với script xử lý (Engineering làm): `python3 scripts/ok_issue.py --event <payload.json> [--git]`
 - đọc payload sự kiện issue_comment (đúng dạng GitHub gửi), in dòng JSON ra stdout (là dòng cuối cùng):
   {"verdict": "decided|rejected|duplicate|ignored", "task": "T-xxx hoặc rỗng", "reason": "<mã>", "reply": "<markdown hoặc rỗng>"}
 - mã thoát 0 cho cả bốn verdict; khác 0 chỉ khi hỏng thật.
 - biến môi trường: TOHONG_ROOT (sổ cái), OK_LOGIN (mặc định phungrk)."""
import json, os, subprocess, sys, tempfile, pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parents[2]


def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12]))
    sys.exit(1)
sys.excepthook = _hook
URL = "https://github.com/phungrk/tohong-hq/issues/{n}#issuecomment-{c}"


def payload(body, *, login="phungrk", utype="User", sender=None, sender_type=None, issue=7, cid=1001,
            action="created", pr=False, assoc="OWNER"):
    iss = {"number": issue, "state": "open", "title": "ý định", "body": "x"}
    if pr:
        iss["pull_request"] = {"url": "https://api.github.com/repos/phungrk/tohong-hq/pulls/%d" % issue}
    p = {"action": action, "issue": iss,
         "comment": {"id": cid, "html_url": URL.format(n=issue, c=cid), "body": body,
                     "user": {"login": login, "type": utype}, "author_association": assoc},
         "sender": {"login": sender or login, "type": sender_type or utype},
         "repository": {"full_name": "phungrk/tohong-hq"}}
    if action == "edited":
        p["changes"] = {"body": {"from": "cũ"}}
    return p


class Box:
    def __init__(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        for d in ("scripts", "templates"):
            shutil.copytree(ROOT / d, self.tmp / d, ignore=shutil.ignore_patterns("__pycache__"))
        for d in ("board", "ledger", "eval", "handoffs", "products", "inbox/capu"):
            (self.tmp / d).mkdir(parents=True)
        self.env = dict(os.environ, TOHONG_ROOT=str(self.tmp))
        for k in [k for k in self.env if k.startswith("TOHONG_LIVE") or k in ("GITHUB_TOKEN", "GH_TOKEN")]:
            del self.env[k]
        self.env.pop("OK_LOGIN", None)

    def task(self, *a, ok=True):
        r = subprocess.run([sys.executable, "scripts/task.py", *a], cwd=self.tmp, env=self.env, capture_output=True, text=True)
        if ok:
            assert r.returncode == 0, f"task.py {a}: {r.stderr}{r.stdout}"
        return r

    def new(self, issue=7, to="product", escalate=True, tier="C"):
        """Tạo việc (T-001, T-002...). escalate=True -> đang chờ Capu quyết, có Decision Request."""
        extra = ["--eval", "true"] if to == "engineering" else []
        a = ["new", "--title", "việc thử", "--to", to, "--tier", tier, "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff"] + extra
        if issue:
            a += ["--issue", str(issue)]
        self.task(*a)
        tid = sorted(p.stem for p in (self.tmp / "board").glob("T-*.md"))[-1]
        if escalate:
            f = f"inbox/capu/{tid}-thu.md"
            (self.tmp / f).write_text("---\ntype: decision-request\n---\nCần quyết: A hay B?\nPhương án A: làm ngay → nhanh\nPhương án B: để sau → chậm\nKhuyến nghị: A, vì nhanh\nNếu không quyết: đứng yên\n", encoding="utf-8")
            self.task("escalate", tid, "--by", "chief-of-staff", "--note", "A hay B?", "--link", f)
        return tid

    def events(self):
        p = self.tmp / "ledger" / "events.jsonl"
        return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] if p.exists() else []

    def snapshot(self):
        out = {}
        for sub in ("ledger", "board"):
            for f in sorted((self.tmp / sub).rglob("*")):
                if f.is_file():
                    out[str(f.relative_to(self.tmp))] = f.read_bytes()
        return out

    def state(self, tid):
        for l in (self.tmp / "board" / f"{tid}.md").read_text(encoding="utf-8").splitlines():
            if l.startswith("state:"):
                return l.split(":", 1)[1].strip()

    def ok(self, p, *extra, env=None):
        f = self.tmp / "payload.json"
        f.write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
        r = subprocess.run([sys.executable, "-I", "scripts/ok_issue.py", "--event", str(f), *extra], cwd=self.tmp,
                           env=dict(self.env, **(env or {})), capture_output=True, text=True)
        assert r.returncode == 0, f"ok_issue.py thoát {r.returncode}: {r.stderr}{r.stdout}"
        lines = [l for l in r.stdout.splitlines() if l.strip()]
        assert lines, "stdout rỗng"
        out = json.loads(lines[-1])   # dòng JSON là dòng CUỐI (lệnh task.py bên trong có thể in thêm dòng trước đó)
        assert set(out) >= {"verdict", "task", "reason", "reply"}, out
        return out

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
