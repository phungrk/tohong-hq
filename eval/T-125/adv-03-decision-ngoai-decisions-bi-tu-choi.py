#!/usr/bin/env python3
"""T-125 adv-03 (tầng 3, adversary 2026-11-11) · `apply_admin_reviews.py --hq` chỉ nhận file decision NẰM THẬT trong decisions/ của HQ.
Input phá: `<HQ>/decisions/lo.md` là symlink tới một file NGOÀI decisions/ (có `decided_by: capu` ở frontmatter và đủ vendor_id).
Hiện tại: script đi theo symlink, `is_file()` True, nên APPLY_OK và mục vào manual_overrides.json; trong khi INV-020 (bản trong bể,
`os.path.realpath` phải nằm dưới <HQ>/decisions) coi đó là "decision không phải file trong decisions/ của HQ". Spec T-124 Hành vi 5.3:
với --hq, không có file / không decided_by: capu / thiếu vendor_id → `APPLY_REFUSED bad_decision`, và INV-020 không cần đổi: cổng của
script phải không lỏng hơn INV-020 (giống INV-015: dấu duyệt phải trỏ về quyết định thật của Capu).
Đối chứng: cùng lô, cùng nội dung, file thật trong decisions/ → APPLY_OK (thoát 0).
Mong đợi: symlink ra ngoài → thoát 2, in `APPLY_REFUSED bad_decision`, manual_overrides.json không đổi byte. Mạng không dùng.
Chạy: python3 -I eval/T-125/adv-03-…py (TOHONG_REPO hoặc ../tohong). Thoát 0 = PASS."""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
TOHONG = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
               if p and os.path.isfile(os.path.join(p, "tools", "scraper", "enrich.py"))), None)
if not TOHONG or not os.path.isfile(os.path.join(TOHONG, "tools", "scraper", "apply_admin_reviews.py")):
    print("FAIL không thấy tohong có tools/scraper/apply_admin_reviews.py (đặt TOHONG_REPO)"); sys.exit(1)

tmp = tempfile.mkdtemp(prefix="t125-adv03-")
try:
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    shutil.copy(os.path.join(HQ, "eval", "T-124", "lib", "nonet_sitecustomize.py"), os.path.join(nd, "sitecustomize.py"))
    sc = os.path.join(tmp, "tohong", "tools", "scraper")
    shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    rep = json.load(open(os.path.join(sc, "output", "HCMC", "enrich-report.json"), encoding="utf-8"))
    row = next(r for r in rep["vendors"] if r.get("approvable") and r.get("google") and r["google"].get("place_id"))
    ex = os.path.join(tmp, "export.json")
    json.dump({"count": 1, "entries": [{"vendor_id": row["id"], "action": "accept_place", "place_id": row["google"]["place_id"],
              "reason": "Admin duyệt nhận khớp Google", "reviewed_by": "user_admin", "reviewed_at": "2026-11-12T00:00:00Z"}]},
              open(ex, "w"), ensure_ascii=False)
    hq = os.path.join(tmp, "hq"); os.makedirs(os.path.join(hq, "decisions"))
    body = f"---\ndecided_by: capu\n---\nLô duyệt qua admin: {row['id']}\n"
    outside = os.path.join(tmp, "ngoai-decisions.md"); open(outside, "w", encoding="utf-8").write(body)
    os.symlink(outside, os.path.join(hq, "decisions", "2026-11-12-adr-999-duyet-qua-admin-lo-gia.md"))
    open(os.path.join(hq, "decisions", "2026-11-12-adr-998-duyet-qua-admin-lo-that.md"), "w", encoding="utf-8").write(body)
    env = dict(os.environ, PYTHONPATH=nd, GOOGLE_MAPS_API_KEY="")
    def run(dec):
        before = open(mo, "rb").read()
        p = subprocess.run([sys.executable, os.path.join(sc, "apply_admin_reviews.py"), "--state", "HCMC", "--reviews", ex, "--decision", dec,
                            "--approved-on", "2026-11-12", "--output-dir", os.path.join(sc, "output"), "--hq", hq],
                           capture_output=True, text=True, timeout=300, env=env, cwd=tmp)
        changed = open(mo, "rb").read() != before
        open(mo, "wb").write(before)
        return p.returncode, (p.stdout + p.stderr).strip(), changed
    bad = []
    rc, out, ch = run("decisions/2026-11-12-adr-998-duyet-qua-admin-lo-that.md")
    if rc != 0 or not ch:
        bad.append(f"đối chứng: file decision thật phải APPLY_OK và thêm mục (thoát {rc}: {out[-160:]})")
    rc, out, ch = run("decisions/2026-11-12-adr-999-duyet-qua-admin-lo-gia.md")
    if rc != 2 or "APPLY_REFUSED bad_decision" not in out or ch:
        bad.append(f"decision là symlink ra ngoài decisions/ vẫn được nhận (thoát {rc}, file đổi={ch}: {out[-160:]})")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if bad:
    print(f"FAIL {bad[0]}" + (f" (+{len(bad)-1} lỗi nữa)" if len(bad) > 1 else "")); sys.exit(1)
print("PASS decision ngoài decisions/ (symlink) bị APPLY_REFUSED bad_decision, file thật vẫn áp được"); sys.exit(0)
