#!/usr/bin/env python3
"""T-219 tiêu chí 14 (offline): báo cáo P0. Thế giới chuẩn, chạy thật (run 777):
 - public/p0-report.json có đủ khoá của spec (Hành vi 9) với số khớp thế giới chuẩn: candidates 216/54/3/2/49, yes/no/unsure 37/6/6, qualified 32; searches text_search_calls=56
   details_calls=37 gemini_calls=62 search_queries=180 enriched_vendors=60 queries_per_vendor=3.0; cost basis=net, usd_net~0.496, usd_gross~5.548, by_sku đủ 4 khoá, caps 150/120/80/3.0;
   classification trước khi Capu soát: sample_size=30 reviewed=0 accuracy=null verdict=pending threshold=0.9; run_id='777', category='transport', state='HCMC', dry_run=false, stopped_by=null;
 - public/p0-report.md: dòng đầu '# Báo cáo P0 xe hoa (T-219) · run 777', đúng bảy mục '## 1. …' tới '## 7. …' theo thứ tự, các dòng nhãn đúng, số khớp JSON;
 - --stage report với nhãn Capu: đúng độ đúng (công thức spec) và verdict đạt / không đạt / chờ; nhãn sai dạng -> thoát 2 LABELS_INVALID; place_id lạ -> thoát 2 LABELS_UNKNOWN_ID."""
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
exp = {"text_search_results": 216, "unique_places": 54, "duplicates_existing": 3, "duplicates_removed": 2, "new": 49, "yes": 37, "no": 6, "unsure": 6, "qualified": 32}
if {x: c.get(x) for x in exp} != exp:
    bad.append("candidates %r, kỳ vọng %r" % (c, exp))
s = rep.get("searches") or {}
exp = {"text_search_calls": 56, "details_calls": 37, "gemini_calls": 62, "search_queries": 180, "enriched_vendors": 60, "queries_per_vendor": 3.0}
if {x: s.get(x) for x in exp} != exp:
    bad.append("searches %r, kỳ vọng %r" % (s, exp))
co = rep.get("cost") or {}
bs = co.get("by_sku") or {}
if co.get("basis") != "net" or not near(co.get("usd_net"), 0.496) or not near(co.get("usd_gross"), 5.548, 0.01):
    bad.append("cost basis/usd_net/usd_gross = %r/%r/%r, kỳ vọng net/0.496/5.548" % (co.get("basis"), co.get("usd_net"), co.get("usd_gross")))
if (bs.get("text_search_pro") or {}).get("calls") != 56 or not near((bs.get("text_search_pro") or {}).get("usd_gross"), 1.792) or (bs.get("details_enterprise") or {}).get("calls") != 37 \
        or not near((bs.get("details_enterprise") or {}).get("usd_gross"), 0.74) or (bs.get("gemini_grounding") or {}).get("queries") != 180 or not near((bs.get("gemini_grounding") or {}).get("usd_gross"), 2.52) \
        or ((bs.get("gemini_tokens") or {}).get("input"), (bs.get("gemini_tokens") or {}).get("output")) != (620000, 62000) or not near((bs.get("gemini_tokens") or {}).get("usd"), 0.496):
    bad.append("cost.by_sku sai: %r" % bs)
if co.get("caps") != {"text_search": 150, "details": 120, "gemini": 80, "usd": 3.0}:
    bad.append("cost.caps %r" % co.get("caps"))
cl = rep.get("classification") or {}
if (cl.get("sample_size"), cl.get("reviewed"), cl.get("accuracy"), cl.get("verdict"), cl.get("threshold")) != (30, 0, None, "pending", 0.9):
    bad.append("classification trước khi soát %r" % cl)
md_p = os.path.join(r.path, "p0-out/t/public/p0-report.md")
md = open(md_p, encoding="utf-8").read() if os.path.exists(md_p) else ""
heads = re.findall(r"^## .*$", md, re.M)
want_h = ["## 1. Ứng viên mới", "## 2. Độ đúng phân loại", "## 3. Tỉ lệ có giá", "## 4. Lượt search mỗi vendor", "## 5. Tiền thật", "## 6. So với Google AI Mode", "## 7. Dừng và giới hạn"]
if not md.startswith("# Báo cáo P0 xe hoa (T-219) · run 777") or heads != want_h:
    bad.append("p0-report.md: tiêu đề/ bảy mục sai (thấy %r)" % heads)
for pat in (r"^Ứng viên mới: 49$", r"^Ứng viên đạt ngưỡng \(≥10 đánh giá, ≥4,0 sao\): 32$", r"^Phân loại yes/no/unsure: 37/6/6$", r"^Kết quả Text Search: 216$", r"^Place khác nhau: 54$",
            r"^Trùng vendor đang có: 3$", r"^Trùng vendor đã gỡ: 2$", r"^Mẫu: 30$", r"^Kết luận: chờ Capu soát$", r"^Truy vấn search mỗi vendor: 3([.,]0+)?$", r"^Số vendor enrich: 60$",
            r"^Lượt Gemini: 62$", r"^Lượt Text Search: 56$", r"^Lượt Place Details: 37$", r"^Cơ sở: net$", r"^Gemini · xe hoa mới: \d+/30 \(\d+([.,]\d+)?%\)$", r"^Gemini · venue: \d+/30 \(\d+([.,]\d+)?%\)$",
            r"^AI Mode · venue: \d+/30 \(\d+([.,]\d+)?%\)$", r"^Đề xuất: (ngang|kém|chưa đủ dữ liệu)", r"^Dừng vì: không$"):
    if not re.search(pat, md, re.M):
        bad.append("p0-report.md thiếu dòng khớp %r" % pat)
