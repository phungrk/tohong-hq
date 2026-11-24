"""T-231 đối kháng 01 (adversary). Spec T-230 Định nghĩa 2, 5; Hành vi 5, 6, 8.
Một bản sao tạm, một lần bước 6. Mong đợi:
- ai_mode_result là ["not_found"], {"v": "not_found"}, 0, "not_found " (khoảng trắng cuối), "Not_Found": vendor VẪN trong pool; báo cáo sinh được (không lỗi), dòng báo cáo ai_mode_result = null.
- Vendor nhiều bản ghi: bản đầu "not_found" bản sau null -> vắng pool; bản đầu null bản sau "not_found" -> vắng pool; báo cáo = "not_found".
- Drawer: vendor vắng pool vừa not_found vừa group temp_closed và override remove -> đúng một lý do ai_mode_not_found.
Chạy: TOHONG_REPO=... TOHONG_BACK_REPO=... python3 -I eval/T-231/adv-01-gia-tri-la-nhieu-ban-ghi-drawer.py"""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.join(_o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))), "T-230"))
import json, os, subprocess
from lib230 import build, counts, report, Fail, run

ODD = [["not_found"], {"v": "not_found"}, 0, "not_found ", "Not_Found"]
NODE = r"""
const [back, ids] = [process.argv[2], JSON.parse(process.argv[3])];
const m = await import("file://" + back + "/lib/vendorEnrich.js");
const out = {};
for (const id of ids) { const d = await m.getEnrichDetail({}, id, "user_admin"); out[id] = { in_pool: d.pool.in_pool, reasons: d.pool.reasons.map((r) => r.code) }; }
process.stdout.write(JSON.stringify(out));
"""


def set_nth(fx, vid, n, value):
    """Đặt ai_mode_result trên bản ghi thứ n (0-based, theo thứ tự file) của vid; các bản khác đặt None."""
    k = 0
    for f in fx.source_files():
        d = json.load(open(f, encoding="utf-8")); vs = d["vendors"] if isinstance(d, dict) else d; hit = False
        for v in vs:
            if v.get("id") == vid:
                v["ai_mode_result"] = value if k == n else None; k += 1; hit = True
        if hit:
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    if k < 2:
        raise Fail(f"{vid} không đủ bản ghi")


def set_all(fx, vid, value):
    for f in fx.source_files():
        d = json.load(open(f, encoding="utf-8")); vs = d["vendors"] if isinstance(d, dict) else d; hit = False
        for v in vs:
            if v.get("id") == vid:
                v["ai_mode_result"] = value; hit = True
        if hit:
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def main():
    st = {}

    def prep(fx):
        pool, c = fx.pool(), counts(fx)
        single = sorted(i for i in pool if c.get(i) == 1)
        multi = sorted(i for i in pool if c.get(i, 0) >= 2)
        if len(single) < len(ODD) + 1 or len(multi) < 2:
            raise Fail("dữ liệu không đủ vendor")
        st.update(odd=single[:len(ODD)], flag=single[len(ODD)], m0=multi[0], m1=multi[1])
        for vid, val in zip(st["odd"], ODD):
            set_all(fx, vid, val)
        set_all(fx, st["flag"], "not_found")
        set_nth(fx, st["m0"], 0, "not_found")
        set_nth(fx, st["m1"], 1, "not_found")
    fx = build(prep, full_back=True)
    fails, notes = [], []
    try:
        _, rep = report(fx)
        rows = {r["id"]: r for r in (rep.get("rows") or rep.get("vendors") or [])}
        if not rows:
            raise Fail("không đọc được dòng báo cáo")
        for vid, val in zip(st["odd"], ODD):
            if rows.get(vid, {}).get("ai_mode_result", "VẮNG") is not None:
                fails.append(f"báo cáo {vid} ({val!r}): ai_mode_result = {rows.get(vid, {}).get('ai_mode_result', 'VẮNG')!r}, cần null")
        for vid in (st["flag"], st["m0"], st["m1"]):
            if rows.get(vid, {}).get("ai_mode_result") != "not_found":
                fails.append(f"báo cáo {vid}: cần 'not_found', nhận {rows.get(vid, {}).get('ai_mode_result')!r}")
        # Drawer: ép dòng của vendor cờ thành temp_closed + override remove, xem not_found có đứng thay không.
        rp = os.path.join(fx.tohong, "tools/scraper/output/HCMC/enrich-report.json")
        raw = json.load(open(rp, encoding="utf-8"))
        for r in (raw.get("rows") or raw.get("vendors")):
            if r["id"] == st["flag"]:
                r["group"] = "temp_closed"; r["override"] = {"action": "remove"}
        json.dump(raw, open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        fx.regen()
        pool = fx.pool()
        for vid, val in zip(st["odd"], ODD):
            if vid not in pool:
                fails.append(f"{vid} ({val!r}) bị loại khỏi pool")
        for vid in (st["flag"], st["m0"], st["m1"]):
            if vid in pool:
                fails.append(f"{vid} mang not_found vẫn trong pool")
        g = subprocess.run(["node", "tools/generate-vendor-enrich-report.js", "--from", rp], cwd=fx.back, capture_output=True, text=True, timeout=120)
        if g.returncode != 0:
            raise Fail("generate-vendor-enrich-report.js lỗi: " + (g.stderr or g.stdout)[-300:])
        js = os.path.join(fx.tmp, "probe.mjs"); open(js, "w").write(NODE)
        ids = [st["flag"], st["m0"], st["m1"], st["odd"][0]]
        p = subprocess.run(["node", js, fx.back, json.dumps(ids)], capture_output=True, text=True, timeout=120)
        if p.returncode != 0:
            raise Fail("drawer lỗi: " + p.stderr[-300:])
        d = json.loads(p.stdout)
        for vid in ids[:3]:
            if d[vid] != {"in_pool": False, "reasons": ["ai_mode_not_found"]}:
                fails.append(f"drawer {vid}: {d[vid]}, cần in_pool=false, ['ai_mode_not_found']")
        if d[st["odd"][0]]["in_pool"] is not True or "ai_mode_not_found" in d[st["odd"][0]]["reasons"]:
            fails.append(f"drawer {st['odd'][0]} (list): {d[st['odd'][0]]}")
        if fails:
            raise Fail("; ".join(fails))
        return f"5 giá trị lạ giữ pool, 3 vendor cờ (đơn, nhiều bản ghi đầu/sau) vắng pool, drawer temp_closed+remove+not_found -> ai_mode_not_found"
    finally:
        fx.close()


run(main)
