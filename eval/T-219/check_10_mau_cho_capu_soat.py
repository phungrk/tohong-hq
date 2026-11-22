#!/usr/bin/env python3
"""T-219 tiêu chí 10 (offline): samples.csv cho Capu. Thế giới chuẩn (37 yes, 6 no, 6 unsure): đúng 30 dòng, header đúng thứ tự
place_id,name,address,types,ai_label,ai_reason,capu_label,capu_note; capu_label và capu_note rỗng; tập place_id đúng quy tắc 15 yes + 10 no + 5 unsure (băm sha1 tăng dần
trong nhóm, nhóm thiếu thì bù từ phần còn lại gộp theo sha1); ai_label/ai_reason khớp candidates.csv; hai lần chạy cho cùng tập."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
HEAD = ["place_id", "name", "address", "types", "ai_label", "ai_reason", "capu_label", "capu_note"]
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
    if any(x["capu_label"] or x["capu_note"] for x in rows):
        bad.append("capu_label và capu_note phải để trống")
    labels = {p: meta["classify"][p]["label"] for p in meta["new_ids"]}
    exp = k.samples_ref(labels)
    got = [x["place_id"] for x in rows]
    if sorted(got) != sorted(exp):
        bad.append("tập mẫu sai: thừa %s, thiếu %s" % (sorted(set(got) - set(exp))[:4], sorted(set(exp) - set(got))[:4]))
    cand = {x["place_id"]: x for x in (r.rows("p0-out/t/private/candidates.csv") or [])}
    for x in rows:
        c = cand.get(x["place_id"]) or {}
        if (c.get("ai_label"), c.get("ai_reason")) != (x["ai_label"], x["ai_reason"]):
            bad.append("mẫu %s lệch candidates.csv" % x["place_id"])
            break
    sets.append(sorted(got))
if len(sets) == 2 and sets[0] != sets[1]:
    bad.append("hai lần chạy cho hai tập mẫu khác nhau (phải xác định)")
k.done(bad, "samples.csv 30 dòng, đúng cột, đúng quy tắc 15/10/5 + bù theo sha1, ô Capu để trống, chạy lại cho cùng tập")
