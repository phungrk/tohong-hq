#!/usr/bin/env python3
"""T-205 adv-02 (adversary): export ký khi cờ "1" (danh tính cố định) bị sửa trên đường tới tools/scraper/apply_admin_reviews.py THẬT (bản sao tạm, không sửa repo tohong).
Mong đợi theo spec T-204 mục 4: nhãn nằm trong phần ký -> đổi nhãn sang nhãn khác (vd nhãn băm của một Capu thật) thì APPLY_REFUSED bad_signature;
thêm reviewed_by -> APPLY_REFUSED; sửa reason -> bad_signature; `via` không ký -> bỏ hay đổi `via` vẫn APPLY_OK và mục sinh ra không mang `via` lẫn chuỗi "admin-khong-dang-nhap";
export nguyên bản -> APPLY_OK. Thoát 0 = đạt, 1 = vi phạm."""
import hashlib, json, os, shutil, subprocess, sys, tempfile
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
p = subprocess.run(["node", os.path.join(HQ, "eval", "T-204", "lib", "export_under_flag.mjs")], capture_output=True, text=True, timeout=300, env=dict(os.environ, TOHONG_BACK_REPO=BACK))
if p.returncode != 0:
    print("FAIL không chạy được worker back: " + (p.stdout + p.stderr)[-300:]); sys.exit(1)
r = json.loads(p.stdout.strip().splitlines()[-1])
base = json.loads(r["export"])
if r["status"] != 200 or len(base.get("entries") or []) != 3:
    print("FAIL export gốc sai: %s" % r["status"]); sys.exit(1)
other_label = "admin:" + hashlib.sha256(b"user_capu_that").hexdigest()[:8]
def mut(fn):
    d = json.loads(json.dumps(base)); fn(d["entries"]); return d
def setall(k, v):
    def f(es):
        for e in es: e[k] = v
    return f
def delall(k):
    def f(es):
        for e in es: e.pop(k, None)
    return f
CASES = [
    ("nguyên bản", base, True),
    ("bỏ via", mut(delall("via")), True),
    ("đổi via thành 'capu'", mut(setall("via", "capu")), True),
    ("đổi nhãn sang nhãn băm của Capu thật", mut(setall("reviewer_label", other_label)), False),
    ("đổi nhãn sang admin:00000000", mut(setall("reviewer_label", "admin:00000000")), False),
    ("thêm reviewed_by=danh tính cố định", mut(setall("reviewed_by", "admin-khong-dang-nhap")), False),
    ("sửa reason", mut(lambda es: es[0].__setitem__("reason", es[0]["reason"] + " x")), False),
    ("by_capu=false", mut(setall("by_capu", False)), False),
]
fails = []
for name, doc, want_ok in CASES:
    tmp = tempfile.mkdtemp(prefix="t205-adv02-")
    try:
        sc = os.path.join(tmp, "tools", "scraper")
        shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
        mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
        before = open(mo, "rb").read()
        n0 = len(json.loads(before).get("overrides") or [])
        exf = os.path.join(tmp, "export.json"); open(exf, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False))
        kf = os.path.join(tmp, "keys.json"); json.dump({"schema_version": 1, "keys": {"k204": r["pub"]}}, open(kf, "w"))
        a = subprocess.run([sys.executable, "apply_admin_reviews.py", "--state", "HCMC", "--reviews", exf, "--keys", kf, "--output-dir", os.path.join(sc, "output")],
                           cwd=sc, capture_output=True, text=True, timeout=300, env=dict(os.environ, GOOGLE_MAPS_API_KEY=""))
        ok = a.returncode == 0 and "APPLY_OK" in a.stdout
        after = open(mo, "rb").read()
        if want_ok:
            new = (json.loads(after).get("overrides") or [])[n0:]
            txt = json.dumps(new, ensure_ascii=False)
            good = ok and len(new) == 3 and "admin-khong-dang-nhap" not in txt and all("via" not in e for e in new)
        else:
            good = (not ok) and "APPLY_REFUSED" in a.stdout and after == before
        print(("  ok  " if good else "  XX  ") + name + ("" if good else " :: " + (a.stdout + a.stderr).strip()[-160:]))
        if not good: fails.append(name)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
if fails:
    print("FAIL " + fails[0] + (" (+%d)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS %d biến thể export mở-admin qua apply thật" % len(CASES)); sys.exit(0)
