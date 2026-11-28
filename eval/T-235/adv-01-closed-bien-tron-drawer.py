"""T-235 đối kháng 01 (adversary). Spec T-234 Hành vi 2, 3, 4: giá trị "closed".
Một bản sao tạm, một lần bước 6. Mong đợi:
- Biến thể "Closed", "closed ", " closed", "CLOSED", ["closed"], "permanently_closed": vendor VẪN trong pool, báo cáo null.
- Nhiều bản ghi trộn: [closed, found] -> vắng pool, báo cáo closed; [found, closed] (cờ ở bản sau) -> vắng, closed;
  [closed, wrong_category] -> vắng, closed; [wrong_category, found] -> còn pool, wrong_category; [not_found, closed] -> vắng, not_found.
- Drawer: đơn closed mà dòng báo cáo bị ép group temp_closed + override remove -> đúng ['ai_mode_closed'];
  [closed, found] -> ['ai_mode_closed']; [not_found, closed] -> ['ai_mode_not_found']; vendor wrong_category còn pool không có mã AI Mode.
Chạy: TOHONG_REPO=... TOHONG_BACK_REPO=... python3 -I eval/T-235/adv-01-closed-bien-tron-drawer.py"""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.join(_o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))), "T-230"))
import json, os, subprocess
from lib230 import build, counts, report, Fail, run

ODD = ["Closed", "closed ", " closed", "CLOSED", ["closed"], "permanently_closed"]
# (tên, giá trị theo thứ tự bản ghi, kỳ vọng còn pool, kỳ vọng báo cáo, kỳ vọng drawer)
MIX = [("closed+found", ["closed", "found"], False, "closed", ["ai_mode_closed"]),
       ("found+closed", ["found", "closed"], False, "closed", ["ai_mode_closed"]),
       ("closed+wrong", ["closed", "wrong_category"], False, "closed", ["ai_mode_closed"]),
       ("wrong+found", ["wrong_category", "found"], True, "wrong_category", None),
       ("notfound+closed", ["not_found", "closed"], False, "not_found", ["ai_mode_not_found"])]
NODE = r"""
const [back, ids] = [process.argv[2], JSON.parse(process.argv[3])];
const m = await import("file://" + back + "/lib/vendorEnrich.js");
const out = {};
for (const id of ids) { const d = await m.getEnrichDetail({}, id, "user_admin"); out[id] = { in_pool: d.pool.in_pool, reasons: d.pool.reasons.map((r) => r.code) }; }
process.stdout.write(JSON.stringify(out));
"""


def edit(fx, vid, values):
    """values: một giá trị cho mọi bản ghi, hoặc list theo thứ tự bản ghi."""
    k = 0
    for f in fx.source_files():
        d = json.load(open(f, encoding="utf-8")); vs = d["vendors"] if isinstance(d, dict) else d; hit = False
        for v in vs:
            if v.get("id") == vid:
                v["ai_mode_result"] = values[k] if isinstance(values, tuple) else values; k += 1; hit = True
        if hit:
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    if isinstance(values, tuple) and k != len(values):
        raise Fail(f"{vid}: {k} bản ghi, cần {len(values)}")


def main():
    st = {}

    def prep(fx):
        pool, c = fx.pool(), counts(fx)
        single = sorted(i for i in pool if c.get(i) == 1)
        two = sorted(i for i in pool if c.get(i) == 2)
        if len(single) < len(ODD) + 1 or len(two) < len(MIX):
            raise Fail("dữ liệu không đủ vendor")
        st.update(odd=single[:len(ODD)], flag=single[len(ODD)], mix=two[:len(MIX)])
        for vid, val in zip(st["odd"], ODD):
            edit(fx, vid, val)
        edit(fx, st["flag"], "closed")
        for vid, (_, vals, *_r) in zip(st["mix"], MIX):
            edit(fx, vid, tuple(vals))
    fx = build(prep, full_back=True)
    fails = []
    try:
        _, rep = report(fx)
        rows = {r["id"]: r for r in (rep.get("rows") or rep.get("vendors") or [])}
        for vid, val in zip(st["odd"], ODD):
            if rows.get(vid, {}).get("ai_mode_result", "VẮNG") is not None:
                fails.append(f"báo cáo {vid} ({val!r}): {rows.get(vid, {}).get('ai_mode_result', 'VẮNG')!r}, cần null")
        if rows.get(st["flag"], {}).get("ai_mode_result") != "closed":
            fails.append(f"báo cáo {st['flag']}: cần closed")
        for vid, (name, _, _, want, _) in zip(st["mix"], MIX):
            if rows.get(vid, {}).get("ai_mode_result") != want:
                fails.append(f"báo cáo {name} {vid}: {rows.get(vid, {}).get('ai_mode_result')!r}, cần {want!r}")
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
        if st["flag"] in pool:
            fails.append(f"{st['flag']} closed vẫn trong pool")
        for vid, (name, _, keep, *_r) in zip(st["mix"], MIX):
            if (vid in pool) != keep:
                fails.append(f"{name} {vid}: trong pool = {vid in pool}, cần {keep}")
        g = subprocess.run(["node", "tools/generate-vendor-enrich-report.js", "--from", rp], cwd=fx.back, capture_output=True, text=True, timeout=120)
        if g.returncode != 0:
            raise Fail("generate-vendor-enrich-report.js lỗi: " + (g.stderr or g.stdout)[-300:])
        js = os.path.join(fx.tmp, "probe.mjs"); open(js, "w").write(NODE)
        ids = [st["flag"], *st["mix"]]
        p = subprocess.run(["node", js, fx.back, json.dumps(ids)], capture_output=True, text=True, timeout=120)
        if p.returncode != 0:
            raise Fail("drawer lỗi: " + p.stderr[-300:])
        d = json.loads(p.stdout)
        if d[st["flag"]] != {"in_pool": False, "reasons": ["ai_mode_closed"]}:
            fails.append(f"drawer closed+temp_closed+remove {st['flag']}: {d[st['flag']]}")
        for vid, (name, _, keep, _, want) in zip(st["mix"], MIX):
            if keep:
                if d[vid]["in_pool"] is not True or any(c.startswith("ai_mode_") for c in d[vid]["reasons"]):
                    fails.append(f"drawer {name}: {d[vid]}")
            elif d[vid] != {"in_pool": False, "reasons": want}:
                fails.append(f"drawer {name} {vid}: {d[vid]}, cần {want}")
        if fails:
            raise Fail("; ".join(fails))
        return "6 biến thể closed giữ pool; 5 tổ hợp nhiều bản ghi đúng pool/báo cáo/drawer; closed+temp_closed+remove -> ai_mode_closed"
    finally:
        fx.close()


run(main)
