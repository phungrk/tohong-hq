#!/usr/bin/env python3
"""T-219 tiêu chí 14 (offline): báo cáo P0. Thế giới chuẩn, chạy thật (run 777):
 - public/p0-report.json có đủ khoá của spec (Hành vi 9) với số khớp thế giới chuẩn: candidates 216/54/3/2/49, vendor_true/false/unsure 40/6/3, by_category transport=37 photography=3 (còn lại 0),
   unsure_rate=0.0612, qualified 32; searches text_search_calls=104 details_calls=37 gemini_calls=62 search_queries=180 enriched_vendors=60 queries_per_vendor=3.0; cost (B6): basis=net,
   usd_net_run~0.496, usd_net_month~0.496, usd_gross_run~7.084, by_sku đủ 4 khoá, caps 288/120/100/3.0; classification trước khi Capu soát: sample_size=30 reviewed=0 accuracy=null
   verdict=pending threshold=0.9, ai_unsure_in_sample=3; run_id='777', category='transport', state='HCMC', dry_run=false, stopped_by=null;
 - public/p0-report.md: dòng đầu '# Báo cáo P0 xe hoa (T-219) · run 777', đúng bảy mục '## 1. …' tới '## 7. …' theo thứ tự, các dòng nhãn đúng, số khớp JSON;
 - --stage report với CSV Capu (cột place_id,capu_is_wedding_vendor,capu_category) chấm theo B1+B4: một dòng mẫu ĐÚNG khi AI nói true/false (không phải unsure) VÀ Capu cùng is_wedding_vendor VÀ,
   khi true, cùng category; AI 'unsure' luôn tính CHƯA đúng; mẫu số = sample_size (30, mọi dòng phải soát). Capu đồng ý hết 30 dòng: 27/30 = 0,9 (3 dòng AI unsure trong mẫu) => 'đạt' đúng ở ngưỡng;
   sửa một dòng is_wedding_vendor hoặc chỉ một category => 26/30 'không đạt'; còn dòng trống => pending, accuracy null; nhãn/category sai dạng -> thoát 2 LABELS_INVALID; place_id lạ -> thoát 2 LABELS_UNKNOWN_ID."""
import csv, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run(run_id="777")
rep = k.read_report(r) or {}


def near(a, b, t=0.002):
    return isinstance(a, (int, float)) and abs(a - b) <= t


top = {"schema": "p0-report/1", "run_id": "777", "category": "transport", "state": "HCMC", "dry_run": False, "stopped_by": None, "gemini_model": "gemini-3-flash-preview"}
for kk, v in top.items():
    if rep.get(kk) != v or kk not in rep:
        bad.append("%s = %r, kỳ vọng %r" % (kk, rep.get(kk), v))
c = rep.get("candidates") or {}
exp = {"text_search_results": 216, "unique_places": 54, "duplicates_existing": 3, "duplicates_removed": 2, "new": 49, "vendor_true": 40, "vendor_false": 6, "vendor_unsure": 3, "qualified": 32}
if {x: c.get(x) for x in exp} != exp:
    bad.append("candidates %r, kỳ vọng %r" % (c, exp))
wbc = {x: 0 for x in k.CATS10}
wbc.update(transport=37, photography=3)
if c.get("by_category") != wbc or not near(c.get("unsure_rate"), round(3 / 49, 4), 5e-5):
    bad.append("candidates.by_category/unsure_rate = %r/%r, kỳ vọng %r/%.4f" % (c.get("by_category"), c.get("unsure_rate"), wbc, 3 / 49))
s = rep.get("searches") or {}
exp = {"text_search_calls": 104, "details_calls": 37, "gemini_calls": 62, "search_queries": 180, "enriched_vendors": 60, "queries_per_vendor": 3.0}
if {x: s.get(x) for x in exp} != exp:
    bad.append("searches %r, kỳ vọng %r" % (s, exp))
co = rep.get("cost") or {}
bs = co.get("by_sku") or {}
if co.get("basis") != "net" or not near(co.get("usd_net_run"), 0.496) or not near(co.get("usd_net_month"), 0.496) or not near(co.get("usd_gross_run"), 7.084, 0.01):
    bad.append("cost basis/usd_net_run/usd_net_month/usd_gross_run = %r/%r/%r/%r, kỳ vọng net/0.496/0.496/7.084" % (co.get("basis"), co.get("usd_net_run"), co.get("usd_net_month"), co.get("usd_gross_run")))
