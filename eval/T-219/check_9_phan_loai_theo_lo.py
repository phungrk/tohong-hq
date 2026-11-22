#!/usr/bin/env python3
"""T-219 tiêu chí 9 (offline): phân loại AI theo lô. Thế giới có 55 ứng viên mới (49 chuẩn + 6 phụ: P100 mô hình không trả, P101 trả nhãn 'maybe', P102-105 yes).
 - 2 lượt phân loại (lô 50 theo place_id tăng dần rồi lô 5), mỗi lượt KHÔNG có tools, mỗi place trong lượt có tên, địa chỉ, types; không gửi nhãn đánh giá/rating;
 - nhãn thiếu hoặc ngoài {yes,no,unsure} -> unsure + reason 'model_invalid'; nhãn hợp lệ giữ nguyên cùng reason của mô hình; 55/55 ứng viên có mặt trong candidates.csv;
 - chỉ ứng viên yes được Place Details (đúng tập yes), không no/unsure; báo cáo yes/no/unsure = 41/6/8."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
files, removed, fx, meta = k.world(extra=6)
r = k.Root(files, removed)
rc, out, calls = r.run(k.std_args(), fx)
cl = [c for c in calls if c["kind"] == "gemini" and c["role"] == "classify"]
PID = re.compile(r"(?<![A-Za-z0-9])(P\d{3})(?![A-Za-z0-9])")
sizes = [len(set(PID.findall(c["text"]))) for c in cl]
if sizes != [50, 5]:
    bad.append("kích thước lô %s, kỳ vọng [50, 5]" % sizes)
else:
    first = sorted(meta["new_ids"])[:50]
    if sorted(set(PID.findall(cl[0]["text"]))) != first:
        bad.append("lô 1 phải là 50 place_id nhỏ nhất của ứng viên mới")
for c in cl:
    if c["tools"]:
        bad.append("lượt phân loại không được có tools (không search)")
    for pid in set(PID.findall(c["text"])):
        pl = meta["places"][pid]
        if pl["name"] not in c["text"] or pl["address"] not in c["text"] or "car_rental" not in c["text"]:
            bad.append("lô thiếu tên/địa chỉ/types của %s" % pid)
            break
    if re.search(r"userRatingCount|user_rating_count|reviews|\b4[.,]5\b", c["text"]):
        bad.append("lượt phân loại chỉ được có dữ liệu bậc Pro, không có rating/đánh giá")
cand = {x["place_id"]: x for x in (r.rows("p0-out/t/private/candidates.csv") or [])}
if sorted(cand) != sorted(meta["new_ids"]):
    bad.append("candidates.csv phải có đủ 55 ứng viên mới, thấy %d" % len(cand))
for pid in meta["new_ids"]:
    c = meta["classify"].get(pid, {})
    lab = c.get("label")
    exp_l, exp_r = (lab, c.get("reason")) if lab in ("yes", "no", "unsure") else ("unsure", "model_invalid")
    x = cand.get(pid) or {}
    if x.get("ai_label") != exp_l or x.get("ai_reason") != exp_r:
        bad.append("%s: ai_label/ai_reason = %r/%r, kỳ vọng %r/%r" % (pid, x.get("ai_label"), x.get("ai_reason"), exp_l, exp_r))
        break
yes = {p for p, x in cand.items() if x.get("ai_label") == "yes"}
dets = [re.search(r"/v1/places/([A-Za-z0-9]+)", c["url"]).group(1) for c in calls if c["kind"] == "details"]
if sorted(dets) != sorted(yes) or len(yes) != 41:
    bad.append("Place Details phải đúng cho 41 ứng viên yes (mỗi cái 1 lượt), thấy %d lượt, %d yes" % (len(dets), len(yes)))
cd = (k.read_report(r) or {}).get("candidates") or {}
if (cd.get("yes"), cd.get("no"), cd.get("unsure"), cd.get("new")) != (41, 6, 8, 55):
    bad.append("báo cáo yes/no/unsure/new = %r, kỳ vọng 41/6/8/55" % ((cd.get("yes"), cd.get("no"), cd.get("unsure"), cd.get("new")),))
k.done(bad, "phân loại theo lô 50+5 không tools, nhãn hỏng thành unsure/model_invalid, không bỏ rơi ứng viên, chỉ yes được Place Details")
