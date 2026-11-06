#!/usr/bin/env python3
"""T-075 tầng 3 (adversary, v2). Bàn giao v2 hứa: "tham số lạ hoặc thiếu đường dẫn thì thoát 2"; Diff hành vi: "Gõ tham số sai thì lệnh dừng
  và nói rõ" (không âm thầm ghi chỗ khác). adv-05 đã thử --back có dấu cách; test của PR chỉ thử --bogus.
Kiểm (trên BẢN SAO, repo thật không bị đụng), mỗi ca: lệnh phải thoát khác 0, stderr nói rõ, và KHÔNG ghi vào pool nào (bản sao tohong-back, edge
  của bản sao tohong, và một pool mồi nằm ở thư mục làm việc hiện tại):
  (a) `--back=` (giá trị rỗng)   (b) `--back ""`   (c) `--back` không có giá trị   (d) `--back /khong/ton/tai`   (e) `--back <dir> --bogus`
  Ca (a)(b) chạy với cwd là một bản sao tohong-back: `cd ""` trong bash giữ nguyên thư mục hiện tại, nên nếu không chặn giá trị rỗng thì lệnh
  âm thầm ghi vào repo đang đứng.
Chạy: python3 -I eval/T-075/adv-06-back-rong-khong-ghi-cho-khac.py. Repo: TOHONG_REPO, TOHONG_BACK_REPO."""
import hashlib, os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-073"))
import _common as c
t, b = c.tohong(), c.back()
IGN = shutil.ignore_patterns(".git", "node_modules", "wedding-front", "relay", "docs", "__pycache__")
def h(p): return hashlib.sha256(open(p, "rb").read()).hexdigest() if os.path.isfile(p) else None
tmp = tempfile.mkdtemp(prefix="t075adv06-")
fails = []
try:
    ct, cb, cwdb = (os.path.join(tmp, x) for x in ("tohong", "tohong-back", "cwd-back"))
    shutil.copytree(t, ct, ignore=IGN, symlinks=True)
    shutil.copytree(b, cb, ignore=IGN, symlinks=True)
    shutil.copytree(b, cwdb, ignore=IGN, symlinks=True)
    # mồi pool cũ (trước T-073) vào repo đang đứng, để một lần ghi nhầm hiện ra dù lệnh idempotent
    old = subprocess.run(["git", "-C", b, "show", "6a9a9c707f35592fc9c3845613ba8cf38655f5c9:lib/vendorPool.generated.js"], capture_output=True)
    if old.returncode != 0: print("FAIL không đọc được pool @6a9a9c7 từ git của tohong-back"); sys.exit(1)
    open(os.path.join(cwdb, "lib", "vendorPool.generated.js"), "wb").write(old.stdout)
    script = os.path.join(ct, "tools", "regen-pool-styles.sh")
    pools = [os.path.join(d, "lib", "vendorPool.generated.js") for d in (cb, cwdb, os.path.join(ct, "edge"))]
    cases = [("--back=", ["--back="], cwdb), ('--back ""', ["--back", ""], cwdb), ("--back (thiếu)", ["--back"], ct),
             ("--back /khong/ton/tai", ["--back", "/khong/ton/tai"], ct), ("--back <dir> --bogus", ["--back", cb, "--bogus"], ct)]
    for name, args, cwd in cases:
        open(os.path.join(cwdb, "lib", "vendorPool.generated.js"), "wb").write(old.stdout)
        before = [h(p) for p in pools]
        r = subprocess.run(["bash", script] + args, cwd=cwd, capture_output=True, text=True, timeout=300)
        after = [h(p) for p in pools]
        if r.returncode == 0: fails.append("%s: thoát 0" % name)
        elif not r.stderr.strip(): fails.append("%s: thoát %d nhưng stderr rỗng" % (name, r.returncode))
        if before != after: fails.append("%s: ghi vào %s" % (name, [os.path.relpath(p, tmp) for p, x, y in zip(pools, before, after) if x != y]))
    if fails: print("FAIL " + "; ".join(fails)); sys.exit(1)
    print("PASS")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
