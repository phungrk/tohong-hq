#!/usr/bin/env python3
"""T-082 adv-10 (tầng 3, spec B3 + ranh giới cứng 'không viết lại lịch sử git'; rủi ro `reset --hard origin/main` của --git).
--git hiện chạy `git reset --hard origin/main` trên thư mục kho bất kỳ. Chạy nhầm trong bản làm việc của một phiên
(nhánh claude/..., có sửa chưa commit ở file đã theo dõi, có commit chưa đẩy) thì: sửa chưa commit mất hẳn, nhánh phiên
bị kéo về origin/main (commit của phiên rơi khỏi nhánh), rồi đẩy thẳng lên main từ phiên.
Input: (i) nhánh 'claude/phien' có 1 commit chưa đẩy + sửa chưa commit ở products/x.md; (ii) nhánh main nhưng có sửa chưa
commit ở file đã theo dõi. Mong đợi: KHÔNG đụng cây làm việc của người gọi (file sửa còn nguyên, HEAD và nhánh không đổi),
main ở origin không quá 1 decided. Cách làm tuỳ Engineering: từ chối khi không phải checkout sạch của main, HOẶC ghi trong
worktree/clone tạm tách biệt. Lưu ý eval check_8/adv-06: bản seed của chúng commit cả scripts/__pycache__ (không .gitignore),
nên kiểm 'sạch' phải bỏ qua file chưa theo dõi và *.pyc, nếu không sẽ chặn oan bản checkout hợp lệ."""
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
for case in ("nhanh-phien", "main-ban"):
    B = Box(); t = pathlib.Path(tempfile.mkdtemp()); home = t / "home"; home.mkdir()
    try:
        B.env.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
        os.environ.update(HOME=str(home), GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null")
        B.new(issue=7)
        (B.tmp / "products" / "x.md").write_text("bản đầu\n", encoding="utf-8")
        origin = t / "origin.git"; g(t, "init", "-q", "--bare", "-b", "main", str(origin))
        g(B.tmp, "init", "-q", "-b", "main"); g(B.tmp, "add", "-A"); g(B.tmp, "commit", "-q", "-m", "seed")
        g(B.tmp, "remote", "add", "origin", str(origin)); g(B.tmp, "push", "-q", "origin", "main")
        M0 = g(origin, "rev-parse", "main")
        if case == "nhanh-phien":
            g(B.tmp, "checkout", "-q", "-b", "claude/phien")
            (B.tmp / "products" / "y.md").write_text("commit của phiên\n"); g(B.tmp, "add", "-A"); g(B.tmp, "commit", "-q", "-m", "phien")
        H0 = g(B.tmp, "rev-parse", "HEAD"); BR0 = g(B.tmp, "rev-parse", "--abbrev-ref", "HEAD")
        (B.tmp / "products" / "x.md").write_text("VIỆC ĐANG LÀM CHƯA COMMIT\n", encoding="utf-8")
        f = t / "p.json"; f.write_text(json.dumps(payload("/ok chọn A", issue=7, cid=7001)))
        r = subprocess.run([sys.executable, "-I", "scripts/ok_issue.py", "--event", str(f), "--git"], cwd=B.tmp,
                           env=dict(B.env, TOHONG_ROOT=str(B.tmp)), capture_output=True, text=True, timeout=120)
        try: v = json.loads([l for l in r.stdout.splitlines() if l.strip()][-1]) if r.returncode == 0 else {}
        except Exception: v = {}
        if (B.tmp / "products" / "x.md").read_text(encoding="utf-8") != "VIỆC ĐANG LÀM CHƯA COMMIT\n":
            fails.append(f"({case}) sửa chưa commit ở products/x.md bị xoá")
        if g(B.tmp, "rev-parse", "HEAD") != H0 or g(B.tmp, "rev-parse", "--abbrev-ref", "HEAD") != BR0:
            fails.append(f"({case}) HEAD/nhánh bị đổi (commit của phiên rơi khỏi nhánh)")
        dec = [l for l in g(origin, "show", "main:ledger/events.jsonl").splitlines() if '"decided"' in l]
        if len(dec) > 1: fails.append(f"({case}) main có {len(dec)} decided")
    finally:
        B.close(); shutil.rmtree(t, ignore_errors=True)
assert not fails, "\n".join(fails)
print("PASS --git không đụng cây làm việc của người gọi: sửa chưa commit còn nguyên, HEAD và nhánh không đổi")
