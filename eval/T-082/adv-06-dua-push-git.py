#!/usr/bin/env python3
"""T-082 adv-06 (tầng 3, spec B2/B3, git thật với bare repo cục bộ, không mạng).
 (i)  main bị chen ở MỌI lần push (6 lần) -> thoát khác 0 sau 5 lần, main không có decided của bình luận này.
 (ii) cái chen vào là Capu quyết CÙNG việc qua chat -> lần thử lại thấy việc không còn escalated: verdict rejected
      not_escalated, trên main decided của việc đúng 1, không commit của /ok.
 (iii) hai bản chạy song song (hai clone, hai việc, hai issue) -> cả hai decided, lịch sử tuyến tính, không id trùng."""
import os, subprocess, sys, pathlib, tempfile, shutil, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-079"))
from _lib import Box, payload
def _h(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _h
fails = []
def g(cwd, *a, check=True):
    r = subprocess.run(["git", "-c", "user.name=s", "-c", "user.email=s@x", *a], cwd=cwd, capture_output=True, text=True)
    if check: assert r.returncode == 0, f"git {a}: {r.stderr}"
    return r.stdout.strip()
def setup():
    B = Box(); t = pathlib.Path(tempfile.mkdtemp())
    home = t / "home"; home.mkdir()
    B.env.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
    os.environ.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
    B.new(issue=7); B.new(issue=8)
    origin = t / "origin.git"; g(t, "init", "-q", "--bare", "-b", "main", str(origin))
    g(B.tmp, "init", "-q", "-b", "main"); g(B.tmp, "add", "-A"); g(B.tmp, "commit", "-q", "-m", "seed")
    g(B.tmp, "remote", "add", "origin", str(origin)); g(B.tmp, "push", "-q", "origin", "main")
    other = t / "other"; g(t, "clone", "-q", str(origin), str(other))
    return B, t, origin, other
def events_on(origin):
    return [json.loads(l) for l in g(origin, "show", "main:ledger/events.jsonl").splitlines() if l.strip()]
def run(B, p, cwd=None):
    f = (cwd or B.tmp) / f"payload-{p['comment']['id']}.json"; f.write_text(json.dumps(p, ensure_ascii=False))
    env = dict(B.env, TOHONG_ROOT=str(cwd or B.tmp))
    return subprocess.run([sys.executable, "-I", "scripts/ok_issue.py", "--event", str(f), "--git"], cwd=cwd or B.tmp,
                          env=env, capture_output=True, text=True, timeout=120)
PY = sys.executable
# (i)
B, t, origin, other = setup()
try:
    hook = B.tmp / ".git/hooks/pre-push"
    hook.write_text(f"#!/bin/sh\ncd '{other}' && git pull -q --ff-only origin main && echo x >> chen.txt && git add chen.txt && "
                    f"git -c user.name=b -c user.email=b@x commit -q -m chen && git push -q origin HEAD:main\nexit 0\n")
    hook.chmod(0o755)
    r = run(B, payload("/ok chọn A", issue=7, cid=2001))
    dec = [e for e in events_on(origin) if e.get("event") == "decided"]
    if r.returncode == 0: fails.append(f"(i) bị chen mãi mà vẫn thoát 0: {r.stdout[-200:]}")
    if dec: fails.append("(i) main có decided dù không đẩy được")
    n = int(g(origin, "rev-list", "--count", "main"))
    if n > 1 + 6: fails.append(f"(i) quá 5 lần thử ({n - 1} commit chen)")
finally:
    B.close(); shutil.rmtree(t, ignore_errors=True)
# (ii)
B, t, origin, other = setup()
try:
    flag = t / "raced"; hook = B.tmp / ".git/hooks/pre-push"
    hook.write_text(f"#!/bin/sh\nif [ ! -e '{flag}' ]; then : > '{flag}'; cd '{other}' && export TOHONG_ROOT='{other}' && "
                    f"{PY} scripts/task.py decide T-001 --note 'quyết qua chat' >/dev/null && git add -A && "
                    f"git -c user.name=b -c user.email=b@x commit -q -m '[T-001] chat' && git push -q origin HEAD:main; fi\nexit 0\n")
    hook.chmod(0o755)
    r = run(B, payload("/ok chọn A", issue=7, cid=2002))
    out = json.loads([l for l in r.stdout.splitlines() if l.strip()][-1]) if r.returncode == 0 else {}
    dec = [e for e in events_on(origin) if e.get("event") == "decided" and e["task"] == "T-001"]
    if len(dec) != 1: fails.append(f"(ii) decided T-001 trên main phải 1, có {len(dec)}")
    if out.get("verdict") != "rejected" or out.get("reason") != "not_escalated":
        fails.append(f"(ii) verdict={out.get('verdict')}/{out.get('reason')} rc={r.returncode}")
finally:
    B.close(); shutil.rmtree(t, ignore_errors=True)
# (iii)
B, t, origin, other = setup()
try:
    f1 = B.tmp / "p1.json"; f1.write_text(json.dumps(payload("/ok chọn A", issue=7, cid=2003)))
    f2 = other / "p2.json"; f2.write_text(json.dumps(payload("/ok chọn B", issue=8, cid=2004)))
    ps = [subprocess.Popen([PY, "-I", "scripts/ok_issue.py", "--event", str(f), "--git"], cwd=d, env=dict(B.env, TOHONG_ROOT=str(d)),
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for f, d in ((f1, B.tmp), (f2, other))]
    res = [p.communicate(timeout=120) + (p.returncode,) for p in ps]
    ev = events_on(origin)
    dec = sorted(e["task"] for e in ev if e.get("event") == "decided")
    if dec != ["T-001", "T-002"]: fails.append(f"(iii) decided trên main = {dec}; rc={[r[2] for r in res]} err={[r[1][-150:] for r in res]}")
    if len({e['id'] for e in ev}) != len(ev): fails.append("(iii) id sự kiện trùng")
    if g(origin, "rev-list", "--merges", "--count", "main") != "0": fails.append("(iii) có merge commit")
finally:
    B.close(); shutil.rmtree(t, ignore_errors=True)
assert not fails, "\n".join(fails)
print("PASS đua push: hết lượt thì đỏ không ghi, chen bằng chat thì từ chối, song song thì cả hai ghi tuyến tính")
