#!/usr/bin/env python3
"""T-219 tiêu chí 9 (offline): phân loại AI theo lô bằng prompt 1c nguyên văn (10 hạng mục). Thế giới có 55 ứng viên mới (49 chuẩn + 6 phụ: P100 mô hình không trả dòng, P101 trả
is_wedding_vendor 'maybe', P102 trả true với category 'hoa' (ngoài 10 hạng mục), P103-105 true/transport).
 - 2 lượt phân loại (lô 50 theo place_id tăng dần rồi lô 5), mỗi lượt KHÔNG có tools; văn bản gửi = prompt 1c NGUYÊN VĂN + dòng trống + mỗi place một dòng `id | tên | types | địa chỉ`
   (types nối bằng ', '), không có rating/số đánh giá;
 - phản hồi theo lược đồ 1c ({id, is_wedding_vendor, category, reason}): true cần category thuộc 10 hạng mục, false/unsure ghi category rỗng; thiếu dòng / giá trị lạ / true mà category
   ngoài danh sách -> unsure + category rỗng + reason 'model_invalid'; dòng hợp lệ giữ nguyên reason; 55/55 ứng viên có mặt trong candidates.csv;
 - chỉ ứng viên is_wedding_vendor=true VÀ category=transport (40) được Place Details (hạng mục khác, false, unsure thì không); studio ảnh (photography) vẫn nằm trong bảng và đếm theo hạng mục;
 - báo cáo: new=55, vendor_true/false/unsure = 43/6/6, by_category transport=40 photography=3 (còn lại 0), unsure_rate = 6/55."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
files, removed, fx, meta = k.world(extra=6)
r = k.Root(files, removed)
rc, out, calls = r.run(k.std_args(), fx)
cl = [c for c in calls if c["kind"] == "gemini" and c["role"] == "classify"]
PID = re.compile(r"(?<![A-Za-z0-9])(P\d{3})(?![A-Za-z0-9])")
sizes = [len(set(PID.findall(c["text"].split("\n\n", 1)[-1]))) for c in cl]
if sizes != [50, 5]:
    bad.append("kích thước lô %s, kỳ vọng [50, 5]" % sizes)
else:
    ids = sorted(meta["new_ids"])
    for c, part in zip(cl, (ids[:50], ids[50:])):
        pl = meta["places"]
        want = k.prompt1c_text([(p, pl[p]["name"], pl[p]["types"], pl[p]["address"]) for p in part])
        if c["text"] != want:
            bad.append("văn bản lô phân loại không đúng 'prompt 1c nguyên văn + dòng trống + id | tên | types | địa chỉ' (lô %d place)" % len(part))
for c in cl:
    if c["tools"]:
        bad.append("lượt phân loại không được có tools (không search)")
cand = {x["place_id"]: x for x in (r.rows("p0-out/t/private/candidates.csv") or [])}
if sorted(cand) != sorted(meta["new_ids"]):
    bad.append("candidates.csv phải có đủ 55 ứng viên mới, thấy %d" % len(cand))
for pid in meta["new_ids"]:
    v, cat, rs = k.norm_class(meta["classify"].get(pid))
    x = cand.get(pid) or {}
    if (x.get("ai_is_wedding_vendor"), x.get("ai_category") or None, x.get("ai_reason")) != (v, cat, rs):
        bad.append("%s: ai_is_wedding_vendor/ai_category/ai_reason = %r/%r/%r, kỳ vọng %r/%r/%r" % (pid, x.get("ai_is_wedding_vendor"), x.get("ai_category"), x.get("ai_reason"), v, cat, rs))
        break
go = {p for p, x in cand.items() if x.get("ai_is_wedding_vendor") == "true" and x.get("ai_category") == "transport"}
dets = [re.search(r"/v1/places/([A-Za-z0-9]+)", c["url"]).group(1) for c in calls if c["kind"] == "details"]
if sorted(dets) != sorted(go) or len(go) != 40:
    bad.append("Place Details phải đúng cho 40 ứng viên true/transport (mỗi cái 1 lượt), thấy %d lượt, %d true/transport" % (len(dets), len(go)))
for p, x in cand.items():
    if p not in go and x.get("details_status"):
        bad.append("%s không phải true/transport mà có details_status=%r" % (p, x.get("details_status")))
        break
cd = (k.read_report(r) or {}).get("candidates") or {}
bc = cd.get("by_category") or {}
want_bc = {c: 0 for c in k.CATS10}
want_bc.update(transport=40, photography=3)
if (cd.get("new"), cd.get("vendor_true"), cd.get("vendor_false"), cd.get("vendor_unsure")) != (55, 43, 6, 6) or bc != want_bc \
        or not isinstance(cd.get("unsure_rate"), (int, float)) or abs(cd["unsure_rate"] - round(6 / 55, 4)) > 5e-5:
    bad.append("báo cáo new/vendor_true/vendor_false/vendor_unsure = %r, by_category=%r, unsure_rate=%r; kỳ vọng 55/43/6/6, %r, %.4f" % (
        (cd.get("new"), cd.get("vendor_true"), cd.get("vendor_false"), cd.get("vendor_unsure")), bc, cd.get("unsure_rate"), want_bc, 6 / 55))
k.done(bad, "phân loại theo lô 50+5 bằng prompt 1c nguyên văn, không tools, giá trị hỏng thành unsure/model_invalid, không bỏ rơi ứng viên, chỉ true/transport được Place Details, đếm theo hạng mục")
