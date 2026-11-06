#!/usr/bin/env python3
"""T-082 adv-09 (tầng 3, spec B2/B3/A1; soi việc bỏ concurrency ở ok-tren-issue.yml: các lượt chạy giờ song song thật).
Git thật, bare repo cục bộ, không mạng. Mỗi kịch bản chạy song song N bản ok_issue.py --git từ N clone riêng:
 (i)  CÙNG bình luận, sự kiện created + edited (+ một edited nữa) đến cùng lúc -> trên main đúng 1 decided cho link đó;
      các bản còn lại verdict duplicate (hoặc rejected not_escalated), không bản nào thoát khác 0.
 (ii) HAI bình luận /ok KHÁC nhau trên cùng issue, cùng lúc -> đúng 1 decided cho việc; bản thua: rejected not_escalated.
 (iii) /ok hợp lệ chạy song song với 3 bình luận người lạ/ không phải lệnh -> vẫn decided đúng 1.
Mọi kịch bản: lịch sử tuyến tính, không merge commit, id sự kiện không trùng."""
import os, subprocess, sys, pathlib, tempfile, shutil, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-079"))
from _lib import Box, payload
def _h(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _h
PY = sys.executable
fails = []
def g(cwd, *a, check=True):
    r = subprocess.run(["git", "-c", "user.name=s", "-c", "user.email=s@x", *a], cwd=cwd, capture_output=True, text=True)
    if check: assert r.returncode == 0, f"git {a}: {r.stderr}"
    return r.stdout.strip()
def setup(n):
    B = Box(); t = pathlib.Path(tempfile.mkdtemp()); home = t / "home"; home.mkdir()
    B.env.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
    os.environ.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
    B.new(issue=7)
    origin = t / "origin.git"; g(t, "init", "-q", "--bare", "-b", "main", str(origin))
    g(B.tmp, "init", "-q", "-b", "main"); g(B.tmp, "add", "-A"); g(B.tmp, "commit", "-q", "-m", "seed")
    g(B.tmp, "remote", "add", "origin", str(origin)); g(B.tmp, "push", "-q", "origin", "main")
    clones = []
    for i in range(n):
        d = t / f"c{i}"; g(t, "clone", "-q", str(origin), str(d)); clones.append(d)
    return B, t, origin, clones
def par(B, clones, payloads):
    ps = []
    for i, (d, p) in enumerate(zip(clones, payloads)):
        f = d.parent / f"p{i}.json"; f.write_text(json.dumps(p, ensure_ascii=False))
        ps.append(subprocess.Popen([PY, "-I", "scripts/ok_issue.py", "--event", str(f), "--git"], cwd=d,
                                   env=dict(B.env, TOHONG_ROOT=str(d)), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True))
    out = []
    for p in ps:
        so, se = p.communicate(timeout=180)
        try: v = json.loads([l for l in so.splitlines() if l.strip()][-1])
        except Exception: v = {}
        out.append((p.returncode, v, se[-200:]))
    return out
def check_main(tag, origin):
    ev = [json.loads(l) for l in g(origin, "show", "main:ledger/events.jsonl").splitlines() if l.strip()]
    if len({e["id"] for e in ev}) != len(ev): fails.append(f"{tag} id sự kiện trùng")
    if g(origin, "rev-list", "--merges", "--count", "main") != "0": fails.append(f"{tag} có merge commit")
    return [e for e in ev if e.get("event") == "decided"]
# (i)
B, t, origin, cl = setup(3)
try:
    base = payload("/ok chọn A", issue=7, cid=9001)
    ed = payload("/ok chọn A", issue=7, cid=9001, action="edited")
    res = par(B, cl, [base, ed, ed])
    dec = check_main("(i)", origin)
    if len(dec) != 1: fails.append(f"(i) decided trên main = {len(dec)} (phải 1)")
    if any(rc != 0 for rc, _, _ in res): fails.append(f"(i) có bản thoát khác 0: {[(rc, e) for rc, _, e in res]}")
    vs = sorted(v.get("verdict", "?") for _, v, _ in res)
    if any(x not in ("decided", "duplicate", "rejected") for x in vs): fails.append(f"(i) verdict = {vs}")
    # C4: mỗi marker chỉ đăng một lần. Bước đăng của workflow là 'liệt kê bình luận bot rồi tạo' (không nguyên tử), nên
    # các lượt chạy CÙNG bình luận phải được xếp hàng (concurrency theo github.event.comment.id); nếu không, hai lượt
    # song song cùng có reply mang cùng marker sẽ cùng thấy 'chưa có' và cùng đăng.
    marks = [v.get("reply", "").split("\n", 1)[0] for _, v, _ in res if v.get("reply")]
    dup = len(marks) != len(set(marks))
    import re
    wf = (pathlib.Path(__file__).resolve().parents[2] / ".github/workflows/ok-tren-issue.yml").read_text(encoding="utf-8")
    m = re.search(r"^[ \t]*concurrency:\s*\n((?:[ \t]+.*\n?)+)", wf, re.M)
    serial = bool(m and re.search(r"group:.*github\.event\.comment\.id", m.group(1)) and not re.search(r"cancel-in-progress:\s*true", m.group(1)))
    if dup and not serial:
        fails.append(f"(i) {len(marks)} lượt song song cùng bình luận đều có reply marker {marks[0]!r} mà workflow không xếp hàng theo "
                     "comment.id -> bước đăng (liệt kê rồi tạo) đăng trùng marker, phá C4")
finally:
    B.close(); shutil.rmtree(t, ignore_errors=True)
# (ii)
B, t, origin, cl = setup(2)
try:
    res = par(B, cl, [payload("/ok chọn A", issue=7, cid=9101), payload("/ok chọn B", issue=7, cid=9102)])
    dec = check_main("(ii)", origin)
    if len(dec) != 1: fails.append(f"(ii) decided trên main = {len(dec)} (phải 1)")
    vs = sorted((v.get("verdict", "?"), v.get("reason", "")) for _, v, _ in res)
    if vs != [("decided", ""), ("rejected", "not_escalated")]: fails.append(f"(ii) verdict = {vs}; rc={[r[0] for r in res]} err={[r[2] for r in res]}")
finally:
    B.close(); shutil.rmtree(t, ignore_errors=True)
# (iii)
B, t, origin, cl = setup(4)
try:
    res = par(B, cl, [payload("/ok chọn A", issue=7, cid=9201), payload("/ok chọn B", login="mallory", cid=9202),
                      payload("cảm ơn", issue=7, cid=9203), payload("/ok chọn C", login="phungrk", sender="mallory", action="edited", cid=9204)])
    dec = check_main("(iii)", origin)
    if len(dec) != 1 or dec[0].get("link", "").endswith("9201") is False: fails.append(f"(iii) decided = {[d.get('link') for d in dec]}")
    if any(rc != 0 for rc, _, _ in res): fails.append(f"(iii) có bản thoát khác 0: {[(rc, e) for rc, _, e in res]}")
finally:
    B.close(); shutil.rmtree(t, ignore_errors=True)
assert not fails, "\n".join(fails)
print("PASS song song không concurrency: cùng bình luận, hai bình luận cùng việc, lẫn bình luận người lạ -> decided đúng 1, tuyến tính")
