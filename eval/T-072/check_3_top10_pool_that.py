#!/usr/bin/env python3
"""T-072 tiêu chí 3b (ADR-026): 6 style x {ảnh cưới, makeup, áo cưới, nhà hàng} x 4 hồ sơ trên pool thật (JS).
Với mỗi tổ hợp, đếm vendor khớp (eval tự tính từ tag trong pool + bảng expansion, không tin styleCoverage) trong top 10 trả về.
BASELINE TỰ TÍNH MỖI LẦN CHẠY, không có file baseline: lấy code chấm điểm của ref (mặc định merge-base của HEAD với origin/main trong repo tohong-back;
ghi đè bằng biến TOHONG_BASE_REF hoặc đối số dòng lệnh thứ nhất) bằng `git archive` ra thư mục tạm, thay pool bằng đúng file pool đang có trong repo
(lib/vendorPool.generated.js ở thư mục làm việc), rồi chạy cùng phép đo. Nhờ đó pool đổi (T-075 tạo lại pool, minimalist 124 -> 6) thì hai phía
vẫn đo trên cùng một pool và phép so vẫn có nghĩa; không ai phải đo lại tay. Không sửa repo sản phẩm (git archive chỉ đọc).
PASS khi TỔNG số vendor khớp trong top 10 trên 96 tổ hợp, với code hiện tại, không ít hơn với code của ref.
Luật cộng điểm không giữ được "mỗi tổ hợp không ít hơn" (xem spec); in kèm danh sách tổ hợp tụt, không tính là lỗi.
Khi ref trùng HEAD (đã merge, hoặc chưa có commit nào của T-072) phép so là hai lần đo cùng code: PASS tầm thường, đúng nghĩa chống thoái lui. Mã thoát 0 = PASS."""
import json, os, shutil, subprocess, sys, tarfile, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), os.path.join(HERE, "..", "..", "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))), None)
if not repo: print("FAIL không tìm thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(1)
cases = os.path.join(HERE, "style-cases.json")
def git(*a):
    return subprocess.run(["git", "-C", repo, *a], capture_output=True, timeout=120)
ref = (sys.argv[1] if len(sys.argv) > 1 else None) or os.environ.get("TOHONG_BASE_REF")
if not ref:
    mb = git("merge-base", "HEAD", "origin/main")
    if mb.returncode != 0: print("FAIL không tính được merge-base HEAD với origin/main (git fetch origin main, hoặc đặt TOHONG_BASE_REF): " + mb.stderr.decode()[-150:]); sys.exit(1)
    ref = mb.stdout.decode().strip()
tmp = tempfile.mkdtemp(prefix="t072-base-")
try:
    ar = git("archive", "--format=tar", ref, "lib", "package.json")
    if ar.returncode != 0:
        ar = git("archive", "--format=tar", ref, "lib")
    if ar.returncode != 0: print(f"FAIL git archive {ref}: " + ar.stderr.decode()[-150:]); sys.exit(1)
    tf = os.path.join(tmp, "src.tar"); open(tf, "wb").write(ar.stdout)
    base_dir = os.path.join(tmp, "base"); os.makedirs(base_dir)
    with tarfile.open(tf) as t:
        try: t.extractall(base_dir, filter="data")
        except TypeError: t.extractall(base_dir)
    shutil.copyfile(os.path.join(repo, "lib", "vendorPool.generated.js"), os.path.join(base_dir, "lib", "vendorPool.generated.js"))
    nm = os.path.join(repo, "node_modules")
    if os.path.isdir(nm): os.symlink(nm, os.path.join(base_dir, "node_modules"))
    def measure(r):
        p = subprocess.run(["node", os.path.join(HERE, "lib", "run_js.mjs"), r, cases, "pool"], capture_output=True, text=True, timeout=300)
        if p.returncode != 0: print("FAIL chạy lỗi node: " + (p.stderr or p.stdout)[-200:]); sys.exit(1)
        return json.loads(p.stdout)
    before_rows, after_rows = measure(base_dir), measure(repo)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
key = lambda r: f'{r["profile"]}|{r["style"]}|{r["cat"]}'
b = {key(r): r["got"] for r in before_rows}
if len(before_rows) != len(after_rows) or set(b) != {key(r) for r in after_rows}: print(f"FAIL lưới tổ hợp hai phía không khớp ({len(before_rows)} và {len(after_rows)})"); sys.exit(1)
before = sum(b.values()); after = sum(r["got"] for r in after_rows)
down = [f'{r["style"]}/{r["cat"]}/{r["profile"]}:{b[key(r)]}->{r["got"]}' for r in after_rows if r["got"] < b[key(r)]]
if after < before: print(f"FAIL tổng vendor khớp trong top 10 tụt: {before} -> {after} trên {len(after_rows)} tổ hợp (baseline = code ref {ref[:10]} trên pool hiện tại); {len(down)} tổ hợp tụt, vd " + " | ".join(down[:3])); sys.exit(1)
print(f"PASS tổng vendor khớp trong top 10: {before} -> {after} trên {len(after_rows)} tổ hợp (baseline = code ref {ref[:10]} trên pool hiện tại; thông tin: {len(down)} tổ hợp tụt riêng lẻ)")
