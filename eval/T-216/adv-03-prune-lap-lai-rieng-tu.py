#!/usr/bin/env python3
"""T-216 adv-03 (tầng 3, adversary): spec T-215 Hành vi 3/4 và INV-007 (vendor-enrich) ở các tổ hợp tiêu chí 1-4 không chạm.
  (a) vendor CÓ bằng chứng nhưng tạm đóng cửa (audit closed_state=temporarily_closed, không place_id) -> --prune gỡ khỏi pool
  (b) vendor CÓ bằng chứng nhưng đã bị gỡ khỏi nguồn -> --prune gỡ khỏi pool
  (c) chạy regen hai lần liên tiếp -> pool giống từng byte, cây tohong vẫn sạch (ngoài back)
  (d) báo cáo enrich sinh lại: phần enrichment_log trong drawer (pool_input) của vendor có bằng chứng chỉ mang tag + evidence của
      dòng google_ai_mode; không mang phone/website/address/source_urls hay khoá khác của changes (kể cả khi dòng google_ai_mode
      cuối có thêm khoá đó, và dòng google_maps sau nó có liên hệ).
Bản sao tạm, không mạng. Chạy: python3 -I <file>."""
import json, os, subprocess, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

SECRET = ["+84 911 222 333", "https://adv03-leak.example", "99 Đường Rò Rỉ", "https://adv03-src.example/u"]


def lastrow(v):
    k = None
    for e in v.get("enrichment_log") or []:
        if e.get("source") == "google_ai_mode" and isinstance(e.get("changes"), dict) and "style_tags" in e["changes"]:
            k = e
    return k


def run():
    probe = R.build()
    try:
        probe.regen()
        pool = probe.pool()
        cands = sorted({v["id"] for _, v in probe.records() if R.is_protected(v) and v["id"] in pool})
    finally:
        probe.close()
    if len(cands) < 3:
        raise R.Fail("fixture không đủ vendor có bằng chứng trong pool")
    closed, removed, leak = cands[0], cands[1], cands[2]

    def prep(fx):
        def ed(vs):
            vs[:] = [v for v in vs if v["id"] != removed]
            for v in vs:
                if v["id"] == closed:
                    v["enrichment_log"] = [e for e in v["enrichment_log"] if not (e.get("source") == "google_maps" and e.get("place_id"))]
                if v["id"] == leak:
                    ch = lastrow(v)["changes"]
                    ch["phone"], ch["website"], ch["address"] = SECRET[0], SECRET[1], SECRET[2]
                    for x in ch["style_tags"]:
                        if isinstance(x, dict): x["source_urls"] = [SECRET[3]]
                    v["enrichment_log"].append({"source": "google_maps", "place_id": "ChIJadv03", "changes": {"phone": SECRET[0], "website": SECRET[1], "address": SECRET[2]}})
        fx.edit_venue(ed)
        af = os.path.join(fx.tohong, "tools/scraper/output/HCMC/venue/enrichment-audit.json")
        rows = json.load(open(af, encoding="utf-8"))
        rows.append({"vendor_id": closed, "status": "temporarily_closed", "closed_state": "temporarily_closed", "retry": True, "place_id": None})
        json.dump(rows, open(af, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    fx = R.build(prep)
    try:
        bad = []
        fx.regen()
        first = open(fx.pool_file(), "rb").read()
        pa = fx.pool()
        if closed in pa: bad.append("(a) %s có bằng chứng, tạm đóng cửa, vẫn trong pool" % closed)
        if removed in pa: bad.append("(b) %s có bằng chứng, đã gỡ khỏi nguồn, vẫn trong pool" % removed)
        if leak not in pa: bad.append("fixture: %s không còn trong pool" % leak)
        fx.regen()
        if open(fx.pool_file(), "rb").read() != first: bad.append("(c) regen lần 2 cho pool khác lần 1")
        st = fx.git_status()
        if st: bad.append("(c) cây tohong bẩn sau 2 lần regen: %s" % st[:3])
        sc = os.path.join(fx.tohong, "tools", "scraper")
        p = subprocess.run([sys.executable, "build_enrich_report.py"], cwd=sc, env=fx.env, capture_output=True, text=True, timeout=300)
        if p.returncode != 0:
            bad.append("(d) build_enrich_report.py thoát %d: %s" % (p.returncode, (p.stderr or p.stdout)[-200:]))
        else:
            rep = json.load(open(os.path.join(sc, "output", "HCMC", "enrich-report.json"), encoding="utf-8"))
            rows = [r for r in rep.get("vendors", []) if isinstance(r, dict) and r.get("id") == leak]
            if not rows: bad.append("fixture: %s không có dòng trong báo cáo" % leak)
            seen_ev = False
            for r in rows:
                log = ((r.get("pool_input") or {}).get("record") or {}).get("enrichment_log") or []
                blob = json.dumps(log, ensure_ascii=False)
                for s in SECRET:
                    if s in blob: bad.append("(d) drawer enrichment_log của %s mang '%s'" % (leak, s))
                for e in log:
                    if "changes" in e:
                        ch = e["changes"]
                        if e.get("source") != "google_ai_mode" or set(e) != {"source", "changes"} or set(ch) != {"style_tags"}:
                            bad.append("(d) dòng changes lạ: khoá %s / changes %s" % (sorted(e), sorted(ch)))
                        for x in ch.get("style_tags") or []:
                            if set(x) != {"tag", "evidence"}: bad.append("(d) phần tử bằng chứng có khoá %s" % sorted(x))
                        seen_ev = True
            if rows and not seen_ev: bad.append("(d) drawer của %s không có bằng chứng tag" % leak)
            # toàn báo cáo: chuỗi bí mật không ở đâu cả
            whole = json.dumps(rep, ensure_ascii=False)
            for s in SECRET:
                if s in whole: bad.append("(d) báo cáo mang '%s' ở đâu đó" % s)
        if bad:
            raise R.Fail("%d lỗi: %s" % (len(bad), " | ".join(dict.fromkeys(bad))))
        return "prune gỡ vendor có bằng chứng tạm đóng/đã gỡ; regen 2 lần giống byte, cây sạch; drawer chỉ tag+evidence"
    finally:
        fx.close()


R.main_guard(run)
