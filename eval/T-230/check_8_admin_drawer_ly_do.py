"""T-230 tiêu chí 8: admin thấy lý do ở drawer vendor (GET chi tiết enrich): sau bước 6 với báo cáo sinh lại, vendor not_found có
pool.in_pool=false và pool.reasons đúng một mục code "ai_mode_not_found", chữ có "AI Mode"; vendor đối chứng trong pool không có mã đó.
Chạy hàm chi tiết của tohong-back trên bản sao tạm (pool + báo cáo sinh lại), env rỗng (không R2, không mạng)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json, os, subprocess
from lib230 import build, picks, set_field, report, Fail, run

NODE = r"""
const [back, ids] = [process.argv[2], JSON.parse(process.argv[3])];
const m = await import("file://" + back + "/lib/vendorEnrich.js");
const out = {};
for (const id of ids) { const d = await m.getEnrichDetail({}, id, "user_admin"); out[id] = { in_pool: d.pool.in_pool, reasons: d.pool.reasons }; }
process.stdout.write(JSON.stringify(out));
"""


def main():
    st = {}

    def prep(fx):
        (s, c, _), _m = picks(fx)
        st.update(s=s, c=c)
        set_field(fx, s, "not_found")
    fx = build(prep, full_back=True)
    try:
        report(fx)
        fx.regen()
        g = subprocess.run(["node", "tools/generate-vendor-enrich-report.js", "--from",
                            os.path.join(fx.tohong, "tools/scraper/output/HCMC/enrich-report.json")], cwd=fx.back, capture_output=True, text=True, timeout=120)
        if g.returncode != 0:
            raise Fail("generate-vendor-enrich-report.js lỗi: " + (g.stderr or g.stdout)[-300:])
        js = os.path.join(fx.tmp, "probe.mjs")
        open(js, "w").write(NODE)
        p = subprocess.run(["node", js, fx.back, json.dumps([st["s"], st["c"]])], capture_output=True, text=True, timeout=120)
        if p.returncode != 0:
            raise Fail("đọc chi tiết enrich lỗi: " + " ".join(l for l in p.stderr.splitlines() if "Cannot find" in l or "Error" in l)[:400])
        d = json.loads(p.stdout)
        ds, dc = d[st["s"]], d[st["c"]]
        codes = [r["code"] for r in ds["reasons"]]
        if ds["in_pool"] is not False:
            raise Fail(f"{st['s']} vẫn in_pool")
        if codes != ["ai_mode_not_found"]:
            raise Fail(f"{st['s']}: reasons = {codes}, cần ['ai_mode_not_found']")
        if "AI Mode" not in (ds["reasons"][0].get("text") or ""):
            raise Fail(f"chữ lý do không nói AI Mode: {ds['reasons'][0].get('text')!r}")
        if any(r["code"] == "ai_mode_not_found" for r in dc["reasons"]) or dc["in_pool"] is not True:
            raise Fail(f"đối chứng {st['c']} sai: {dc}")
        return f"drawer {st['s']}: ai_mode_not_found ({ds['reasons'][0]['text']})"
    finally:
        fx.close()


run(main)
