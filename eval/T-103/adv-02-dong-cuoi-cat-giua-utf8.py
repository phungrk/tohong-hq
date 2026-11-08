#!/usr/bin/env python3
"""T-103 adv-02 (tầng 3). Spec T-101 mục 6/8: dry-run lỗi thì thoát 2 không in PENDING; mã 1 chỉ dành cho
"không có transcript" hoặc "còn phần chưa ghi". Input: transcript của phiên đang chạy có dòng cuối ghi dở, bị cắt giữa
một ký tự UTF-8 nhiều byte (tiếng Việt). cost.py coi dòng cuối ghi dở là bình thường (bỏ qua dòng JSON hỏng), nên
mong: dry-run in PENDING và thoát 1 (như dòng JSON hỏng), hoặc thoát 2 không in PENDING; không bao giờ traceback
thoát 1 không PENDING (trùng mã "không có transcript"). Chạy thật: không traceback, không ghi chồng."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish

fails = []
b = Box(); sid = "s-utf"
main, subs = b.session(sid); b.age(main, *subs.values())
with open(main, "ab") as f:
    f.write('{"type":"user","message":{"content":"Chào anh chị'.encode("utf-8")[:-1])   # cắt giữa "ị"
r = b.run(["backfill", sid, "--dry-run"])
ok = (r.returncode == 1 and r.stdout.startswith("PENDING")) or (r.returncode == 2 and "PENDING" not in r.stdout)
if not ok or "Traceback" in r.stderr:
    fails.append(f"dry-run: thoát {r.returncode}, stdout {r.stdout.strip()!r}, traceback={'Traceback' in r.stderr}")
r = b.run(["backfill", sid])
if "Traceback" in r.stderr or r.returncode not in (0, 2):
    fails.append(f"chạy thật: thoát {r.returncode}, traceback={'Traceback' in r.stderr}")
finish(fails)
