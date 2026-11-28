"""T-234 tiêu chí 6: drawer admin (chi tiết enrich tohong-back) phân biệt lý do: vendor vắng pool vì "closed" có đúng một lý do mã "ai_mode_closed"
(chữ có "đóng cửa"); vendor "not_found" vẫn đúng một lý do "ai_mode_not_found"; vendor có cả bản ghi not_found và closed -> "ai_mode_not_found" (ưu tiên báo cáo).
Chạy trên bản sao tạm sau khi sinh lại báo cáo, bước 6 và báo cáo generated của back; env rỗng."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json, os, subprocess
from lib234 import build, single_ids, multi_ids, set_val, report, Fail, run

NODE = r'''
const [back, ids] = [process.argv[2], JSON.parse(process.argv[3])];
const m = await import("file://" + back + "/lib/vendorEnrich.js");
const out = {};
for (const id of ids) { const d = await m.getEnrichDetail({}, id, "user_admin"); out[id] = { in_pool: d.pool.in_pool, reasons: d.pool.reasons }; }
process.stdout.write(JSON.stringify(out));
'''


def main():
    st = {}

    def prep(fx):
        pool = fx.pool()
        c, n = [i for i in single_ids(fx, "invitation", 40) if i in pool][:2]
        (m, cs), = [x for x in multi_ids(fx, 20) if x[0] in pool][:1]
        st.update(c=c, n=n, m=m)
        set_val(fx, c, "invitation", "closed"); set_val(fx, n, "invitation", "not_found")
        set_val(fx, m, cs[0], "closed"); set_val(fx, m, cs[1], "not_found")
    fx = build(prep, full_back=True)
    try:
        report(fx); fx.regen()
        g = subprocess.run(["node", "tools/generate-vendor-enrich-report.js", "--from", os.path.join(fx.tohong, "tools/scraper/output/HCMC/enrich-report.json")],
                           cwd=fx.back, capture_output=True, text=True, timeout=120)
        if g.returncode != 0:
            raise Fail("generate-vendor-enrich-report.js lỗi: " + (g.stderr or g.stdout)[-200:])
        js = os.path.join(fx.tmp, "probe.mjs"); open(js, "w").write(NODE)
        p = subprocess.run(["node", js, fx.back, json.dumps([st["c"], st["n"], st["m"]])], capture_output=True, text=True, timeout=120)
        if p.returncode != 0:
            raise Fail("đọc chi tiết lỗi: " + " ".join(l for l in p.stderr.splitlines() if "Error" in l)[:300])
        d = json.loads(p.stdout)
        exp = {st["c"]: "ai_mode_closed", st["n"]: "ai_mode_not_found", st["m"]: "ai_mode_not_found"}
        bad = [f"{i}: in_pool={d[i]['in_pool']} reasons={[r['code'] for r in d[i]['reasons']]} cần [{e}]" for i, e in exp.items()
               if d[i]["in_pool"] is not False or [r["code"] for r in d[i]["reasons"]] != [e]]
        if bad:
            raise Fail("; ".join(bad))
        t = d[st["c"]]["reasons"][0].get("text") or ""
        if "đóng cửa" not in t or t == d[st["n"]]["reasons"][0].get("text"):
            raise Fail(f"chữ lý do closed không nói đóng cửa hoặc trùng chữ not_found: {t!r}")
        return f"closed -> ai_mode_closed ({t}); not_found và hỗn hợp -> ai_mode_not_found"
    finally:
        fx.close()


run(main)
