#!/usr/bin/env python3
"""T-219 tiêu chí 2 (offline): dry-run in P0_CAPS/P0_ESTIMATE/P0_DRY_RUN_OK, 0 lượt gọi (fixture deny), không cần khoá, không log chạy; trần sai/quá cứng thì thoát 2."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
files, removed, fx, meta = k.world()
fxd = dict(fx, deny=True)
bad = []
r = k.Root(files, removed)
rc, out, calls = r.run(k.std_args() + ["--dry-run"], fxd, maps=False, gemini=False)
lines = [l.strip() for l in out.splitlines()]
if rc != 0:
    bad.append("dry-run không khoá thoát %d (kỳ vọng 0): %s" % (rc, out.strip()[-160:]))
if calls:
    bad.append("dry-run đã gọi mạng %d lượt" % len(calls))
caps = next((l for l in lines if l.startswith("P0_CAPS ")), "")
if dict(re.findall(r"(\w+)=(\S+)", caps)) != {"text_search": "288", "details": "120", "gemini": "100", "usd": "3.00", "basis": "net"}:
    bad.append("P0_CAPS sai: %r" % caps)
est = dict(re.findall(r"(\w+)=(\S+)", next((l for l in lines if l.startswith("P0_ESTIMATE ")), "")))
try:
    ok = (est["text_search_max"], est["details_max"], est["gemini_max"]) == ("288", "120", "100") and abs(float(est["usd_run_net"]) - 2.20) <= 0.01 \
        and abs(float(est["usd_run_gross"]) - 20.82) <= 0.01 and abs(float(est["usd_month_net"]) - 2.20) <= 0.01
except (KeyError, ValueError):
    ok = False
if not ok:
    bad.append("P0_ESTIMATE sai (kỳ vọng text_search_max=288 details_max=120 gemini_max=100 usd_run_net=2.20 usd_run_gross=20.82 usd_month_net=2.20): %r" % est)
if "P0_DRY_RUN_OK" not in lines:
    bad.append("thiếu dòng P0_DRY_RUN_OK")
if any(l.startswith(("GOOGLE_REQUEST", "GOOGLE_USAGE", "GEMINI_USAGE")) for l in lines):
    bad.append("dry-run không được in GOOGLE_REQUEST/GOOGLE_USAGE/GEMINI_USAGE")
if any(f.endswith((".log", ".part")) for f in r.all_files()):
    bad.append("dry-run không được tạo log chạy")
# trần nhỏ hơn: ước tính theo trần
r2 = k.Root(files, removed)
rc, out, _ = r2.run(k.std_args() + ["--dry-run", "--max-text-search", "10", "--max-details", "5", "--max-gemini", "4", "--max-usd", "1.5", "--cap-basis", "gross"], fxd, maps=False, gemini=False)
est = dict(re.findall(r"(\w+)=(\S+)", next((l for l in out.splitlines() if l.startswith("P0_ESTIMATE ")), "")))
exp = 10 * 0.032 + 5 * 0.02 + 4 * (5 * 0.014 + 0.022)
try:
    if (est["text_search_max"], est["details_max"], est["gemini_max"]) != ("10", "5", "4") or abs(float(est["usd_run_gross"]) - exp) > 0.01:
        bad.append("trần nhỏ: P0_ESTIMATE %r, kỳ vọng 10/5/4 gross=%.2f" % (est, exp))
except (KeyError, ValueError):
    bad.append("trần nhỏ: không đọc được P0_ESTIMATE")
# sổ tháng đã có token của lần chạy trước (1.000.000 vào + 200.000 ra = 1,10 USD): ước tính của CHÍNH lần chạy không đổi, luỹ kế tháng cộng thêm
r3 = k.Root(files, removed)
os.makedirs(os.path.join(r3.path, "run-logs", "T-219"), exist_ok=True)
open(os.path.join(r3.path, "run-logs", "T-219", "20261101-run-1-discover.log"), "w").write(
    "GOOGLE_REQUEST run=rprev kind=gemini\nGEMINI_RESPONSE run=rprev search_queries=0 input_tokens=1000000 output_tokens=200000\n"
    "GOOGLE_USAGE run=rprev text_search=0 photo_details=0 photo_media=0 text_search_pro=0 details_count=0\nGEMINI_USAGE run=rprev calls=1 search_queries=0 input_tokens=1000000 output_tokens=200000\n")
rc, out, _ = r3.run(k.std_args() + ["--dry-run"], fxd, maps=False, gemini=False)
est = dict(re.findall(r"(\w+)=(\S+)", next((l for l in out.splitlines() if l.startswith("P0_ESTIMATE ")), "")))
try:
    if abs(float(est["usd_run_net"]) - 2.20) > 0.01 or abs(float(est["usd_month_net"]) - 3.30) > 0.01:
        bad.append("sổ tháng có 1,10 USD token: P0_ESTIMATE usd_run_net=2.20 (của chính lần chạy) và usd_month_net=3.30 (luỹ kế), thấy %r" % est)
except (KeyError, ValueError):
    bad.append("sổ tháng có token: không đọc được P0_ESTIMATE")
# trần không hợp lệ / quá trần cứng
for flag, val, code in (("--max-usd", "10.01", "P0_CAP_TOO_HIGH"), ("--max-text-search", "301", "P0_CAP_TOO_HIGH"), ("--max-details", "301", "P0_CAP_TOO_HIGH"),
                        ("--max-gemini", "201", "P0_CAP_TOO_HIGH"), ("--max-gemini", "abc", "P0_CAP_INVALID"), ("--max-usd", "-1", "P0_CAP_INVALID"), ("--max-details", "", "P0_CAP_INVALID")):
    for extra in (["--dry-run"], []):
        rr = k.Root(files, removed)
        rc, out, calls = rr.run(k.std_args() + extra + [flag, val], fx)
        if rc != 2 or code not in out or calls:
            bad.append("%s %r %s: rc=%d, kỳ vọng thoát 2 + %s + 0 lượt gọi (calls=%d)" % (flag, val, "dry-run" if extra else "thật", rc, code, len(calls)))
rr = k.Root(files, removed)
rc, out, calls = rr.run(["--state", "HCMC", "--category", "venue", "--stage", "measure", "--out", "p0-out/t", "--dry-run"], fxd, maps=False, gemini=False)
if rc != 2:
    bad.append("--category khác transport phải thoát 2, thấy %d" % rc)
k.done(bad, "dry-run in trần + ước tính đúng công thức, 0 lượt gọi, không khoá, không log; trần sai/quá cứng thoát 2")