if (bs.get("text_search_pro") or {}).get("calls") != 104 or not near((bs.get("text_search_pro") or {}).get("usd_gross"), 3.328) or (bs.get("details_enterprise") or {}).get("calls") != 37 \
        or not near((bs.get("details_enterprise") or {}).get("usd_gross"), 0.74) or (bs.get("gemini_grounding") or {}).get("queries") != 180 or not near((bs.get("gemini_grounding") or {}).get("usd_gross"), 2.52) \
        or ((bs.get("gemini_tokens") or {}).get("input"), (bs.get("gemini_tokens") or {}).get("output")) != (620000, 62000) or not near((bs.get("gemini_tokens") or {}).get("usd"), 0.496):
    bad.append("cost.by_sku sai: %r" % bs)
if co.get("caps") != {"text_search": 288, "details": 120, "gemini": 100, "usd": 3.0}:
    bad.append("cost.caps %r" % co.get("caps"))
cl = rep.get("classification") or {}
if (cl.get("sample_size"), cl.get("reviewed"), cl.get("accuracy"), cl.get("verdict"), cl.get("threshold"), cl.get("ai_unsure_in_sample")) != (30, 0, None, "pending", 0.9, 3):
    bad.append("classification trước khi soát %r" % cl)
md_p = os.path.join(r.path, "p0-out/t/public/p0-report.md")
md = open(md_p, encoding="utf-8").read() if os.path.exists(md_p) else ""
heads = re.findall(r"^## .*$", md, re.M)
want_h = ["## 1. Ứng viên mới", "## 2. Độ đúng phân loại", "## 3. Tỉ lệ có giá", "## 4. Lượt search mỗi vendor", "## 5. Tiền thật", "## 6. So với Google AI Mode", "## 7. Dừng và giới hạn"]
if not md.startswith("# Báo cáo P0 xe hoa (T-219) · run 777") or heads != want_h:
    bad.append("p0-report.md: tiêu đề/ bảy mục sai (thấy %r)" % heads)
for pat in (r"^Ứng viên mới: 49$", r"^Ứng viên đạt ngưỡng \(≥10 đánh giá, ≥4,0 sao\): 32$", r"^Phân loại vendor cưới có/không/unsure: 40/6/3$", r"^Tỉ lệ unsure: 6[.,]1%$", r"^Theo hạng mục: " + " ".join("%s=%d" % (x, wbc[x]) for x in k.CATS10) + "$", r"^Kết quả Text Search: 216$", r"^Place khác nhau: 54$",
            r"^Trùng vendor đang có: 3$", r"^Trùng vendor đã gỡ: 2$", r"^Mẫu: 30$", r"^Kết luận: chờ Capu soát$", r"^Truy vấn search mỗi vendor: 3([.,]0+)?$", r"^Số vendor enrich: 60$",
            r"^Lượt Gemini: 62$", r"^Lượt Text Search: 104$", r"^Lượt Place Details: 37$", r"^Cơ sở: net$", r"^Chi lần này, net: 0\.496", r"^Chi luỹ kế tháng, net: 0\.496", r"^Chi lần này, gross: 7\.08", r"^Vendor same_vendor=false: new=\d+ venue=\d+$", r"^Unsure của AI trong mẫu: 3$", r"^Gemini · xe hoa mới: \d+/30 \(\d+([.,]\d+)?%\)$", r"^Gemini · venue: \d+/30 \(\d+([.,]\d+)?%\)$",
            r"^AI Mode · venue: \d+/30 \(\d+([.,]\d+)?%\)$", r"^Đề xuất: (ngang|kém|chưa đủ dữ liệu)", r"^Dừng vì: không$"):
    if not re.search(pat, md, re.M):
        bad.append("p0-report.md thiếu dòng khớp %r" % pat)
for f in ("giá", "mô tả", "sức chứa", "liên hệ"):
    if not re.search(r"^%s: \d+/\d+/\d+/\d+/\d+ · " % f, md, re.M):
        bad.append("p0-report.md mục 6 thiếu dòng '%s: a/b/c/d/e · tỉ lệ'" % f)
# --- vòng soát của Capu
rows = r.rows("p0-out/t/private/samples.csv") or []


def write_labels(path, fn):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["place_id", "capu_is_wedding_vendor", "capu_category"])
        for i, x in enumerate(rows):
            is_, cat = fn(i, x)
            w.writerow([x["place_id"], is_, cat])


def is_correct(x, is_, cat):
    return x["ai_is_wedding_vendor"] in ("true", "false") and is_ == x["ai_is_wedding_vendor"] and (x["ai_is_wedding_vendor"] == "false" or cat == x["ai_category"])


def report(fn, tag):
    lp = os.path.join(r.base, "labels-%s.csv" % tag)
    write_labels(lp, fn)
    return r.run(["--state", "HCMC", "--category", "transport", "--stage", "report", "--run-dir", "p0-out/t", "--labels", lp], dict(world_fx, deny=True), maps=False, gemini=False)


