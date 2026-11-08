#!/usr/bin/env python3
"""Tiêu chí 7: giảm nhiễu VÀ không tuyển lọc. Một model; mọi lượt đã khởi chạy đều có hồ sơ (kể cả lượt bị loại, có cờ excluded + lý do + bằng chứng);
lý do loại chỉ thuộc tập cho phép và phải KHỚP kết quả quét lại transcript (không loại lượt không có vi phạm, không giữ lượt có vi phạm);
trần lượt loại mỗi ô và tổng; số lượt HỢP LỆ mỗi ô đúng bằng con số suy ra được (2, +1 nếu ô rộng > 30%, +1 mọi ô nếu pha 1 INCONCLUSIVE; tối đa 4)
nên thêm lượt B rẻ để ép ADOPT sẽ đỏ; xen kẽ A/B."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
rs = runs()
bad = {r["model"] for r in rs} - {TH["model_pin"]}
if bad: fail(f"model khác {TH['model_pin']}: {bad}")
# --- lượt bị loại: lý do hợp lệ, khớp quét thật, có trần
stop = stop_file()
for r in rs:
    peek, gv = scan_run(r)
    if r.get("git_history_peek") is not bool(peek): fail(f"{tag(r)}: git_history_peek={r.get('git_history_peek')} nhưng quét transcript thấy {peek or 'không có gì'}")
    why = r.get("excluded_reason")
    if is_excl(r):
        if why == "git_history_peek" and not peek: fail(f"{tag(r)}: loại vì git_history_peek mà transcript không có lệnh nhìn lịch sử (loại tuỳ tiện)")
        if why == "graphify_violation" and not gv: fail(f"{tag(r)}: loại vì graphify_violation mà transcript không có vi phạm (loại tuỳ tiện)")
        if why == "graphify_violation" and r["arm"] != "B": fail(f"{tag(r)}: bản A không có Graphify để vi phạm")
        if why == "budget_abort" and not (stop and r["seq"] == max(x["seq"] for x in rs)): fail(f"{tag(r)}: budget_abort chỉ hợp lệ cho lượt cuối khi đã có stop.json")
        if why in ("harness_fault",) and (peek or gv): fail(f"{tag(r)}: loại vì harness_fault nhưng transcript có vi phạm thật ({(peek + gv)[:2]}): phải ghi đúng lý do")
    else:
        if peek: fail(f"{tag(r)}: lượt giữ lại (hợp lệ) có nhìn lịch sử git hoặc ngoài worktree {peek[:3]}: phải đánh excluded")
        if gv: fail(f"{tag(r)}: lượt giữ lại có vi phạm Graphify {gv[:3]}: phải đánh excluded")
for t in sorted({r["task"] for r in rs}):
    for arm in ARMS:
        n = sum(1 for r in rs if r["task"] == t and r["arm"] == arm and is_excl(r))
        if n > TH["excluded_max_per_cell"]: fail(f"{t}-{arm}: {n} lượt bị loại > trần {TH['excluded_max_per_cell']} mỗi ô (dừng và task.py block, không chạy tiếp)")
nf = sum(1 for r in rs if r.get("excluded_reason") == "harness_fault")
if nf > TH["harness_fault_max_total"]: fail(f"{nf} lượt harness_fault > trần {TH['harness_fault_max_total']} toàn thí nghiệm")
# --- số lượt hợp lệ
complete, errs, info = structure(rs)
over = [e for e in errs if e.startswith("vượt")]
if over: fail("; ".join(over))
v = valid(rs)
for t in sorted({r["task"] for r in v}):
    a = [r for r in v if r["task"] == t and r["arm"] == "A"]; b = [r for r in v if r["task"] == t and r["arm"] == "B"]
    if len(a) >= 2 and len(b) >= 2 and (max(x["seq"] for x in a) < min(x["seq"] for x in b) or max(x["seq"] for x in b) < min(x["seq"] for x in a)):
        fail(f"{t}: chạy hết một arm rồi mới tới arm kia, không xen kẽ")
if not complete and not stop: fail("chưa đủ lượt hợp lệ mỗi ô và chưa có stop.json: " + "; ".join(errs))
ok(("đủ" if complete else "chưa đủ, đã dừng vì ngân sách") + f": {len(v)} lượt hợp lệ, {len(rs) - len(v)} lượt bị loại có bằng chứng khớp quét, không vượt trần lặp")
