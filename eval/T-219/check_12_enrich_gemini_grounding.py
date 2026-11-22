#!/usr/bin/env python3
"""T-219 tiêu chí 12 (offline): enrich bằng Gemini + google_search grounding, hai nhóm, prompt 2 của Capu NGUYÊN VĂN (eval/T-219/prompts/2.txt).
 - đúng 60 lượt enrich, mỗi lượt có tools google_search, mỗi vendor đúng 1 lượt: 30 'new' (ứng viên qualified, chọn theo sha1(place_id) tăng dần, hoà theo place_id: B5, KHÔNG theo
   số đánh giá) rồi 30 'venue' (có dòng google_ai_mode; sha1(id) tăng dần, không chọn theo có giá); nhóm new chạy hết trước nhóm venue;
 - văn bản mỗi lượt == prompt 2 với {name}, {address}, {category} (new: transport, venue: venue) và {website} thay vào, KHÔNG thêm bớt chữ nào; {website} nhóm new = rỗng (Details không xin
   websiteUri); nhóm venue = contact.website của vendor TRỪ khi một dòng google_ai_mode có khoá contact.website (khi đó rỗng: không lấy website do AI Mode sinh làm đầu vào). Thế giới có 2 venue
   mẫu website từ marry (không phải AI Mode): đúng 2 lượt có website khác rỗng, và website 'gold*.example' của AI Mode không xuất hiện ở lượt nào;
 - báo cáo prompt = {version 'p0-capu-v1', sha1 {1a,1c,2}} = sha1 của ba file prompt nguyên văn;
 - enrich.jsonl: 60 dòng đúng khoá (lược đồ prompt 2 + group,id,name,sources,search_queries,calls); giá chỉ giữ khi qua cổng (same_vendor, khoảng/đơn vị package|per_table, source_url trong grounding,
   quote chứa số tiền); rớt thì price=null + price_dropped_reason đúng lý do; same_vendor=false: mọi giá bị bỏ ('same_vendor_false'), vẫn tính vào n, không vào found;
 - báo cáo price.gemini_new/gemini_venue/ai_mode_venue (n gồm cả same_vendor=false), enrich_flags theo nhóm, searches (search_queries=180, enriched_vendors=60, queries_per_vendor=3.0)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run()
en = [c for c in calls if c["kind"] == "gemini" and c["role"] == "enrich"]
if len(en) != 60 or not all(c["tools"] for c in en):
    bad.append("kỳ vọng 60 lượt enrich đều có tools google_search, thấy %d (tools: %d)" % (len(en), sum(c["tools"] for c in en)))
new_ids = k.pick_new(meta)
ven_ids = meta["sample_ids"]
vend = {v["id"]: v for v in json.load(open(os.path.join(r.out, "venue", "vendors.json"), encoding="utf-8"))["vendors"]}
want = [("new", p, k.prompt2(meta["places"][p]["name"], meta["places"][p]["address"], "", k.CAT_NEW)) for p in new_ids] + \
       [("venue", v, k.prompt2(vend[v]["name"], vend[v]["contact"]["address"], k.venue_website(vend[v]), k.CAT_VENUE)) for v in ven_ids]
if len(en) == 60:
    for i, (c, (g, vid, txt)) in enumerate(zip(en, want)):
        if c["text"] != txt:
            bad.append("lượt enrich thứ %d (%s %s) không bằng prompt 2 nguyên văn với đầu vào kỳ vọng (thứ tự: 30 new theo sha1(place_id), 30 venue theo sha1(id))" % (i + 1, g, vid))
            break
    n_site = sum(1 for _, v, _ in want if v in vend and k.venue_website(vend[v]))
    n_got = sum(1 for c in en[30:] if re.search(r"website: \S", c["text"]))
    if n_site != 2 or n_got != 2 or any(re.search(r"gold\d+\.example", c["text"]) for c in en):
        bad.append("website đầu vào: kỳ vọng đúng 2 lượt có website (marry) và không lượt nào mang website do AI Mode sinh (gold*.example); thấy %d/%d" % (n_got, n_site))
rep = k.read_report(r) or {}
pr = rep.get("prompt") or {}
if pr.get("version") != "p0-capu-v1" or pr.get("sha1") != {"1a": k.sha(k.PROMPT1A), "1c": k.sha(k.PROMPT1C), "2": k.sha(k.PROMPT2)}:
    bad.append("prompt báo cáo %r, kỳ vọng version p0-capu-v1 và sha1 ba prompt nguyên văn" % pr)
rows = []
p = os.path.join(r.path, "p0-out/t/private/enrich.jsonl")
if os.path.exists(p):
    rows = [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
KEYS = {"group", "id", "name", "same_vendor", "still_operating", "category_correct", "description", "price", "price_dropped_reason", "capacity", "style_tags", "phone", "website", "notes", "sources", "search_queries", "calls"}
if len(rows) != 60 or any(set(x) != KEYS for x in rows):
    bad.append("enrich.jsonl phải 60 dòng, khoá đúng %s" % sorted(KEYS))
else:
    found = {"new": 0, "venue": 0}
    flags = {g: {"same_vendor_false": 0, "still_operating_false": 0, "still_operating_unknown": 0, "category_incorrect": 0} for g in ("new", "venue")}
    for x in rows:
        raw = (meta["gem_new"] if x["group"] == "new" else meta["gem_ven"])[x["id"]]
        chunks = [{"uri": s["uri"], "title": s["title"]} for s in x["sources"]]
        g, why = k.gate_price(raw.get("price"), chunks, raw.get("same_vendor"))
        if (x["price"] is None) != (g is None) or (g and (x["price"].get("min_vnd"), x["price"].get("unit")) != (g["min_vnd"], g["unit"])):
            bad.append("%s: giá sau cổng nguồn %r, kỳ vọng %r" % (x["id"], x["price"], g))
        if x["price_dropped_reason"] != why:
            bad.append("%s: price_dropped_reason=%r, kỳ vọng %r" % (x["id"], x["price_dropped_reason"], why))
        if (x["search_queries"], x["calls"]) != (3, 1) or not x["sources"]:
            bad.append("%s: search_queries/calls = %r/%r, kỳ vọng 3/1" % (x["id"], x["search_queries"], x["calls"]))
        if (x["same_vendor"], x["still_operating"], x["category_correct"], x["phone"], x["website"]) != (raw["same_vendor"], raw["still_operating"], raw["category_correct"], raw["phone"], raw["website"]):
            bad.append("%s: same_vendor/still_operating/category_correct/phone/website không giữ đúng phản hồi" % x["id"])
        found[x["group"]] += g is not None
        f = flags[x["group"]]
        f["same_vendor_false"] += raw["same_vendor"] is False
        f["still_operating_false"] += raw["still_operating"] is False
        f["still_operating_unknown"] += raw["still_operating"] == "unknown"
        f["category_incorrect"] += raw["category_correct"] is False
    ai_found = sum(1 for v in ven_ids if (meta["gold"][v].get("price_range") or {}).get("min_vnd"))
    pz = rep.get("price") or {}
    exp = {"gemini_new": (30, found["new"]), "gemini_venue": (30, found["venue"]), "ai_mode_venue": (30, ai_found)}
    for kk, (n, f) in exp.items():
        z = pz.get(kk) or {}
        if (z.get("n"), z.get("found")) != (n, f) or abs((z.get("rate") or -1) - round(f / n, 4)) > 5e-5:
            bad.append("báo cáo price.%s = %r, kỳ vọng n=%d found=%d rate=%.4f" % (kk, z, n, f, f / n))
    if rep.get("enrich_flags") != flags or flags["new"]["same_vendor_false"] < 1 or flags["venue"]["same_vendor_false"] < 1:
        bad.append("báo cáo enrich_flags %r, kỳ vọng %r (mỗi nhóm có ít nhất 1 same_vendor=false)" % (rep.get("enrich_flags"), flags))
sr = rep.get("searches") or {}
if (sr.get("search_queries"), sr.get("enriched_vendors"), sr.get("queries_per_vendor")) != (180, 60, 3.0):
    bad.append("báo cáo searches %r, kỳ vọng search_queries=180 enriched_vendors=60 queries_per_vendor=3.0" % sr)
k.done(bad, "60 lượt grounding bằng prompt 2 nguyên văn (30 new theo sha1 + 30 venue AI Mode theo sha1), website đầu vào không lấy từ AI Mode, cổng nguồn + quote của giá, same_vendor=false, đếm search đúng")
