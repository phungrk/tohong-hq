#!/usr/bin/env python3
"""T-219 tiêu chí 10 (offline, B4): samples.csv cho Capu. Thế giới chuẩn (49 ứng viên mới: 37 true/transport, 3 true/photography, 6 false, 3 unsure): đúng 30 dòng, header đúng thứ tự
place_id,name,address,types,ai_is_wedding_vendor,ai_category,ai_reason,capu_is_wedding_vendor,capu_category,capu_note; ba cột Capu rỗng; tập place_id = 30 place_id đầu khi sắp MỌI ứng viên
đã phân loại theo sha1(place_id) hex tăng dần (hoà theo place_id), KHÔNG phân tầng theo nhãn (ước lượng độ đúng chung); ai_* khớp candidates.csv; hai lần chạy cho cùng tập;
ít ứng viên hơn 30 thì lấy hết."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
HEAD = ["place_id", "name", "address", "types", "ai_is_wedding_vendor", "ai_category", "ai_reason", "capu_is_wedding_vendor", "capu_category", "capu_note"]
sets = []
for run_id in ("11", "12"):
    r, rc, out, calls, meta = k.full_run(run_id=run_id)
    rows = r.rows("p0-out/t/private/samples.csv")
    if rows is None:
        bad.append("thiếu private/samples.csv")
        break
    head = list(open(os.path.join(r.path, "p0-out/t/private/samples.csv"), encoding="utf-8-sig").readline().strip().split(","))
    if head != HEAD:
        bad.append("header %r, kỳ vọng %r" % (head, HEAD))
    if len(rows) != 30:
        bad.append("kỳ vọng 30 dòng, thấy %d" % len(rows))
    if any(x["capu_is_wedding_vendor"] or x["capu_category"] or x["capu_note"] for x in rows):
        bad.append("ba cột capu_* phải để trống")
    exp = k.samples_ref(meta["new_ids"])
    got = [x["place_id"] for x in rows]
    if sorted(got) != sorted(exp):
        bad.append("tập mẫu sai: thừa %s, thiếu %s" % (sorted(set(got) - set(exp))[:4], sorted(set(exp) - set(got))[:4]))
    cand = {x["place_id"]: x for x in (r.rows("p0-out/t/private/candidates.csv") or [])}
    for x in rows:
        c = cand.get(x["place_id"]) or {}
        if (c.get("ai_is_wedding_vendor"), c.get("ai_category"), c.get("ai_reason")) != (x["ai_is_wedding_vendor"], x["ai_category"], x["ai_reason"]):
            bad.append("mẫu %s lệch candidates.csv" % x["place_id"])
            break
    sets.append(sorted(got))
if len(sets) == 2 and sets[0] != sets[1]:
    bad.append("hai lần chạy cho hai tập mẫu khác nhau (phải xác định)")
# ít hơn 30 ứng viên mới: lấy hết (chỉ giữ 20 place của lưới: PHRASINGS chỉ chứa Quận 7 => dùng trang đầu 20 place gồm 5 trùng => 15 ứng viên mới)
files, removed, fx, meta = k.world()
fx["search"][0]["pages"] = [fx["search"][0]["pages"][0]]
r3 = k.Root(files, removed)
rc, out, calls = r3.run(k.std_args(), fx, run_id="13")
rows = r3.rows("p0-out/t/private/samples.csv") or []
cand = r3.rows("p0-out/t/private/candidates.csv") or []
if len(rows) != len(cand) or not (0 < len(cand) < 30) or sorted(x["place_id"] for x in rows) != sorted(x["place_id"] for x in cand):
    bad.append("ít hơn 30 ứng viên: samples.csv phải có đúng mọi ứng viên (%d), thấy %d dòng" % (len(cand), len(rows)))
k.done(bad, "samples.csv 30 dòng đều theo sha1 trên mọi ứng viên đã phân loại, đúng cột, ô Capu để trống, chạy lại cho cùng tập, ít hơn 30 thì lấy hết")
