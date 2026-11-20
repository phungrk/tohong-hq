#!/usr/bin/env python3
"""T-215 tiêu chí 4: mô phỏng sync-vendor-pool.yml (tohong-back) trên bản sao tạm: regen --photos-for all -> nhúng báo cáo
(node tools/generate-vendor-enrich-report.js --from <tohong>/tools/scraper/output/HCMC/enrich-report.json) -> 'Kiểm báo cáo tươi'
(build_enrich_report.py --state HCMC ... rồi cmp với enrich-report.json của tohong) -> npm test của back (nếu back có node_modules; không có thì ghi 'bỏ qua test back').
Điều kiện đầu: báo cáo đã commit phải tươi TRƯỚC regen (nếu không là lỗi dữ liệu của PR, không phải của regen). Chạy: python3 -I <file>."""
import subprocess, filecmp
import os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

def sh(cmd, cwd, env, t=900):
    return subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=t)
def run():
    fx = R.build(full_back=True)
    try:
        sc = os.path.join(fx.tohong, "tools", "scraper")
        rep = os.path.join(sc, "output", "HCMC", "enrich-report.json")
        if not os.path.isfile(rep):
            raise R.Fail("tohong không có output/HCMC/enrich-report.json")
        out0 = os.path.join(fx.tmp, "fresh0.json")
        p = sh([sys.executable, "build_enrich_report.py", "--state", "HCMC", "--output-dir", "output", "--out", out0], sc, fx.env)
        if p.returncode != 0 or not filecmp.cmp(out0, rep, shallow=False):
            raise R.Fail("điều kiện đầu: enrich-report.json đã commit không tươi so với dữ liệu cùng commit TRƯỚC regen (lỗi PR dữ liệu, không phải regen)")
        fx.regen()
        emb = os.path.join(fx.back, "tools", "generate-vendor-enrich-report.js")
        if os.path.isfile(emb):
            p = sh(["node", "tools/generate-vendor-enrich-report.js", "--from", rep], fx.back, fx.env)
            if p.returncode != 0:
                raise R.Fail("bước nhúng báo cáo lỗi: " + (p.stderr or p.stdout)[-200:])
        out1 = os.path.join(fx.tmp, "fresh1.json")
        p = sh([sys.executable, "build_enrich_report.py", "--state", "HCMC", "--output-dir", "output", "--out", out1], sc, fx.env)
        if p.returncode != 0:
            raise R.Fail("build_enrich_report.py sau regen lỗi: " + (p.stderr or p.stdout)[-200:])
        if not filecmp.cmp(out1, rep, shallow=False):
            raise R.Fail("Kiểm báo cáo tươi ĐỎ: báo cáo sinh lại từ dữ liệu SAU regen khác enrich-report.json của tohong (regen đã đổi dữ liệu nguồn)")
        note = "bỏ qua test back (back không có node_modules)"
        if os.path.isdir(os.path.join(fx.back, "node_modules")):
            p = sh(["npm", "test", "--silent"], fx.back, fx.env, 900)
            if p.returncode != 0:
                raise R.Fail("npm test của back đỏ với pool sinh ra: " + (p.stdout + p.stderr)[-300:])
            note = "npm test của back xanh"
        return "báo cáo tươi sau regen; " + note
    finally:
        fx.close()
R.main_guard(run)
