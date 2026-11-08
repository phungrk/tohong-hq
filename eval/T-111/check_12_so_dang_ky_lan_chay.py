#!/usr/bin/env python3
"""T-111 tiêu chí 3 (trần cho cả đợt không bị đếm thiếu vì log không lên `main`; defect T-111-D2 B1). OFFLINE, không Google.
Lệnh `python check_runs.py --runs <runs.json> --prs <prs.json> --usage-root run-logs --baseline run-logs/usage-baseline.json --current <GITHUB_RUN_ID>` (chạy trong workflow TRƯỚC khi gọi Google thật;
runs.json = `gh run list --json databaseId,displayTitle,workflowName,status,conclusion` gộp các workflow Google; prs.json = `gh pr list --state open --json number,headRefName`).
Luật: mọi lần chạy THẬT trước đó (displayTitle bắt đầu `REAL `, mọi conclusion trừ `skipped`, kể cả failure/cancelled/đang chạy, trừ lần chạy hiện tại) phải có log trong run-logs/*/ mà TÊN FILE chứa `-run-<id>-`
(khớp nguyên id, `run-1010` không thoả `run-101`) HOẶC id nằm trong `usage-baseline.json` `runs_accounted` (lối thoát duy nhất: Capu ghi tay, kèm `decision` trỏ file `decisions/…`).
Thiếu thì thoát 1, in mỗi lần thiếu một dòng `MISSING_RUN_LOG <id> <workflow>`. Còn PR dữ liệu mở có nhánh bắt đầu bằng một trong {enrich-vendors/, venue-enrich/, resolve-overrides/, refresh-photos/}: thoát 1, in `OPEN_DATA_PR <số> <nhánh>`.
Baseline có `runs_accounted` không rỗng mà thiếu `decision` (đường dẫn bắt đầu `decisions/`) hoặc thiếu `source`: thoát 2, in `BASELINE_NO_DECISION`.
Ba tình huống log không lên main: (1) bước mở PR hỏng (run conclusion failure), (2) Capu đóng PR không merge (run success, log không ở main), (3) bước kiểm khoá xoá log; cơ chế khác nhau, kết quả như nhau: lần chạy đó thiếu log.
Mong đợi: A. cả ba bị liệt kê, thoát 1. B. thêm log đúng tên: thoát 0. C. lần chạy DRY và lần chạy hiện tại không cần log. D. lần chạy khác đang chạy (status in_progress) bị từ chối. E. `runs_accounted` thay log: 0;
thiếu decision: 2. F. PR mở của enrich-vendors/, venue-enrich/, resolve-overrides/ bị chặn; PR khác thì không; PR đã đóng (không có trong prs.json) không chặn. G. log run-1010 không thoả run-101.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []
r = t.Root({"venue": []})


def run(runs, prs=(), baseline=None, current="999", logs=()):
    d = os.path.join(r.path, "run-logs")
    import shutil
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(os.path.join(d, "T-111"))
    for name in logs:
        open(os.path.join(d, "T-111", name), "w").write("GOOGLE_USAGE text_search=1 photo_details=0 photo_media=0\n")
    json.dump(runs, open(os.path.join(r.base, "runs.json"), "w"))
    json.dump(list(prs), open(os.path.join(r.base, "prs.json"), "w"))
    if baseline is not None:
        json.dump(baseline, open(os.path.join(d, "usage-baseline.json"), "w"))
    return r.run(["check_runs.py", "--runs", os.path.join(r.base, "runs.json"), "--prs", os.path.join(r.base, "prs.json"), "--usage-root", "run-logs",
                  "--baseline", "run-logs/usage-baseline.json", "--current", current], x.fx({}, [], deny=True), key=False)


def R(i, wf="enrich-vendors.yml", title="REAL enrich-vendors", status="completed", concl="success"):
    return {"databaseId": i, "displayTitle": title, "workflowName": wf, "status": status, "conclusion": concl}


REAL = [R(101, concl="failure"), R(102), R(103, wf="enrich-venue.yml", title="REAL enrich-venue")]
rc, o, _ = run(REAL)
miss = {l.split()[1] for l in o.splitlines() if l.startswith("MISSING_RUN_LOG")}
if rc != 1 or miss != {"101", "102", "103"}:
    bad.append("A: ba lần chạy thật không có log trên main phải bị liệt kê (101, 102, 103) và thoát 1; rc=%d, thấy %r" % (rc, sorted(miss)))
rc, o, _ = run(REAL, logs=["20261108-100000-run-101-enrich.log", "20261108-100100-run-102-enrich.log", "20261108-100200-run-103-enrich.log"])
if rc != 0:
    bad.append("B: đủ log theo tên -run-<id>-: mong thoát 0, thấy %d (%s)" % (rc, o.strip()[-120:]))
rc, o, _ = run([R(201, title="DRY enrich-vendors"), R(999)], current="999")
if rc != 0:
    bad.append("C: lần chạy DRY và lần chạy hiện tại không cần log (rc=%d)" % rc)
rc, o, _ = run([R(301, status="in_progress", concl=None)])
if rc != 1 or "MISSING_RUN_LOG 301" not in o:
    bad.append("D: lần chạy thật khác đang chạy phải bị từ chối (rc=%d)" % rc)
base = {"month": "2026-11", "text_search": 10, "photos": 700, "source": "Capu console 2026-11-09", "runs_accounted": [101, 102, 103],
        "decision": "decisions/2026-11-08-adr-049-enrich-toan-bo-vendor.md"}
rc, o, _ = run(REAL, baseline=base)
if rc != 0:
    bad.append("E: runs_accounted kèm decision phải thay log (thoát 0), thấy %d (%s)" % (rc, o.strip()[-120:]))
nb = dict(base)
del nb["decision"]
rc, o, _ = run(REAL, baseline=nb)
if rc != 2 or "BASELINE_NO_DECISION" not in o:
    bad.append("E: runs_accounted thiếu decision phải thoát 2 + BASELINE_NO_DECISION (rc=%d)" % rc)
for br, n in (("enrich-vendors/run-4", 11), ("venue-enrich/run-3", 12), ("resolve-overrides/run-1", 13)):
    rc, o, _ = run([], prs=[{"number": n, "headRefName": br}])
    if rc != 1 or "OPEN_DATA_PR %d %s" % (n, br) not in o:
        bad.append("F: PR mở nhánh %s phải chặn (rc=%d)" % (br, rc))
rc, o, _ = run([], prs=[{"number": 20, "headRefName": "feature/ui-card"}])
if rc != 0:
    bad.append("F: PR không phải dữ liệu Google không được chặn (rc=%d)" % rc)
rc, o, _ = run([R(101)], logs=["20261108-100000-run-1010-enrich.log"])
if rc != 1 or "MISSING_RUN_LOG 101" not in o:
    bad.append("G: log của run-1010 không được thoả yêu cầu của run 101 (rc=%d)" % rc)
t.done(bad, "sổ đăng ký lần chạy: ba tình huống log không lên main bị chặn và liệt kê, đủ log (khớp nguyên id) thì cho chạy, DRY/hiện tại bỏ qua, baseline runs_accounted + decision là lối thoát duy nhất, PR dữ liệu mở của ba tiền tố bị chặn")
