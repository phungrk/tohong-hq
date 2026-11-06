#!/usr/bin/env python3
"""T-075 tầng 3 (adversary). Spec T-073 Hành vi 4 ("chạy lần hai không đổi gì") + đoạn "Thứ tự bên trong lệnh" (thay đổi duy nhất trong
  tools/scraper/output/HCMC/*/vendors.json là dòng style_tags). check_4 chỉ kiểm file pool; eval này kiểm phía repo tohong.
Kiểm (trên BẢN SAO có .git, repo thật không bị đụng): chạy `bash tools/regen-pool-styles.sh --back <bản sao tohong-back>` trên trạng thái đã
  commit của nhánh; sau lệnh, mọi file git theo dõi trong tohong không đổi (dữ liệu scrape đã commit chính là đầu ra của lệnh); pool không đổi.
Chạy: python3 -I eval/T-075/adv-02-regen-khong-de-lai-thay-doi.py. Repo: TOHONG_REPO, TOHONG_BACK_REPO."""
import os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-073"))
import _common as c
t, b = c.tohong(), c.back()
if not os.path.isfile(os.path.join(t, "tools", "regen-pool-styles.sh")): print("FAIL chưa có tools/regen-pool-styles.sh"); sys.exit(1)
tmp = tempfile.mkdtemp(prefix="t075adv02-")
try:
    ct, cb = os.path.join(tmp, "tohong"), os.path.join(tmp, "tohong-back")
    subprocess.run(["git", "clone", "-q", "--no-hardlinks", t, ct], check=True, capture_output=True)
    subprocess.run(["git", "-C", ct, "checkout", "-q", subprocess.run(["git", "-C", t, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()], check=True, capture_output=True)
    shutil.copytree(b, cb, ignore=shutil.ignore_patterns(".git", "node_modules"), symlinks=True)
    pool = os.path.join(cb, "lib", "vendorPool.generated.js"); before = open(pool, "rb").read()
    r = subprocess.run(["bash", "tools/regen-pool-styles.sh", "--back", cb], cwd=ct, capture_output=True, text=True, timeout=300)
    if r.returncode != 0: print("FAIL lệnh thoát %d: %s" % (r.returncode, (r.stderr or r.stdout)[-300:].replace("\n", " "))); sys.exit(1)
    st = subprocess.run(["git", "-C", ct, "status", "--porcelain", "--untracked-files=no"], capture_output=True, text=True).stdout.strip()
    if st: print("FAIL sau lệnh, file git theo dõi trong tohong đổi: %s" % st.replace("\n", "; ")[:300]); sys.exit(1)
    if open(pool, "rb").read() != before: print("FAIL lệnh đổi pool đã commit (không idempotent)"); sys.exit(1)
    print("PASS")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
