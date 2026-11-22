#!/usr/bin/env python3
"""T-219 tiêu chí 4 (offline): sổ chạy. Chạy thật trên thế giới chuẩn (run id 777):
 - log run-logs/T-219/<YYYYMMDD>-run-777-discover.log (không còn .part), có GOOGLE_REQUEST run=… kind=search_pro x56, details_count x37, gemini x62 (đúng số request tới giả),
   GEMINI_RESPONSE mỗi lượt Gemini, và hai dòng cuối stdout + log là GOOGLE_USAGE rồi GEMINI_USAGE đúng số, text_search=0 photo_details=0 photo_media=0;
 - Google giả nhận request đúng bằng số GOOGLE_REQUEST (ghi TRƯỚC khi gửi: số dòng >= số request tới nơi, và khi 'deny' vẫn có dòng);
 - enrichment.usage.read_usage: tsp=56 pd=37 gc=62 gq=180, ts=0 ph=0 (không cộng nhầm SKU Text Search Enterprise và ảnh); log tháng khác không tính;
 - sổ tháng có sẵn 4990 search_pro: cổng usd (cap 3.00) dừng Text Search sớm, usd_net báo cáo <= 3.00."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run()
if rc != 0:
    bad.append("chạy thật thoát %d: %s" % (rc, out.strip()[-200:]))
logs = r.log_files()
good = [f for f in logs if re.search(r"[/\\]T-219[/\\]\d{8}-run-777-discover\.log$", f)]
if len(good) != 1 or any(f.endswith(".part") for f in logs):
    bad.append("kỳ vọng đúng một run-logs/T-219/<ngày>-run-777-discover.log và không còn .part, thấy %r" % [os.path.basename(f) for f in logs])
txt = open(good[0], encoding="utf-8").read() if good else ""
req = re.findall(r"^GOOGLE_REQUEST run=(\S+) kind=(\w+)", txt, re.M)
cnt = {kd: sum(1 for _, x in req if x == kd) for kd in ("search_pro", "details_count", "gemini")}
if cnt != {"search_pro": 56, "details_count": 37, "gemini": 62} or any(not rid for rid, _ in req):
    bad.append("GOOGLE_REQUEST trong log %r, kỳ vọng search_pro=56 details_count=37 gemini=62" % cnt)
if (k.n_kind(calls, "search"), k.n_kind(calls, "details"), k.n_kind(calls, "gemini")) != (56, 37, 62):
    bad.append("request tới Google giả (search,details,gemini)=%s, kỳ vọng (56,37,62)" % ((k.n_kind(calls, "search"), k.n_kind(calls, "details"), k.n_kind(calls, "gemini")),))
if len(re.findall(r"^GEMINI_RESPONSE run=\S+ search_queries=\d+ input_tokens=\d+ output_tokens=\d+$", txt, re.M)) != 62:
    bad.append("kỳ vọng 62 dòng GEMINI_RESPONSE trong log")
ls = [l.strip() for l in out.splitlines() if l.strip()]
exp_g = "GOOGLE_USAGE run=%s text_search=0 photo_details=0 photo_media=0 text_search_pro=56 details_count=37"
exp_m = "GEMINI_USAGE run=%s calls=62 search_queries=180 input_tokens=620000 output_tokens=62000"
rid = req[0][0] if req else "?"
for src, name in ((ls, "stdout"), ([l.strip() for l in txt.splitlines() if l.strip()], "log")):
    if len(src) < 2 or src[-2] != exp_g % rid or src[-1] != exp_m % rid:
        bad.append("%s: hai dòng cuối phải là %r và %r, thấy %r" % (name, exp_g % rid, exp_m % rid, src[-2:]))
# read_usage của scraper (code có sẵn, mở rộng theo spec) trên đúng log vừa sinh
code = ("import sys; from pathlib import Path; from enrichment.usage import read_usage;"
        "u=read_usage(Path('run-logs'), sys.argv[1]); print(u.ts,u.ph,u.pd,getattr(u,'tsp','NA'),getattr(u,'gc','NA'),getattr(u,'gq','NA'))")
# tên log bắt đầu bằng ngày chạy thật (hôm nay): tháng đọc lấy từ chính tên file
mon = re.search(r"(\d{4})(\d{2})\d{2}-run-777", os.path.basename(good[0])).groups() if good else ("2026", "11")
this = "%s-%s" % mon
p = subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, '.')\n" + code, this], cwd=r.path, capture_output=True, text=True)
if p.stdout.strip() != "0 0 37 56 62 180":
    bad.append("read_usage(%s) ts,ph,pd,tsp,gc,gq = %r (stderr %s), kỳ vọng '0 0 37 56 62 180'" % (this, p.stdout.strip(), p.stderr.strip()[-120:]))
p = subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, '.')\n" + code, "2001-01"], cwd=r.path, capture_output=True, text=True)
if p.stdout.strip() != "0 0 0 0 0 0":
    bad.append("log tháng khác không được tính, thấy %r" % p.stdout.strip())
# sổ tháng có sẵn 4990 search_pro: cổng usd dừng Text Search sớm
files, removed, fx, meta = k.world()
r2 = k.Root(files, removed)
os.makedirs(os.path.join(r2.path, "run-logs", "T-219"), exist_ok=True)
open(os.path.join(r2.path, "run-logs", "T-219", "20261101-run-1-discover.log"), "w").write(
    "".join("GOOGLE_REQUEST run=rprev kind=search_pro\n" for _ in range(4990)) + "GOOGLE_USAGE run=rprev text_search=0 photo_details=0 photo_media=0 text_search_pro=4990 details_count=0\n")
rc, out2, calls2 = r2.run(k.std_args(), fx, run_id="778")
rep = k.read_report(r2) or {}
n2 = k.n_kind(calls2, "search")
un = (rep.get("cost") or {}).get("usd_net")
if "P0_STOP usd" not in out2 or not (0 < n2 < 56) or not isinstance(un, (int, float)) or un > 3.0 + 1e-6:
    bad.append("sổ tháng 4990: P0_STOP usd=%s, Text Search=%d (kỳ vọng 0<n<56), usd_net=%r <= 3.00" % ("P0_STOP usd" in out2, n2, un))
# deny: GOOGLE_REQUEST vẫn được ghi TRƯỚC khi gửi
files, removed, fx, meta = k.world()
r3 = k.Root(files, removed)
rc, out3, calls3 = r3.run(k.std_args(), dict(fx, deny=True), run_id="779")
t3 = "".join(open(f, encoding="utf-8").read() for f in r3.log_files())
if not re.search(r"^GOOGLE_REQUEST run=\S+ kind=gemini$", t3, re.M):
    bad.append("khi request bị chặn (lỗi mạng) GOOGLE_REQUEST vẫn phải được ghi trước lượt gửi")
k.done(bad, "log -run-<id>-discover.log đủ GOOGLE_REQUEST/GEMINI_RESPONSE, hai dòng usage cuối đúng, read_usage đếm tsp/pd/gc/gq không cộng nhầm ts/ph, sổ tháng làm cổng usd dừng sớm")
