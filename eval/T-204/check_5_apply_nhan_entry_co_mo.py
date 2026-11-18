#!/usr/bin/env python3
"""T-204 tiêu chí 5: export ký khi cờ ADMIN_OPEN="1" (mục cũ + mới của danh tính cố định) được tools/scraper/apply_admin_reviews.py của repo tohong NHẬN đầu-cuối:
APPLY_OK, đúng 3 mục sinh ra, mỗi mục qua định nghĩa chuẩn eval/lib/capu_decision.py (check_entry), decision/reason mang nhãn admin:2ddfc6ef, approved_by=capu. Không sửa repo tohong (apply chạy trên bản sao tạm).
Repo: TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back cạnh gốc HQ. Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import importlib.util, json, os, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
HQ = HERE
while HQ != os.path.dirname(HQ) and not os.path.exists(os.path.join(HQ, "scripts", "gate.py")):
    HQ = os.path.dirname(HQ)
def find(env, rel, probe):
    for p in (os.environ.get(env), os.path.join(HQ, "..", rel)):
        if p and os.path.exists(os.path.join(p, probe)):
            return os.path.abspath(p)
TOHONG = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "apply_admin_reviews.py"))
BACK = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
if not TOHONG or not BACK:
    print("FAIL không thấy repo tohong / tohong-back"); sys.exit(2)
sp = importlib.util.spec_from_file_location("capu_decision", os.path.join(HQ, "eval", "lib", "capu_decision.py")); CD = importlib.util.module_from_spec(sp); sp.loader.exec_module(CD)
LABEL = "admin:2ddfc6ef"
p = subprocess.run(["node", os.path.join(HERE, "lib", "export_under_flag.mjs")], capture_output=True, text=True, timeout=300, env=dict(os.environ, TOHONG_BACK_REPO=BACK))
if p.returncode != 0:
    print("FAIL không chạy được worker back: " + (p.stdout + p.stderr)[-300:]); sys.exit(1)
r = json.loads(p.stdout.strip().splitlines()[-1])
want = sorted(r["ids"].values())
if r["status"] != 200:
    print("FAIL export không 200: %s" % r["status"]); sys.exit(1)
ents = json.loads(r["export"]).get("entries") or []
if sorted(e.get("vendor_id") for e in ents) != want:
    print("FAIL export phải có đúng 3 mục của danh tính cố định khi cờ bật, thấy %s" % sorted(e.get("vendor_id") for e in ents)); sys.exit(1)
tmp = tempfile.mkdtemp(prefix="t204-")
try:
    sc = os.path.join(tmp, "tools", "scraper")
    shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    n0 = len(json.load(open(mo, encoding="utf-8")).get("overrides") or [])
    exf = os.path.join(tmp, "export.json"); open(exf, "w", encoding="utf-8").write(r["export"])
    kf = os.path.join(tmp, "keys.json"); json.dump({"schema_version": 1, "keys": {"k204": r["pub"]}}, open(kf, "w"))
    a = subprocess.run([sys.executable, "apply_admin_reviews.py", "--state", "HCMC", "--reviews", exf, "--keys", kf, "--output-dir", os.path.join(sc, "output")],
                       cwd=sc, capture_output=True, text=True, timeout=300, env=dict(os.environ, GOOGLE_MAPS_API_KEY=""))
    if a.returncode != 0 or "APPLY_OK" not in a.stdout:
        print("FAIL tohong từ chối export mở-admin: %s" % (a.stdout + a.stderr).strip()[-200:]); sys.exit(1)
    new = (json.load(open(mo, encoding="utf-8")).get("overrides") or [])[n0:]
    if sorted(e.get("vendor_id") for e in new) != want:
        print("FAIL apply sinh mục %s, mong %s" % (sorted(e.get("vendor_id") for e in new), want)); sys.exit(1)
    for e in new:
        ok, why = CD.check_entry(e, {"k204": r["pub"]})
        if not ok:
            print("FAIL mục %s không hợp lệ theo định nghĩa chuẩn: %s" % (e.get("vendor_id"), why)); sys.exit(1)
        if e.get("approved_by") != "capu" or (":%s@" % LABEL) not in e.get("decision", "") or ("[duyệt qua admin: %s," % LABEL) not in e.get("reason", ""):
            print("FAIL mục %s thiếu nhãn %s trong decision/reason hoặc approved_by != capu" % (e.get("vendor_id"), LABEL)); sys.exit(1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print("PASS export khi cờ mở admin (cũ + mới) qua apply_admin_reviews.py thật, nhãn %s" % LABEL); sys.exit(0)
