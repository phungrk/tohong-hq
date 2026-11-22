#!/usr/bin/env python3
"""T-219 tiêu chí 12 (offline): enrich bằng Gemini + google_search grounding, hai nhóm CÙNG mẫu prompt.
 - đúng 60 lượt enrich, mỗi lượt có tools google_search, mỗi vendor đúng 1 lượt: 30 'new' (qualified, user_rating_count giảm dần, hoà theo place_id) rồi 30 'venue'
   (có dòng google_ai_mode; sha1(id) tăng dần, không chọn theo có giá); nhóm new chạy hết trước nhóm venue;
 - sau khi thay tên/địa chỉ/category_vi (đúng hai chuỗi của spec) bằng chỗ giữ, văn bản prompt của 60 lượt GIỐNG HỆT nhau; báo cáo prompt.version='p0-enrich-v1' và prompt.sha1 40 hex;
 - enrich.jsonl: 60 dòng đúng khoá; giá chỉ giữ khi qua cổng nguồn (source_url khớp grounding), nếu rớt thì price=null + price_dropped_reason; search_queries=3, calls=1, sources=grounding;
 - báo cáo price.gemini_new/gemini_venue/ai_mode_venue và searches (search_queries=180, enriched_vendors=60, queries_per_vendor=3.0)."""
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
vend = {v["id"]: v for v in __import__("json").load(open(os.path.join(r.out, "venue", "vendors.json"), encoding="utf-8"))["vendors"]}
sig = []
for c in en:
    t = c["text"]
    hit_new = [p for p in new_ids if meta["places"][p]["name"] in t]
    hit_ven = [v for v in ven_ids if vend[v]["name"] in t]
    if len(hit_new) + len(hit_ven) != 1:
        bad.append("một lượt enrich phải nhắm đúng 1 vendor trong 60, thấy %d" % (len(hit_new) + len(hit_ven)))
        break
    if hit_new:
        pid = hit_new[0]
        sig.append(("new", pid, t.replace(meta["places"][pid]["name"], "{NAME}").replace(meta["places"][pid]["address"], "{ADDR}").replace(k.CAT_NEW, "{CAT}"), k.CAT_NEW in t))
    else:
        vid = hit_ven[0]
        sig.append(("venue", vid, t.replace(vend[vid]["name"], "{NAME}").replace(vend[vid]["contact"]["address"], "{ADDR}").replace(k.CAT_VENUE, "{CAT}"), k.CAT_VENUE in t))
if len(sig) == 60:
    if [s[0] for s in sig] != ["new"] * 30 + ["venue"] * 30:
        bad.append("thứ tự phải 30 new rồi 30 venue")
    if sorted(s[1] for s in sig if s[0] == "new") != sorted(new_ids) or sorted(s[1] for s in sig if s[0] == "venue") != sorted(ven_ids):
        bad.append("tập vendor được enrich không đúng luật chọn (new theo user_rating_count; venue theo sha1(id))")
    if len({s[2] for s in sig}) != 1 or not all(s[3] for s in sig) or "{NAME}" not in sig[0][2] or "{ADDR}" not in sig[0][2] or "{CAT}" not in sig[0][2]:
        bad.append("văn bản prompt không giống hệt giữa hai nhóm sau khi thay tên/địa chỉ/category_vi (hoặc thiếu một chỗ điền / chuỗi category_vi)")
rep = k.read_report(r) or {}
pr = rep.get("prompt") or {}
if pr.get("version") != "p0-enrich-v1" or not re.fullmatch(r"[0-9a-f]{40}", str(pr.get("sha1"))):
    bad.append("prompt báo cáo %r" % pr)
rows = []
p = os.path.join(r.path, "p0-out/t/private/enrich.jsonl")
if os.path.exists(p):
    rows = [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]
KEYS = {"group", "id", "name", "price", "price_dropped_reason", "description", "capacity", "contact", "sources", "search_queries", "calls"}
if len(rows) != 60 or any(set(x) != KEYS for x in rows):
    bad.append("enrich.jsonl phải 60 dòng, khoá đúng %s" % sorted(KEYS))
else:
    found = {"new": 0, "venue": 0}
    for x in rows:
        raw = (meta["gem_new"] if x["group"] == "new" else meta["gem_ven"])[x["id"]]
        chunks = [{"uri": u, "title": "example.org"} for u in [s["uri"] for s in x["sources"]]]
        g = k.gate_price(raw.get("price"), chunks)
        if (x["price"] is None) != (g is None) or (g and (x["price"].get("min_vnd"), x["price"].get("unit")) != (g["min_vnd"], g["unit"])):
            bad.append("%s: giá sau cổng nguồn %r, kỳ vọng %r" % (x["id"], x["price"], g))
        if raw.get("price") and g is None and not x["price_dropped_reason"]:
            bad.append("%s: giá bị rớt cổng mà thiếu price_dropped_reason" % x["id"])
        if (x["search_queries"], x["calls"]) != (3, 1) or not x["sources"]:
            bad.append("%s: search_queries/calls = %r/%r, kỳ vọng 3/1" % (x["id"], x["search_queries"], x["calls"]))
        found[x["group"]] += g is not None
    ai_found = sum(1 for v in ven_ids if (meta["gold"][v].get("price_range") or {}).get("min_vnd"))
    pz = rep.get("price") or {}
    exp = {"gemini_new": (30, found["new"]), "gemini_venue": (30, found["venue"]), "ai_mode_venue": (30, ai_found)}
    for kk, (n, f) in exp.items():
        z = pz.get(kk) or {}
        if (z.get("n"), z.get("found")) != (n, f) or abs((z.get("rate") or -1) - round(f / n, 4)) > 5e-5:
            bad.append("báo cáo price.%s = %r, kỳ vọng n=%d found=%d rate=%.4f" % (kk, z, n, f, f / n))
sr = rep.get("searches") or {}
if (sr.get("search_queries"), sr.get("enriched_vendors"), sr.get("queries_per_vendor")) != (180, 60, 3.0):
    bad.append("báo cáo searches %r, kỳ vọng search_queries=180 enriched_vendors=60 queries_per_vendor=3.0" % sr)
k.done(bad, "60 lượt grounding (30 new + 30 venue AI Mode theo sha1), cùng mẫu prompt, cổng nguồn của giá, đếm search đúng")
