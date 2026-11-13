#!/usr/bin/env python3
"""T-140 BƯỚC 2 (việc/PR riêng, tạo sau khi chat chạy ổn; CHƯA đăng ký vào board T-140). Spec: products/T-140-chat-ghep-vendor-computematches.md mục "Bước 2".
Trạng thái đích sau bước 2, ở cả hai repo (TOHONG_BACK_REPO, TOHONG_REPO; mặc định ../tohong-back, ../tohong cạnh tohong-hq). In PASS / FAIL <lý do>; mã thoát 0/1. Không mạng, không GCP.
 (1) tohong-back KHÔNG còn: lib/matcherAdapter.js, .github/workflows/{sync-matcher-vendors,deploy-matcher}.yml, thư mục matcher-data/, thư mục matcher-service/ (nguồn Cloud Run).
 (2) tohong-back VẪN còn matcher/ Python (matcher.py, match.py, profile.py, stage1_filters.py, stage2_scoring.py, stage3_boosts.py, style_contract.py): chuẩn so sánh của eval T-140 và bất biến planner/vendor/matching/inv-001..003 dựa vào nó.
 (3) Không còn tham chiếu callMatcher / matcherAdapter / MATCHER_URL / MATCHER_API_KEY / sync-matcher-vendors / deploy-matcher / matcher-data trong lib/, api/, worker.js, wrangler.toml, .github/, tools/, package.json, test/ (thư mục matcher/ và README được phép nhắc lịch sử).
 (4) tools/pool-paths.txt không còn dòng matcher-data/vendors.json; mọi file trong scripts.test của package.json còn tồn tại.
 (5) Ranh giới T-135/T-139: chạy NGUYÊN VĂN `bash tools/regen-pool-styles.sh --back <bản chép back không có matcher-data/>` (bản chép tạm) KHÔNG tạo lại matcher-data/ trong back, và exit 0.
 (6) Chat vẫn có ứng viên không mạng: node eval/T-140/check_1_chat_tu_pool_khong_mang.mjs PASS."""
import json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = HERE
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")): HQ = os.path.dirname(HQ)
B = os.path.abspath(os.environ.get("TOHONG_BACK_REPO") or os.path.join(HQ, "..", "tohong-back"))
T = os.path.abspath(os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong"))
def fail(m): print("FAIL " + m); sys.exit(1)
if not os.path.isdir(B): fail("không thấy tohong-back")
for f in ("lib/matcherAdapter.js", ".github/workflows/sync-matcher-vendors.yml", ".github/workflows/deploy-matcher.yml", "matcher-data", "matcher-service"):
    if os.path.exists(os.path.join(B, f)): fail(f"còn {f}")
for f in ("matcher.py", "match.py", "profile.py", "stage1_filters.py", "stage2_scoring.py", "stage3_boosts.py", "style_contract.py"):
    if not os.path.isfile(os.path.join(B, "matcher", f)): fail(f"mất matcher/{f} (chuẩn so sánh + bất biến matching)")
pat = re.compile(r"callMatcher|matcherAdapter|MATCHER_URL|MATCHER_API_KEY|sync-matcher-vendors|deploy-matcher|matcher-data")
for root in ("lib", "api", ".github", "tools", "test"):
    for d, _, fs in os.walk(os.path.join(B, root)):
        for n in fs:
            p = os.path.join(d, n)
            try: s = open(p, encoding="utf-8").read()
            except Exception: continue
            if pat.search(s): fail(f"còn tham chiếu matcher cũ trong {os.path.relpath(p, B)}: {pat.search(s).group(0)}")
for f in ("worker.js", "wrangler.toml", "package.json"):
    p = os.path.join(B, f)
    if os.path.isfile(p) and pat.search(open(p, encoding="utf-8").read()): fail(f"còn tham chiếu matcher cũ trong {f}: {pat.search(open(p, encoding='utf-8').read()).group(0)}")
pp = os.path.join(B, "tools", "pool-paths.txt")
if os.path.isfile(pp) and "matcher-data" in open(pp, encoding="utf-8").read(): fail("tools/pool-paths.txt còn dòng matcher-data/vendors.json")
pk = json.load(open(os.path.join(B, "package.json"), encoding="utf-8")).get("scripts", {})
for tok in re.findall(r"test/[\w./-]+\.js", " ".join(pk.values())):
    if not os.path.isfile(os.path.join(B, tok)): fail(f"package.json trỏ tới {tok} không còn")
# (5) regen không tạo lại matcher-data
if os.path.isdir(T):
    W = tempfile.mkdtemp(prefix="t140-go-")
    try:
        os.makedirs(W + "/t"); os.makedirs(W + "/b")
        for src, dst, ex in ((T, W + "/t", ("./node_modules", "./.git")), (B, W + "/b", ("./.git", "./node_modules"))):
            subprocess.run(["bash", "-c", f"cd '{src}' && tar {' '.join('--exclude=' + e for e in ex)} -cf - . | (cd '{dst}' && tar xf -)"], check=True)
        if os.path.isdir(T + "/node_modules"): os.symlink(T + "/node_modules", W + "/t/node_modules")
        shutil.rmtree(W + "/b/matcher-data", ignore_errors=True)
        p = subprocess.run(["bash", "tools/regen-pool-styles.sh", "--back", W + "/b"], cwd=W + "/t", capture_output=True, text=True, timeout=600)
        if p.returncode != 0: fail("regen-pool-styles.sh lỗi khi back không có matcher-data/: " + (p.stderr.strip().splitlines() or ["?"])[-1])
        if os.path.exists(W + "/b/matcher-data"): fail("regen-pool-styles.sh tạo lại matcher-data/ trong back (workflow sync-vendor-pool sẽ đỏ vì file ngoài pool-paths.txt)")
    finally: shutil.rmtree(W, ignore_errors=True)
else: fail("không thấy repo tohong (TOHONG_REPO)")
p = subprocess.run(["node", os.path.join(HQ, "eval", "T-140", "check_1_chat_tu_pool_khong_mang.mjs")], capture_output=True, text=True, env=dict(os.environ, TOHONG_BACK_REPO=B))
if not p.stdout.strip().endswith("PASS"): fail("chat hết ứng viên sau khi gỡ: " + (p.stdout.strip().splitlines() or ["?"])[-1])
print("PASS")
