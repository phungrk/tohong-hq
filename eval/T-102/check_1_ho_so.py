#!/usr/bin/env python3
"""Tiêu chí 1: hồ sơ thí nghiệm đủ phần. Báo cáo có các mục bắt buộc; mỗi lượt đã khởi chạy (kể cả lượt bị loại) có đủ trường, seq liền mạch;
usd khớp token x bảng giá; bộ việc đúng (3 việc lõi, hoặc T-068 thay một việc khi tiền kiểm không đạt, hồ sơ tiền kiểm có trước mọi lượt)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
txt = report_text()
need = ["Khuyến nghị", "Thiết kế", "Kết quả", "Ngưỡng", "Cách cài", "Gỡ", "Đồ thị cũ", "Dữ liệu gửi đi", "Nguồn số đo", "Rủi ro"]
heads = [h.strip().lower() for h in re.findall(r"^#{1,3}\s+(.+)$", txt, re.M)]
miss = [n for n in need if not any(n.lower() in h for h in heads)]
if miss: fail("báo cáo thiếu mục: " + ", ".join(miss))
rs = runs()
keys = ["task", "arm", "rep", "seq", "base_sha", "start_tree_sha", "started_at", "model", "source", "tokens", "usd", "gate_green_first", "returns",
        "wall_s", "git_history_peek", "excluded", "transcripts"]
for r in rs:
    m = [k for k in keys if k not in r]
    if m: fail(f"{tag(r)} thiếu trường {m}")
    if r["arm"] not in ARMS: fail("arm phải là A hoặc B")
    if not isinstance(r["excluded"], bool): fail(f"{tag(r)}: excluded phải là true/false")
    if r["excluded"]:
        if r.get("excluded_reason") not in TH["excluded_reasons"]: fail(f"{tag(r)}: excluded_reason phải thuộc {TH['excluded_reasons']}")
        if len(str(r.get("excluded_evidence", ""))) < 10: fail(f"{tag(r)}: lượt bị loại thiếu excluded_evidence (bằng chứng, >= 10 ký tự)")
    elif r.get("excluded_reason"): fail(f"{tag(r)}: có excluded_reason mà excluded=false")
    if r["source"] not in ("cost_event", "transcript"): fail("source phải là cost_event hoặc transcript")
    t = r["tokens"]
    if any(k not in t for k in ("input", "cache_read", "cache_write", "output")): fail("tokens thiếu input/cache_read/cache_write/output")
    exp = usd_of(r["model"], t)
    if abs(exp - r["usd"]) > max(0.01 * exp, 0.005): fail(f"usd {r['usd']} lệch token x bảng giá ({exp:.4f}) ở {tag(r)}")
if [r["seq"] for r in rs] != list(range(1, len(rs) + 1)): fail("seq không liền từ 1 (có hồ sơ bị xoá hoặc đánh số lại)")
if len({(r["task"], r["arm"], r["rep"]) for r in rs}) != len(rs): fail("trùng (task, arm, rep)")
# --- bộ việc: tiền kiểm không tốn token, chạy TRƯỚC mọi lượt; chỉ thay việc ở đây, không thay giữa chừng
pf_path = os.path.join(RUNS, "preflight.json")
if not os.path.isfile(pf_path): fail("chưa có insights/T-102-runs/preflight.json (tiền kiểm: eval đỏ ở base_sha, xanh ở merge_sha, mỗi việc)")
pf = json.load(open(pf_path, encoding="utf-8"))
if parse_ts(pf["checked_at"], "preflight.checked_at") >= min(parse_ts(r["started_at"], "started_at") for r in rs): fail("preflight.checked_at không trước lượt đầu tiên")
good = lambda t: pf["tasks"].get(t, {}).get("base_red") is True and pf["tasks"].get(t, {}).get("merge_green") is True
core = list(TH["tasks_core"]); bad = [t for t in core if not good(t)]
if len(bad) > 1: fail(f"{len(bad)} việc lõi không qua tiền kiểm {bad}: chỉ có một việc dự phòng, phải task.py block")
want = core if not bad else [t for t in core if t != bad[0]] + [TH["task_reserve"]]
if bad:
    if [x.get("task") for x in pf.get("replaced", [])] != bad or pf["replaced"][0].get("by") != TH["task_reserve"] or len(str(pf["replaced"][0].get("reason", ""))) < 10:
        fail(f"việc {bad[0]} không qua tiền kiểm nhưng preflight.replaced không ghi thay bằng {TH['task_reserve']} kèm lý do")
    if not good(TH["task_reserve"]): fail(f"việc dự phòng {TH['task_reserve']} cũng không qua tiền kiểm")
elif pf.get("replaced"): fail("preflight.replaced có mục dù mọi việc lõi qua tiền kiểm")
got = sorted({r["task"] for r in rs})
stopped = stop_file() is not None   # dừng vì trần ngân sách: được phép chưa phủ hết việc/ô
if (not set(got) <= set(want)) if stopped else (got != sorted(want)): fail(f"bộ việc {got} khác bộ việc phải chạy {sorted(want)} (hồ sơ của việc ngoài bộ hoặc thiếu việc)")
for t in ([] if stopped else want):
    for arm in ARMS:
        if not [r for r in valid(rs) if r["task"] == t and r["arm"] == arm]: fail(f"{t} thiếu lượt hợp lệ ở bản {arm}")
ok(f"{len(rs)} lượt khởi chạy ({len(valid(rs))} hợp lệ), {len(want)} việc, báo cáo đủ {len(need)} mục")
