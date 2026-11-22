#!/usr/bin/env python3
"""T-219 tiêu chí 17 (offline): đọc phản hồi Gemini bỏ rào code. Gemini (nhất là khi có công cụ search) hay bọc JSON trong ```json ... ```. Chạy cùng thế giới chuẩn hai lần: phản hồi trơn
và phản hồi bị bọc rào ```json ... ``` ở CẢ BA vai trò (sinh lưới, phân loại, enrich). Mong đợi: lần bọc rào không tốn thêm lượt thử lại nào (62 lượt Gemini như lần trơn, không dòng 'P0_STOP'),
và mọi kết quả giống hệt: candidates.csv (nhãn phân loại), enrich.jsonl, các khối candidates/price/searches/enrich_flags của báo cáo."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r0, rc0, out0, calls0, meta = k.full_run(run_id="61")
r1, rc1, out1, calls1, _ = k.full_run(run_id="62", fx_patch=lambda fx, m: fx["gemini"].update(fence=["grid", "classify", "enrich"]))
if rc0 != 0 or k.n_kind(calls0, "gemini") != 62:
    bad.append("(eval) lần chạy trơn phải thoát 0 với 62 lượt Gemini, thấy rc=%d, %d lượt" % (rc0, k.n_kind(calls0, "gemini")))
if rc1 != 0 or "P0_STOP" in out1 or k.n_kind(calls1, "gemini") != 62:
    bad.append("phản hồi bọc ```json: rc=%d, %d lượt Gemini, P0_STOP=%s, kỳ vọng rc 0, 62 lượt (không thử lại), không P0_STOP" % (rc1, k.n_kind(calls1, "gemini"), "P0_STOP" in out1))
else:
    a, b = k.read_report(r0) or {}, k.read_report(r1) or {}
    for key in ("candidates", "price", "searches", "enrich_flags"):
        if a.get(key) != b.get(key):
            bad.append("báo cáo khối %s khác giữa phản hồi trơn và phản hồi bọc rào" % key)
    if r0.rows("p0-out/t/private/candidates.csv") != r1.rows("p0-out/t/private/candidates.csv"):
        bad.append("candidates.csv khác giữa phản hồi trơn và phản hồi bọc rào (phân loại không đọc được rào?)")
    e0, e1 = [json.loads(l) for l in open(os.path.join(r0.path, "p0-out/t/private/enrich.jsonl"), encoding="utf-8")], [json.loads(l) for l in open(os.path.join(r1.path, "p0-out/t/private/enrich.jsonl"), encoding="utf-8")]
    if e0 != e1:
        bad.append("enrich.jsonl khác giữa phản hồi trơn và phản hồi bọc rào")
k.done(bad, "phản hồi Gemini bọc ```json được bỏ rào trước khi đọc: 62 lượt như bình thường, kết quả giống hệt")
