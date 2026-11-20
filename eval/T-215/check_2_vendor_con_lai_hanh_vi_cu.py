#!/usr/bin/env python3
"""T-215 tiêu chí 2: vendor KHÔNG có bằng chứng hợp lệ giữ hành vi cũ của regen (tag tính lại từ văn bản nguồn, ADR-025); mọi trường khác của pool không đổi.
Bản sao tạm của tohong, 5 vendor có bằng chứng bị làm hỏng mỗi vendor một kiểu (mỗi kiểu làm bản ghi hết được bảo vệ):
  m1 source khác "google_ai_mode"; m2 evidence rỗng/khoảng trắng; m3 tag ngoài 10 tag chuẩn; m4 có dòng google_ai_mode MỚI HƠN với style_tags rỗng; m5 phần tử là chuỗi thay vì object.
Kiểm: (a) 5 vendor đó có styles == tags == tập tag extractor cho ra từ văn bản nguồn (như bất biến pool/inv-001 (b));
      (b) mọi vendor không được bảo vệ khác cũng vậy; (c) >= 10 vendor còn được bảo vệ vẫn giữ nguyên style_tags (kiểm không bảo vệ thiếu);
      (d) so với lần chạy THAM CHIẾU (cùng dữ liệu, bỏ hết khoá style_tags khỏi dòng google_ai_mode): mọi trường của pool giống hệt, trừ styles/tags của vendor được bảo vệ.
Chạy: python3 -I <file>."""
import os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

def last_idx(v):
    k = None
    for i, e in enumerate(v.get("enrichment_log") or []):
        if e.get("source") == "google_ai_mode" and isinstance(e.get("changes"), dict) and "style_tags" in e["changes"]:
            k = i
    return k

def m1(v):
    for e in v["enrichment_log"]:
        if e.get("source") == "google_ai_mode": e["source"] = "manual_note"
def m2(v):
    for x in v["enrichment_log"][last_idx(v)]["changes"]["style_tags"]: x["evidence"] = "   "
def m3(v):
    for x in v["enrichment_log"][last_idx(v)]["changes"]["style_tags"]: x["tag"] = "vintage"
def m4(v):
    v["enrichment_log"].append({"source": "google_ai_mode", "timestamp": "2026-12-01T00:00:00Z", "changes": {"style_tags": []}})
def m5(v):
    e = v["enrichment_log"][last_idx(v)]["changes"]
    e["style_tags"] = [x["tag"] for x in e["style_tags"]]
MUTS = [m1, m2, m3, m4, m5]

def strip(v):
    for e in v.get("enrichment_log") or []:
        if e.get("source") == "google_ai_mode" and isinstance(e.get("changes"), dict): e["changes"].pop("style_tags", None)

def run():
    probe = R.build()
    try:
        recs, txt = probe.records(), probe.text_tags()   # đọc nguồn TRƯỚC regen
        probe.regen()
        in_pool = set(probe.pool())
        cands = [v["id"] for _, v in recs if R.is_protected(v) and v["id"] in in_pool
                 and set(v["style_tags"]) != txt[v["id"]]]
        cands = sorted(set(cands))
    finally:
        probe.close()
    if len(cands) < len(MUTS) + 10:
        raise R.Fail("fixture không đủ vendor có bằng chứng, còn trong pool, mà tag nguồn khác tag văn bản (%d)" % len(cands))
    pick = dict(zip(cands[:len(MUTS)], MUTS))
    def prep(strip_all):
        def p(fx):
            def ed(vs):
                for v in vs:
                    if v["id"] in pick: pick[v["id"]](v)
                    if strip_all: strip(v)
            fx.edit_venue(ed)
        return p
    act, ref = R.build(prep(False)), R.build(prep(True))
    try:
        txt, exp = act.text_tags(), act.expected_protected()   # đọc nguồn TRƯỚC regen
        act.regen(); ref.regen()
        pa, pr = act.pool(), ref.pool()
        bad = []
        for i in pick:
            if i in pa and not (pa[i]["styles"] == pa[i]["tags"] and set(pa[i]["styles"]) == txt[i]):
                bad.append("%s đã hỏng bằng chứng (%s) nhưng pool %s != văn bản %s" % (i, pick[i].__name__, pa[i]["styles"], sorted(txt[i])))
        for i, v in pa.items():
            if i in exp or i in pick: continue
            if i in txt and set(v["styles"]) != txt[i]: bad.append("%s không có bằng chứng: pool %s != văn bản %s" % (i, v["styles"], sorted(txt[i])))
        kept = [i for i, t in exp.items() if i in pa and i not in pick and pa[i]["styles"] == t and pa[i]["tags"] == t]
        if len(kept) < 10: bad.append("chỉ %d vendor còn được bảo vệ giữ nguyên style_tags (cần >= 10)" % len(kept))
        if set(pa) != set(pr): bad.append("tập vendor của pool khác lần tham chiếu: +%s -%s" % (sorted(set(pa) - set(pr))[:2], sorted(set(pr) - set(pa))[:2]))
        for i in set(pa) & set(pr):
            a, r = dict(pa[i]), dict(pr[i])
            if i in exp and i not in pick:
                for k in ("styles", "tags"): a.pop(k, None); r.pop(k, None)
            if a != r:
                k = sorted(k for k in set(a) | set(r) if a.get(k) != r.get(k))
                bad.append("%s: trường %s khác lần tham chiếu" % (i, k)); break
        if bad: raise R.Fail("%d lỗi: %s" % (len(bad), " | ".join(bad[:3])))
        return "5 kiểu bằng chứng hỏng về hành vi cũ; %d vendor còn bảo vệ giữ tag; mọi trường khác giống lần tham chiếu" % len(kept)
    finally:
        act.close(); ref.close()
R.main_guard(run)