for f in ("giá", "mô tả", "sức chứa", "liên hệ"):
    if not re.search(r"^%s: \d+/\d+/\d+/\d+/\d+ · " % f, md, re.M):
        bad.append("p0-report.md mục 6 thiếu dòng '%s: a/b/c/d/e · tỉ lệ'" % f)
# --- vòng soát của Capu
rows = r.rows("p0-out/t/private/samples.csv") or []


def labels(path, fn):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["place_id", "capu_label", "capu_note"])
        for i, x in enumerate(rows):
            w.writerow([x["place_id"], fn(i, x), ""])


def exp_acc(lab):
    num = sum(1 for x, l in zip(rows, lab) if x["ai_label"] in ("yes", "no") and l == x["ai_label"])
    den = sum(1 for x, l in zip(rows, lab) if x["ai_label"] in ("yes", "no") and l in ("yes", "no"))
    return (round(num / den, 4) if den else None)


def report(lab_fn, tag):
    lp = os.path.join(r.base, "labels-%s.csv" % tag)
    labels(lp, lab_fn)
    return r.run(["--state", "HCMC", "--category", "transport", "--stage", "report", "--run-dir", "p0-out/t", "--labels", lp], dict(world_fx, deny=True), maps=False, gemini=False)


world_fx = k.world()[2]
yes_idx = [i for i, x in enumerate(rows) if x["ai_label"] == "yes"]
def fn_pass(i, x):
    """2 dòng yes bị Capu sửa thành no (sai), 1 dòng yes Capu để unsure (loại khỏi cả tử lẫn mẫu), còn lại khớp."""
    return "no" if i in yes_idx[:2] else ("unsure" if i == yes_idx[2] else x["ai_label"])


def fn_fail(i, x):
    return "no" if i in yes_idx[:6] else x["ai_label"]


cases = (("pass", fn_pass, "đạt"), ("fail", fn_fail, "không đạt"))
for tag, fn, vt in cases:
    lab = [fn(i, x) for i, x in enumerate(rows)]
    rc, o, cc = report(fn, tag)
    rj = k.read_report(r) or {}
    cl = rj.get("classification") or {}
    ea = exp_acc(lab)
    want_v = "pass" if ea is not None and ea >= 0.9 else "fail"
    if rc != 0 or cc or cl.get("accuracy") is None or ea is None or abs(cl["accuracy"] - ea) > 5e-5 or cl.get("verdict") != want_v or cl.get("reviewed") != 30:
        bad.append("%s: rc=%d classification=%r, kỳ vọng accuracy=%r verdict=%s reviewed=30" % (tag, rc, cl, ea, want_v))
    mdt = open(md_p, encoding="utf-8").read()
    if not re.search(r"^Kết luận: %s$" % ("đạt" if want_v == "pass" else "không đạt"), mdt, re.M) or not re.search(r"^Độ đúng: \d+([.,]\d+)?%", mdt, re.M):
        bad.append("%s: p0-report.md phải có 'Kết luận: %s' và dòng 'Độ đúng: <phần trăm>'" % (tag, "đạt" if want_v == "pass" else "không đạt"))
rc, o, cc = report(lambda i, x: "" if i == 0 else x["ai_label"], "pending")
cl = (k.read_report(r) or {}).get("classification") or {}
if rc != 0 or cl.get("verdict") != "pending" or cl.get("accuracy") is not None or cl.get("reviewed") != 29:
    bad.append("còn 1 dòng chưa soát: classification=%r, kỳ vọng pending/accuracy null/reviewed 29" % cl)
rc, o, cc = report(lambda i, x: "maybe" if i == 3 else x["ai_label"], "bad")
if rc != 2 or "LABELS_INVALID" not in o:
    bad.append("nhãn 'maybe' phải thoát 2 + LABELS_INVALID, rc=%d" % rc)
lp = os.path.join(r.base, "labels-unknown.csv")
open(lp, "w", encoding="utf-8").write("place_id,capu_label\nP999,yes\n")
rc, o, cc = r.run(["--state", "HCMC", "--category", "transport", "--stage", "report", "--run-dir", "p0-out/t", "--labels", lp], dict(world_fx, deny=True), maps=False, gemini=False)
if rc != 2 or "LABELS_UNKNOWN_ID" not in o:
    bad.append("place_id lạ phải thoát 2 + LABELS_UNKNOWN_ID, rc=%d" % rc)
k.done(bad, "báo cáo JSON + markdown đủ khoá/mục, số khớp thế giới chuẩn; stage=report chấm độ đúng và verdict theo công thức, từ chối nhãn sai")