world_fx = k.world()[2]
true_idx = [i for i, x in enumerate(rows) if x["ai_is_wedding_vendor"] == "true"]
agree = lambda i, x: (x["ai_is_wedding_vendor"], x["ai_category"])          # Capu đồng ý mọi dòng (kể cả nói 'unsure' khi AI unsure)
n_unsure = sum(1 for x in rows if x["ai_is_wedding_vendor"] == "unsure")
if len(rows) != 30 or n_unsure != 3 or len(true_idx) < 3:
    bad.append("mẫu chuẩn phải có 30 dòng với 3 dòng AI unsure (thấy %d dòng, %d unsure)" % (len(rows), n_unsure))


def flip_is(i, x):
    return ("false", "") if i == true_idx[0] else agree(i, x)


def flip_cat(i, x):
    return (x["ai_is_wedding_vendor"], "photography" if x["ai_category"] != "photography" else "transport") if i == true_idx[1] else agree(i, x)


def flip_many(i, x):
    return ("false", "") if i in true_idx[:6] else agree(i, x)


cases = (("dong-y-het", agree, "pass"), ("sai-is", flip_is, "fail"), ("sai-category", flip_cat, "fail"), ("sai-nhieu", flip_many, "fail"))
for tag, fn, want_v in cases:
    pairs = [fn(i, x) for i, x in enumerate(rows)]
    ea = round(sum(1 for x, (a_, c_) in zip(rows, pairs) if is_correct(x, a_, c_)) / len(rows), 4)
    rc, o, cc = report(fn, tag)
    cl = (k.read_report(r) or {}).get("classification") or {}
    wv = "pass" if ea >= 0.9 else "fail"
    if wv != want_v:
        bad.append("(eval) ca %s: công thức cho %s, ca dự định %s" % (tag, wv, want_v))
    if rc != 0 or cc or cl.get("accuracy") is None or abs(cl["accuracy"] - ea) > 5e-5 or cl.get("verdict") != wv or cl.get("reviewed") != 30:
        bad.append("%s: rc=%d classification=%r, kỳ vọng accuracy=%r (đúng / 30, AI unsure tính chưa đúng) verdict=%s reviewed=30" % (tag, rc, cl, ea, wv))
    mdt = open(md_p, encoding="utf-8").read()
    if not re.search(r"^Kết luận: %s$" % ("đạt" if wv == "pass" else "không đạt"), mdt, re.M) or not re.search(r"^Độ đúng: \d+([.,]\d+)?%", mdt, re.M):
        bad.append("%s: p0-report.md phải có 'Kết luận: %s' và dòng 'Độ đúng: <phần trăm>'" % (tag, "đạt" if wv == "pass" else "không đạt"))
rc, o, cc = report(lambda i, x: ("", "") if i == 0 else agree(i, x), "pending")
cl = (k.read_report(r) or {}).get("classification") or {}
if rc != 0 or cl.get("verdict") != "pending" or cl.get("accuracy") is not None or cl.get("reviewed") != 29:
    bad.append("còn 1 dòng chưa soát: classification=%r, kỳ vọng pending/accuracy null/reviewed 29" % cl)
for tag, fn in (("maybe", lambda i, x: ("maybe", "") if i == 3 else agree(i, x)), ("true-khong-category", lambda i, x: ("true", "") if i == true_idx[0] else agree(i, x)),
                ("category-la", lambda i, x: ("true", "hoa") if i == true_idx[0] else agree(i, x))):
    rc, o, cc = report(fn, tag)
    if rc != 2 or "LABELS_INVALID" not in o:
        bad.append("nhãn %s phải thoát 2 + LABELS_INVALID, rc=%d" % (tag, rc))
lp = os.path.join(r.base, "labels-unknown.csv")
open(lp, "w", encoding="utf-8").write("place_id,capu_is_wedding_vendor,capu_category\nP999,true,transport\n")
rc, o, cc = r.run(["--state", "HCMC", "--category", "transport", "--stage", "report", "--run-dir", "p0-out/t", "--labels", lp], dict(world_fx, deny=True), maps=False, gemini=False)
if rc != 2 or "LABELS_UNKNOWN_ID" not in o:
    bad.append("place_id lạ phải thoát 2 + LABELS_UNKNOWN_ID, rc=%d" % rc)
k.done(bad, "báo cáo JSON + markdown đủ khoá/mục, số khớp thế giới chuẩn, tiền tách lần chạy/luỹ kế tháng; stage=report chấm độ đúng (is_wedding_vendor + category, AI unsure tính chưa đúng, mẫu số 30), từ chối nhãn sai")
