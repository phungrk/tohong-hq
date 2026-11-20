#!/usr/bin/env python3
"""T-216 adv-02 (tầng 3, adversary): biên của "bằng chứng hợp lệ" (spec T-215, Định nghĩa) mà check_2 không chạm.
  e1 changes.style_tags là chuỗi            -> không bảo vệ (tag từ văn bản)
  e2 changes.style_tags là object (không list) -> không bảo vệ
  e3 lẫn hỏng và một phần tử hợp lệ        -> bảo vệ (giữ style_tags nguồn)
  e4 tag sai hoa/thường hoặc có khoảng trắng ("Luxury", " modern ") -> không bảo vệ (so khớp đúng từng ký tự)
  e5 evidence không phải chuỗi (list, null) -> không bảo vệ
  e6 dòng CUỐI của log là google_maps (có phone/website), dòng google_ai_mode trước đó hợp lệ -> bảo vệ
  e7 cùng id có thêm bản ghi ở photography với bằng chứng hỏng và style_tags khác -> pool = tag của bản ghi hợp lệ (venue) thôi
  e8 cùng id có hai bản ghi hợp lệ (photography + venue) -> pool = gộp theo thứ tự đường dẫn (photography trước), bỏ trùng
Bản sao tạm, không mạng. Chạy: python3 -I <file>."""
import copy, json, os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R


def lastrow(v):
    k = None
    for e in v.get("enrichment_log") or []:
        if e.get("source") == "google_ai_mode" and isinstance(e.get("changes"), dict) and "style_tags" in e["changes"]:
            k = e
    return k

def e1(v): lastrow(v)["changes"]["style_tags"] = "luxury, modern"
def e2(v): lastrow(v)["changes"]["style_tags"] = {"tag": "luxury", "evidence": "sảnh sang trọng"}
def e3(v):
    lastrow(v)["changes"]["style_tags"] = ["luxury", {"tag": "Vintage", "evidence": "x"}, {"tag": "modern", "evidence": "  "},
                                           {"tag": "natural", "evidence": "có sân vườn"}]
def e4(v): lastrow(v)["changes"]["style_tags"] = [{"tag": "Luxury", "evidence": "x"}, {"tag": " modern ", "evidence": "y"}]
def e5(v): lastrow(v)["changes"]["style_tags"] = [{"tag": "luxury", "evidence": ["x"]}, {"tag": "modern", "evidence": None}]
def e6(v): v["enrichment_log"].append({"source": "google_maps", "place_id": "ChIJadv02", "timestamp": "2026-12-01T00:00:00Z",
                                       "changes": {"phone": "+84 900 000 000", "website": "https://adv02.example", "address": "1 Adv"}})
CASES = {"e1": (e1, False), "e2": (e2, False), "e3": (e3, True), "e4": (e4, False), "e5": (e5, False), "e6": (e6, True)}


def run():
    probe = R.build()
    try:
        txt = probe.text_tags()
        probe.regen()
        pool = probe.pool()
        cands = sorted({v["id"] for _, v in probe.records() if R.is_protected(v) and v["id"] in pool
                        and set(v["style_tags"]) != txt[v["id"]]})
    finally:
        probe.close()
    if len(cands) < len(CASES) + 2:
        raise R.Fail("fixture không đủ vendor (%d)" % len(cands))
    pick = dict(zip(cands, CASES))
    i7, i8 = cands[len(CASES)], cands[len(CASES) + 1]

    def prep(fx):
        dup = []
        def ed(vs):
            for v in vs:
                if v["id"] in pick:
                    CASES[pick[v["id"]]][0](v)
                if v["id"] == i7:
                    c = copy.deepcopy(v); c["categories"] = ["photography"]; c["style_tags"] = ["korean", "rustic"]
                    for e in c["enrichment_log"]:
                        if e.get("source") == "google_ai_mode": e["source"] = "rescrape_marry"
                    dup.append(c)
                if v["id"] == i8:
                    c = copy.deepcopy(v); c["categories"] = ["photography"]
                    c["style_tags"] = ["korean"] + list(v["style_tags"])[:1]
                    lastrow(c)["changes"]["style_tags"] = [{"tag": "korean", "evidence": "phong cách Hàn"}]
                    dup.append(c)
        fx.edit_venue(ed)
        pf = os.path.join(fx.tohong, "tools/scraper/output/HCMC/photography/vendors.json")
        d = json.load(open(pf, encoding="utf-8"))
        (d["vendors"] if isinstance(d, dict) else d).extend(dup)
        json.dump(d, open(pf, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    fx = R.build(prep)
    try:
        txt, exp = fx.text_tags(), fx.expected_protected()
        for i, c in pick.items():
            if (i in exp) != CASES[c][1]:
                raise R.Fail("fixture: %s/%s is_protected=%s, đọc spec cần %s" % (i, c, i in exp, CASES[c][1]))
        e8 = exp.get(i8, [])
        if not e8 or e8[0] != "korean":
            raise R.Fail("fixture: e8 tag kỳ vọng %s không bắt đầu bằng korean (thứ tự đường dẫn)" % e8)
        fx.regen()
        pa = fx.pool()
        bad = []
        for i, c in list(pick.items()) + [(i7, "e7"), (i8, "e8")]:
            if i not in pa:
                bad.append("%s/%s không còn trong pool" % (i, c)); continue
            s, t = pa[i]["styles"], pa[i]["tags"]
            if i in exp:
                if s != exp[i] or t != exp[i]:
                    bad.append("%s/%s được bảo vệ: pool %s/%s, cần %s" % (c, i, s, t, exp[i]))
            elif s != t or set(s) != txt[i]:
                bad.append("%s/%s không bảo vệ: pool %s/%s, cần tập %s" % (c, i, s, t, sorted(txt[i])))
        if bad:
            raise R.Fail("%d lỗi: %s" % (len(bad), " | ".join(bad)))
        return "8 biên bằng chứng (chuỗi, object, lẫn, hoa/khoảng trắng, evidence không chuỗi, google_maps sau, trùng id hai hạng mục) đúng spec"
    finally:
        fx.close()


R.main_guard(run)
