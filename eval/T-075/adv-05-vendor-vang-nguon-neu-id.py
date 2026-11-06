#!/usr/bin/env python3
"""T-075 tầng 3 (adversary). Spec T-073 Hành vi 4: "Nếu pool có vendor không còn trong dữ liệu scrape: lệnh thoát khác 0, NÊU ID, không ghi đè
  pool." check_4 kiểm mã thoát và không ghi đè, chưa kiểm "nêu id". Thêm: --back trỏ thư mục có dấu cách; chạy từ thư mục khác gốc repo.
Kiểm (trên bản sao): (a) pool nền thêm 1 vendor giả -> mã khác 0, id giả xuất hiện trong stdout/stderr, pool y nguyên;
  (b) --back là đường dẫn có dấu cách, lệnh gọi từ thư mục khác (bash <đường dẫn tuyệt đối>/tools/regen-pool-styles.sh) -> thoát 0, pool không đổi.
Chạy: python3 -I eval/T-075/adv-05-vendor-vang-nguon-neu-id.py. Repo: TOHONG_REPO, TOHONG_BACK_REPO."""
import json, os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-073"))
import _common as c
t, b = c.tohong(), c.back()
IGN = shutil.ignore_patterns(".git", "node_modules", "wedding-front", "relay", "docs", "__pycache__")
tmp = tempfile.mkdtemp(prefix="t075adv05-"); bad = []
try:
    ct, cb = os.path.join(tmp, "tohong"), os.path.join(tmp, "tohong back có dấu cách")
    shutil.copytree(t, ct, ignore=IGN, symlinks=True); shutil.copytree(b, cb, ignore=IGN, symlinks=True)
    pool = os.path.join(cb, "lib", "vendorPool.generated.js"); orig = open(pool, "rb").read()
    def regen(cwd):
        return subprocess.run(["bash", os.path.join(ct, "tools", "regen-pool-styles.sh"), "--back", cb], cwd=cwd, capture_output=True, text=True, timeout=300)
    r = regen(tmp)
    if r.returncode != 0: bad.append("chạy từ thư mục khác, --back có dấu cách: thoát %d %s" % (r.returncode, (r.stderr or "")[-200:]))
    elif open(pool, "rb").read() != orig: bad.append("chạy từ thư mục khác làm đổi pool đã commit")
    txt = orig.decode("utf-8"); i = txt.index("= [") + 2; j = txt.rindex("]") + 1
    p = json.loads(txt[i:j]); FAKE = "adv05_vendor_vang_nguon"; p.insert(5, dict(p[0], id=FAKE))
    inj = (txt[:i] + json.dumps(p, ensure_ascii=False, separators=(",", ":")) + txt[j:]).encode("utf-8")
    open(pool, "wb").write(inj)
    r = regen(ct)
    if r.returncode == 0: bad.append("vendor vắng nguồn mà thoát 0")
    if FAKE not in (r.stdout or "") + (r.stderr or ""): bad.append("dừng nhưng không nêu id %s" % FAKE)
    if open(pool, "rb").read() != inj: bad.append("dừng nhưng ghi đè pool")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if bad: print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS")
