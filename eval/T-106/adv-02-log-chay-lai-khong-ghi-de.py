#!/usr/bin/env python3
"""T-106 eval đối kháng 02 (adversary, Code Gate T-108): chạy lại workflow enrich-venue trong CÙNG NGÀY.
Input: .github/workflows/enrich-venue.yml chạy thật 2 lần ngày 20261108 (spec hành vi 8 cho phép chạy lại sau lỗi, sau khi đọc log),
PR dữ liệu của lần 1 đã merge nên lần 2 checkout có sẵn run-logs/T-106/20261108-enrich-venue.log.
Spec hành vi 7: MỖI lần chạy thật lưu stdout vào run-logs/T-106/YYYYMMDD-<tên>.log; check_3 cộng GOOGLE_USAGE của mọi log để chặn hạn mức 1.000.
Mong đợi: lệnh lưu log của lần chạy thật (enrich và refresh) không ghi đè log có sẵn: tên file chứa mã duy nhất của lần chạy
(github.run_id / github.run_number / giờ-phút-giây) hoặc ghi nối (tee -a), để check_3 không đếm thiếu request của lần trước.
Đỏ hôm nay: `tee "run-logs/T-106/${STAMP}-enrich-venue.log"` với STAMP=%Y%m%d -> lần 2 cắt cụt log lần 1, check_3 đếm thiếu.
Đọc file, không chạy workflow, không gọi Google. Cần TOHONG_REPO (mặc định ../tohong)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c

wf = os.path.join(c.tohong(), ".github", "workflows", "enrich-venue.yml")
if not os.path.isfile(wf):
    c.fail("không có .github/workflows/enrich-venue.yml")
text = open(wf, encoding="utf-8").read()
cmds = [ln.strip() for ln in text.splitlines() if "tee" in ln and "run-logs/T-106" in ln]
if len(cmds) < 2:
    c.fail("không tìm thấy lệnh lưu log chạy thật của cả enrich và refresh vào run-logs/T-106 (%d lệnh)" % len(cmds))
UNIQUE = re.compile(r"github\.run_(id|number|attempt)|GITHUB_RUN_(ID|NUMBER)|%H|%s|%T|date -u \+%Y%m%d[-_T]?%H")
bad = []
for ln in cmds:
    m = re.search(r"tee\s+(-a\s+|--append\s+)?\"?([^\"\s]+)", ln)
    if not m:
        bad.append(ln[:80]); continue
    append, path = bool(m.group(1)), m.group(2)
    stamp_unique = bool(UNIQUE.search(path))
    if "${STAMP}" in path or "$STAMP" in path:
        stamp_def = re.findall(r"STAMP=\$\((date[^)]*)\)", text)
        stamp_unique = stamp_unique or any(UNIQUE.search(d) for d in stamp_def)
    if not (append or stamp_unique):
        bad.append(path)
if bad:
    c.fail("log chạy thật bị ghi đè khi chạy lại cùng ngày (tên chỉ có YYYYMMDD, tee không -a): " + ", ".join(bad))
c.ok("mỗi lần chạy thật có log riêng hoặc ghi nối; check_3 không đếm thiếu khi chạy lại cùng ngày")
