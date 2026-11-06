#!/usr/bin/env python3
"""T-073 tiêu chí 4: pool tạo lại bằng MỘT LỆNH tái lập được từ pool cũ, không sửa tay (ADR-025).
Lệnh (giao diện cố định trong spec): chạy từ gốc repo tohong, `bash tools/regen-pool-styles.sh --back <thư mục tohong-back>`; ghi
<back>/lib/vendorPool.generated.js, chỉ đổi styles/tags.
Cách kiểm (trên BẢN SAO trong thư mục tạm; repo thật không bị đụng): chép tohong và tohong-back; đặt pool trong bản sao về đúng pool
tohong-back@6a9a9c7 (git show); chạy lệnh; (a) file ra phải GIỐNG TỪNG BYTE pool đang nằm trong tohong-back (tức pool đã commit chính là sản phẩm
của lệnh, không ai sửa tay); (b) chạy lệnh lần hai không đổi file; (c) nếu pool nền có một vendor không còn trong dữ liệu scrape thì lệnh thoát khác 0 và KHÔNG ghi đè pool (không âm thầm giữ tag cũ). Chạy: python3 -I eval/T-073/check_4.py. Repo: TOHONG_REPO, TOHONG_BACK_REPO."""
import os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
COMMIT = "6a9a9c707f35592fc9c3845613ba8cf38655f5c9"
t, b = c.tohong(), c.back()
if not os.path.isfile(os.path.join(t, "tools", "regen-pool-styles.sh")):
    print("FAIL chưa có tools/regen-pool-styles.sh trong repo tohong (lệnh tạo lại pool theo spec)"); sys.exit(1)
IGN = shutil.ignore_patterns(".git", "node_modules", "wedding-front", "relay", "docs", "__pycache__")
tmp = tempfile.mkdtemp(prefix="t073-")
try:
    ct, cb = os.path.join(tmp, "tohong"), os.path.join(tmp, "tohong-back")
    shutil.copytree(t, ct, ignore=IGN, symlinks=True); shutil.copytree(b, cb, ignore=IGN, symlinks=True)
    pool_rel = os.path.join("lib", "vendorPool.generated.js")
    committed = open(os.path.join(b, pool_rel), "rb").read()
    old = subprocess.run(["git", "-C", b, "show", COMMIT + ":lib/vendorPool.generated.js"], capture_output=True)
    if old.returncode != 0: print("FAIL không đọc được pool @6a9a9c7 từ git của tohong-back"); sys.exit(1)
    open(os.path.join(cb, pool_rel), "wb").write(old.stdout)
    def regen():
        return subprocess.run(["bash", "tools/regen-pool-styles.sh", "--back", cb], cwd=ct, capture_output=True, text=True, timeout=300)
    r = regen()
    if r.returncode != 0: print("FAIL lệnh tạo lại thoát %d: %s" % (r.returncode, (r.stderr or r.stdout)[-300:].replace("\n", " "))); sys.exit(1)
    out1 = open(os.path.join(cb, pool_rel), "rb").read()
    if out1 != committed: print("FAIL pool do lệnh tạo ra (từ pool @6a9a9c7) khác pool đang nằm trong tohong-back (%d vs %d byte): pool bị sửa tay hoặc lệnh không phải đường tạo ra nó" % (len(out1), len(committed))); sys.exit(1)
    r = regen()
    if r.returncode != 0 or open(os.path.join(cb, pool_rel), "rb").read() != out1: print("FAIL chạy lệnh lần hai đổi pool hoặc lỗi"); sys.exit(1)
    import json
    txt = out1.decode("utf-8"); i = txt.index("= [") + 2; j = txt.rindex("]") + 1
    pool = json.loads(txt[i:j]); fake = dict(pool[0], id="t073_vendor_khong_co_trong_nguon"); pool.append(fake)
    injected = (txt[:i] + json.dumps(pool, ensure_ascii=False, separators=(",", ":")) + txt[j:]).encode("utf-8")
    open(os.path.join(cb, pool_rel), "wb").write(injected)
    r = regen()
    if r.returncode == 0: print("FAIL pool nền có vendor vắng trong dữ liệu scrape mà lệnh vẫn thoát 0 (phải dừng, báo id)"); sys.exit(1)
    if open(os.path.join(cb, pool_rel), "rb").read() != injected: print("FAIL lệnh dừng vì vendor vắng nguồn nhưng vẫn ghi đè pool"); sys.exit(1)
    print("PASS")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
