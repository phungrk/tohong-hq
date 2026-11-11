#!/usr/bin/env python3
"""T-124 tiêu chí 3 (luồng dữ liệu tohong -> back): dữ liệu enrich nhúng trong back BẰNG báo cáo đã commit ở tohong, và báo cáo đã commit BẰNG
báo cáo sinh lại từ dữ liệu hiện có (không để báo cáo cũ).
Hợp đồng: tohong: tools/scraper/output/HCMC/enrich-report.json (do build_enrich_report.py sinh, commit cùng PR dữ liệu).
          back: lib/vendorEnrichReport.generated.js = `export const VENDOR_ENRICH_REPORT = <đúng nội dung JSON của báo cáo>;` (sinh bằng
          `node tools/generate-vendor-enrich-report.js`, cùng kiểu vendorPool.generated.js; có dòng đầu "AUTO-GENERATED — do not edit manually").
Đo: (a) hai file tồn tại; (b) JSON của back bằng JSON của tohong (so cấu trúc); (c) báo cáo commit bằng báo cáo sinh lại bởi build_enrich_report.py từ
output/ hiện tại (bỏ qua data_as_of nếu hai bên cùng bằng); (d) mọi id trong báo cáo là id có trong tohong-back/lib/vendorPool.generated.js hoặc thuộc nhóm
tạm đóng/đã gỡ (báo cáo có thể nhiều hơn pool, không được thiếu vendor của pool: mọi id của pool phải có dòng). Không gọi Google, không mạng.
Thiếu một trong hai repo: PASS "chưa áp dụng". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import _t124 as t
HQ = t.HQ
tohong = t.tohong_root()
back = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if x and os.path.isfile(os.path.join(x, "worker.js"))), None)
if not tohong or not back:
    print("PASS chưa áp dụng (thiếu repo tohong hoặc tohong-back)"); sys.exit(0)
bad = []
rp = os.path.join(tohong, "tools", "scraper", "output", "HCMC", "enrich-report.json")
bp = os.path.join(back, "lib", "vendorEnrichReport.generated.js")
if not os.path.isfile(rp): bad.append("thiếu %s" % os.path.relpath(rp, tohong))
if not os.path.isfile(bp): bad.append("thiếu %s" % os.path.relpath(bp, back))
if bad:
    print("FAIL " + bad[0]); sys.exit(1)
rep = json.load(open(rp, encoding="utf-8"))
txt = open(bp, encoding="utf-8").read()
m = re.search(r"export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*(.*?);\s*$", txt, re.S)
if not m: print("FAIL back không có `export const VENDOR_ENRICH_REPORT = …;`"); sys.exit(1)
try: emb = json.loads(m.group(1))
except ValueError as e: print("FAIL phần dữ liệu nhúng của back không phải JSON thuần: %s" % e); sys.exit(1)
if "AUTO-GENERATED" not in txt.splitlines()[0]: bad.append("dòng đầu của file back phải ghi AUTO-GENERATED — do not edit manually")
if emb != rep: bad.append("dữ liệu nhúng ở back khác báo cáo ở tohong (sinh lại bằng generate-vendor-enrich-report.js)")
script = os.path.join(tohong, "tools", "scraper", "build_enrich_report.py")
if os.path.isfile(script):
    tmp = tempfile.mkdtemp(prefix="t124-")
    try:
        o = os.path.join(tmp, "r.json")
        shutil.copytree(os.path.join(tohong, "tools", "scraper", "output"), os.path.join(tmp, "output"))
        p = subprocess.run([sys.executable, script, "--state", "HCMC", "--output-dir", os.path.join(tmp, "output"), "--out", o],
                           cwd=os.path.join(tohong, "tools", "scraper"), capture_output=True, text=True, timeout=300)
        if p.returncode != 0: bad.append("build_enrich_report.py thoát %s" % p.returncode)
        else:
            fresh = json.load(open(o, encoding="utf-8"))
            if fresh != rep: bad.append("báo cáo đã commit khác báo cáo sinh lại từ dữ liệu hiện có (báo cáo cũ)")
    finally: shutil.rmtree(tmp, ignore_errors=True)
else: bad.append("thiếu build_enrich_report.py")
pool = open(os.path.join(back, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
pids = set(re.findall(r'"id":"(marry_[0-9a-f]+)"', pool))
rids = {r["id"] for r in rep.get("vendors", [])}
if pids - rids: bad.append("%d vendor của pool app không có dòng trong báo cáo, vd %s" % (len(pids - rids), sorted(pids - rids)[0]))
print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
sys.exit(1 if bad else 0)
