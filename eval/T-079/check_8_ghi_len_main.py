#!/usr/bin/env python3
import sys
def _h(t,v,tb):
    print("FAIL "+" | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook=_h
"""T-079 tiêu chí 8: ghi sổ cái lên main an toàn. Dùng git thật với remote cục bộ (bare repo), không mạng.
 (a) /ok hợp lệ -> đúng 1 commit mới trên main, tiêu đề '[T-xxx] …', chỉ chạm board/T-xxx.md + ledger/events.jsonl, không viết lại lịch sử.
 (b) main bị đẩy chen vào đúng lúc (race với sync-ledger/phiên khác) -> thử lại, KHÔNG xung đột, cả hai sự kiện đều còn, decided đúng 1 lần.
 (c) chạy lại cùng sự kiện / bình luận bị từ chối -> main không đổi, không commit rỗng.
 (d) các workflow hạ nguồn (Slack, mirror issue, dashboard) chạy lại sau workflow này."""
import os, re, subprocess, sys, pathlib, tempfile, shutil, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _lib import Box, payload, ROOT
fails = []
def g(cwd, *a, env=None, check=True):
    r = subprocess.run(["git", "-c", "user.name=setup", "-c", "user.email=s@x", *a], cwd=cwd, env=env, capture_output=True, text=True)
    if check: assert r.returncode == 0, f"git {a}: {r.stderr}"
    return r.stdout.strip()
B = Box(); tmp2 = pathlib.Path(tempfile.mkdtemp())
try:
    home = tmp2 / "home"; home.mkdir()
    B.env.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
    for k in ("GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"): B.env.pop(k, None)
    t1 = B.new(issue=7); t2 = B.new(issue=8)
    origin = tmp2 / "origin.git"; g(tmp2, "init", "-q", "--bare", "-b", "main", str(origin))
    g(B.tmp, "init", "-q", "-b", "main"); g(B.tmp, "add", "-A"); g(B.tmp, "commit", "-q", "-m", "seed"); g(B.tmp, "remote", "add", "origin", str(origin)); g(B.tmp, "push", "-q", "origin", "main")
    X = g(B.tmp, "rev-parse", "HEAD")
    head = lambda: g(origin, "rev-parse", "main")
    # (a)
    r = B.ok(payload("/ok chọn A", issue=7), "--git")
    if r["verdict"] != "decided": fails.append(f"(a) verdict={r['verdict']}/{r['reason']}")
    Y = head()
    if Y == X: fails.append("(a) main không có commit mới")
    else:
        if g(origin, "rev-list", "--count", f"{X}..{Y}") != "1": fails.append("(a) phải đúng 1 commit mới")
        if g(origin, "merge-base", "--is-ancestor", X, Y, check=False) != "" or subprocess.run(["git", "merge-base", "--is-ancestor", X, Y], cwd=origin).returncode != 0: fails.append("(a) lịch sử bị viết lại")
        if not re.match(r"\[T-001\] \S", g(origin, "log", "-1", "--format=%s", Y)): fails.append("(a) tiêu đề commit không dạng '[T-001] …'")
        files = set(g(origin, "show", "--name-only", "--format=", Y).split())
        if files != {"board/T-001.md", "ledger/events.jsonl"}: fails.append(f"(a) commit chạm file ngoài phạm vi: {sorted(files)}")
        if "decided" not in g(origin, "show", f"{Y}:ledger/events.jsonl"): fails.append("(a) events.jsonl trên main không có decided")
    # (c) chạy lại + từ chối: main không đổi
    r = B.ok(payload("/ok chọn A", issue=7), "--git")
    r2 = B.ok(payload("/ok", issue=8, cid=1005), "--git"); r3 = B.ok(payload("/ok x", login="mallory", cid=1006), "--git")
    if head() != Y or r["verdict"] != "duplicate" or r2["verdict"] != "rejected" or r3["verdict"] == "decided": fails.append(f"(c) main đổi hoặc verdict sai: {r['verdict']},{r2['verdict']},{r3['verdict']}")
    # (b) race: hook pre-push chen một commit của clone B (start T-002) trước khi push của A
    other = tmp2 / "B"; g(tmp2, "clone", "-q", str(origin), str(other))
    flag = tmp2 / "raced"
    hook = B.tmp / ".git/hooks/pre-push"
    hook.write_text(f"#!/bin/sh\nif [ ! -e '{flag}' ]; then : > '{flag}'\n  cd '{other}' && {sys.executable} scripts/task.py new --title racer --to product --tier C --area hq/ledger --criteria c --by chief-of-staff >/dev/null && git add -A && git -c user.name=b -c user.email=b@x commit -q -m '[T-003] chen ngang' && git push -q origin HEAD:main\nfi\nexit 0\n")
    hook.chmod(0o755)
    Z0 = head()
    hook.write_text(hook.read_text().replace("cd '%s' &&" % other, "cd '%s' && export TOHONG_ROOT='%s' &&" % (other, other)))
    r = B.ok(payload("/ok chọn B", issue=8, cid=1010), "--git")
    Z = head()
    if not flag.exists(): fails.append("(b) hook race không chạy (eval hỏng)")
    elif r["verdict"] != "decided": fails.append(f"(b) verdict={r['verdict']}/{r['reason']} sau race")
    else:
        ev = [json.loads(l) for l in g(origin, "show", f"{Z}:ledger/events.jsonl").splitlines() if l.strip()]
        kinds = [(e["task"], e["event"]) for e in ev]
        if kinds.count((t2, "decided")) != 1: fails.append(f"(b) decided của {t2} phải đúng 1, có {kinds.count((t2, 'decided'))}")
        if not any(e["task"] == "T-003" and e["event"] == "assigned" for e in ev): fails.append("(b) sự kiện chen ngang của clone B bị mất")
        if len({e["id"] for e in ev}) != len(ev): fails.append("(b) id sự kiện trùng")
        if "<<<<<<<" in g(origin, "show", f"{Z}:ledger/events.jsonl") or "<<<<<<<" in g(origin, "show", f"{Z}:board/{t2}.md"): fails.append("(b) còn dấu xung đột")
        if subprocess.run(["git", "merge-base", "--is-ancestor", Z0, Z], cwd=origin).returncode != 0: fails.append("(b) lịch sử bị viết lại")
        if g(origin, "rev-list", "--merges", "--count", f"{Z0}..{Z}") != "0": fails.append("(b) có merge commit; phải tuyến tính")
finally:
    B.close(); shutil.rmtree(tmp2, ignore_errors=True)
# (d) hạ nguồn
NAME = "Quyết trên issue bằng /ok"
for wf in ("notify-slack.yml", "mirror-issue.yml", "publish-dashboard-data.yml"):
    t = (ROOT / ".github/workflows" / wf).read_text(encoding="utf-8")
    m = re.search(r"workflow_run:\s*\n\s*workflows:\s*\[([^\]]*)\]", t)
    if not m or NAME not in m.group(1): fails.append(f"(d) {wf}: workflow_run.workflows phải có {NAME!r} (push bằng GITHUB_TOKEN không kích hoạt workflow push)")
assert not fails, "\n".join(fails)
print("PASS commit tuyến tính 1 sự kiện trên main, thử lại khi bị chen, không đổi main khi trùng/từ chối, hạ nguồn được kích hoạt")
