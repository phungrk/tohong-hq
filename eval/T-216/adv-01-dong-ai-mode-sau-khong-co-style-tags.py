#!/usr/bin/env python3
"""T-216 adv-01 (tầng 3, adversary): dòng google_ai_mode MỚI HƠN nhưng KHÔNG có khoá changes.style_tags (vd lần enrich sau chỉ ghi giá)
không được làm mất bảo vệ. Spec T-215, Định nghĩa: "lấy dòng CUỐI CÙNG ... có `source` đúng bằng "google_ai_mode" VÀ `changes` là object
CÓ khoá `style_tags`" (ADR-137: "dòng enrichment_log cuối cùng có source: google_ai_mode và changes.style_tags"); eval/lib/regen_fixture.is_protected
cũng đọc như vậy. (Drawer admin không kiểm ở đây: spec không định nghĩa dòng drawer; nên khớp cùng luật.)
Bản sao tạm, không mạng. Chạy: python3 -I <file>."""
import json, os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

LATER = [
    {"source": "google_ai_mode", "timestamp": "2026-12-01T00:00:00Z", "changes": {"price_range": {"min": 1, "max": 2}}},  # changes không có style_tags
    {"source": "google_ai_mode", "timestamp": "2026-12-02T00:00:00Z", "changes": None},                                   # changes không phải object
]


def run():
    probe = R.build()
    try:
        txt = probe.text_tags()
        probe.regen()
        pool = probe.pool()
        cands = sorted({v["id"] for _, v in probe.records() if R.is_protected(v) and v["id"] in pool and set(v["style_tags"]) != txt[v["id"]]})
    finally:
        probe.close()
    if len(cands) < 2:
        raise R.Fail("fixture không đủ vendor có bằng chứng mà tag nguồn khác tag văn bản")
    pick = dict(zip(cands[:2], LATER))

    def prep(fx):
        def ed(vs):
            for v in vs:
                if v["id"] in pick:
                    v["enrichment_log"].append(dict(pick[v["id"]]))
        fx.edit_venue(ed)
    fx = R.build(prep)
    try:
        exp = fx.expected_protected()
        bad = [i for i in pick if i not in exp]
        if bad:
            raise R.Fail("fixture: regen_fixture.is_protected không coi %s là được bảo vệ" % bad)
        fx.regen()
        pa = fx.pool()
        for i in pick:
            if pa[i]["styles"] != exp[i] or pa[i]["tags"] != exp[i]:
                bad.append("%s (thêm dòng google_ai_mode sau %s): pool styles=%s tags=%s, cần %s (tag của dòng google_ai_mode cuối CÓ style_tags)"
                           % (i, json.dumps(pick[i]["changes"]), pa[i]["styles"], pa[i]["tags"], exp[i]))
        if bad:
            raise R.Fail("%d lỗi: %s" % (len(bad), " | ".join(bad)))
        return "dòng google_ai_mode sau không có style_tags không làm mất bảo vệ (%d vendor)" % len(pick)
    finally:
        fx.close()


R.main_guard(run)
