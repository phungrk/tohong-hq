#!/usr/bin/env python3
"""T-219 tiêu chí 4 (offline): sổ chạy. Chạy thật trên thế giới chuẩn (run id 777). Log chạy LÀ stdout của CLI (workflow `| tee run-logs/T-219/<…>-run-<id>-discover.log.part`; eval giả lập
tee): CLI KHÔNG tự ghi file log nào (ghi hai nơi thì sổ đếm đôi); stdout có GOOGLE_REQUEST run=… kind=search_pro x104, details_count x37, gemini x62 (đúng số request tới giả),
   GEMINI_RESPONSE mỗi lượt Gemini, và hai dòng cuối là GOOGLE_USAGE rồi GEMINI_USAGE đúng số, text_search=0 photo_details=0 photo_media=0;
 - Google giả nhận request đúng bằng số GOOGLE_REQUEST (ghi TRƯỚC khi gửi: số dòng >= số request tới nơi, và khi 'deny' vẫn có dòng);
 - enrichment.usage.read_usage: tsp=104 pd=37 gc=62 gq=180 gti=620000 gto=62000, ts=0 ph=0 (không cộng nhầm SKU Text Search Enterprise và ảnh); log tháng khác không tính;
 - B6: tiền tách hai số. usd_net_run = chi của chính lần chạy (f(sau) - f(trước)); usd_net_month = luỹ kế tháng gồm token của MỌI GEMINI_RESPONSE trong tháng; cổng usd và --max-usd áp lên usd_net_month:
   tháng đã có 1,10 USD token: usd_net_run~0.496, usd_net_month~1.596; tháng đã có 2,90 USD token (cap 3.00): P0_STOP usd sớm, usd_net_month <= 3.00;
 - sổ tháng có sẵn 4990 search_pro: cổng usd (cap 3.00) dừng Text Search sớm, usd_net_month báo cáo <= 3.00."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run()
if rc != 0:
    bad.append("chạy thật thoát %d: %s" % (rc, out.strip()[-200:]))
if r.cli_wrote_logs:
    bad.append("CLI không được tự ghi file log (workflow tee stdout; hai nơi thì sổ đếm đôi), thấy %r" % [os.path.basename(f) for f in r.cli_wrote_logs])
logs = r.log_files()
good = [f for f in logs if re.search(r"[/\\]T-219[/\\]\d{8}-run-777-discover\.log$", f)]
txt = open(good[0], encoding="utf-8").read() if good else ""
req = re.findall(r"^GOOGLE_REQUEST run=(\S+) kind=(\w+)", txt, re.M)
cnt = {kd: sum(1 for _, x in req if x == kd) for kd in ("search_pro", "details_count", "gemini")}
if cnt != {"search_pro": 104, "details_count": 37, "gemini": 62} or any(not rid for rid, _ in req):
    bad.append("GOOGLE_REQUEST trong log %r, kỳ vọng search_pro=104 details_count=37 gemini=62" % cnt)
if (k.n_kind(calls, "search"), k.n_kind(calls, "details"), k.n_kind(calls, "gemini")) != (104, 37, 62):
    bad.append("request tới Google giả (search,details,gemini)=%s, kỳ vọng (104,37,62)" % ((k.n_kind(calls, "search"), k.n_kind(calls, "details"), k.n_kind(calls, "gemini")),))
if len(re.findall(r"^GEMINI_RESPONSE run=\S+ search_queries=\d+ input_tokens=\d+ output_tokens=\d+$", txt, re.M)) != 62:
    bad.append("kỳ vọng 62 dòng GEMINI_RESPONSE trong log")
ls = [l.strip() for l in out.splitlines() if l.strip()]
exp_g = "GOOGLE_USAGE run=%s text_search=0 photo_details=0 photo_media=0 text_search_pro=104 details_count=37"
exp_m = "GEMINI_USAGE run=%s calls=62 search_queries=180 input_tokens=620000 output_tokens=62000"
rid = req[0][0] if req else "?"
for src, name in ((ls, "stdout"), ([l.strip() for l in txt.splitlines() if l.strip()], "log")):
    if len(src) < 2 or src[-2] != exp_g % rid or src[-1] != exp_m % rid:
        bad.append("%s: hai dòng cuối phải là %r và %r, thấy %r" % (name, exp_g % rid, exp_m % rid, src[-2:]))
# read_usage của scraper (code có sẵn, mở rộng theo spec) trên đúng log vừa sinh
code = ("import sys; from pathlib import Path; from enrichment.usage import read_usage;"
        "u=read_usage(Path('run-logs'), sys.argv[1]); print(u.ts,u.ph,u.pd,getattr(u,'tsp','NA'),getattr(u,'gc','NA'),getattr(u,'gq','NA'),getattr(u,'gti','NA'),getattr(u,'gto','NA'))")
# tên log bắt đầu bằng ngày chạy thật (hôm nay): tháng đọc lấy từ chính tên file
mon = re.search(r"(\d{4})(\d{2})\d{2}-run-777", os.path.basename(good[0])).groups() if good else ("2026", "11")
this = "%s-%s" % mon
p = subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, '.')\n" + code, this], cwd=r.path, capture_output=True, text=True)
if p.stdout.strip() != "0 0 37 104 62 180 620000 62000":
    bad.append("read_usage(%s) ts,ph,pd,tsp,gc,gq,gti,gto = %r (stderr %s), kỳ vọng '0 0 37 104 62 180 620000 62000'" % (this, p.stdout.strip(), p.stderr.strip()[-120:]))
p = subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, '.')\n" + code, "2001-01"], cwd=r.path, capture_output=True, text=True)
if p.stdout.strip() != "0 0 0 0 0 0 0 0":
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
un = (rep.get("cost") or {}).get("usd_net_month")
if "P0_STOP usd" not in out2 or not (0 < n2 < 104) or not isinstance(un, (int, float)) or un > 3.0 + 1e-6:
    bad.append("sổ tháng 4990: P0_STOP usd=%s, Text Search=%d (kỳ vọng 0<n<104), usd_net_month=%r <= 3.00" % ("P0_STOP usd" in out2, n2, un))
# B6: token của lần chạy trước trong cùng tháng
def prior(tok_in, tok_out):
    files, removed, fx, meta = k.world()
    rr = k.Root(files, removed)
    os.makedirs(os.path.join(rr.path, "run-logs", "T-219"), exist_ok=True)
    open(os.path.join(rr.path, "run-logs", "T-219", "20261101-run-1-discover.log"), "w").write(
        "GOOGLE_REQUEST run=rprev kind=gemini\nGEMINI_RESPONSE run=rprev search_queries=0 input_tokens=%d output_tokens=%d\nGOOGLE_USAGE run=rprev text_search=0 photo_details=0 photo_media=0 text_search_pro=0 details_count=0\n"
        "GEMINI_USAGE run=rprev calls=1 search_queries=0 input_tokens=%d output_tokens=%d\n" % (tok_in, tok_out, tok_in, tok_out))
    return rr, fx
rr, fx = prior(1000000, 200000)
rc, o4, c4 = rr.run(k.std_args(), fx, run_id="780")
co = (k.read_report(rr) or {}).get("cost") or {}
if rc != 0 or "P0_STOP" in o4 or any(not isinstance(co.get(x), (int, float)) for x in ("usd_net_run", "usd_net_month", "usd_gross_run")) \
        or abs(co["usd_net_run"] - 0.496) > 0.002 or abs(co["usd_net_month"] - 1.596) > 0.002 or abs(co["usd_gross_run"] - 7.084) > 0.01:
    bad.append("tháng đã có 1,10 USD token: cost usd_net_run/usd_net_month/usd_gross_run = %r/%r/%r, kỳ vọng 0.496/1.596/7.084 (rc=%d)" % (co.get("usd_net_run"), co.get("usd_net_month"), co.get("usd_gross_run"), rc))
rr, fx = prior(4000000, 300000)
rc, o5, c5 = rr.run(k.std_args(), fx, run_id="781")
co = (k.read_report(rr) or {}).get("cost") or {}
if rc != 0 or "P0_STOP usd" not in o5 or k.n_kind(c5, "gemini") >= 62 or not isinstance(co.get("usd_net_month"), (int, float)) or co["usd_net_month"] > 3.0 + 1e-6 or not (co.get("usd_net_run") or 0) < 0.2:
    bad.append("tháng đã có 2,90 USD token, cap 3.00: P0_STOP usd=%s gemini=%d usd_net_month=%r usd_net_run=%r (kỳ vọng dừng sớm, month <= 3.00, run < 0.2)" % ("P0_STOP usd" in o5, k.n_kind(c5, "gemini"), co.get("usd_net_month"), co.get("usd_net_run")))
# deny: GOOGLE_REQUEST vẫn được ghi TRƯỚC khi gửi
files, removed, fx, meta = k.world()
r3 = k.Root(files, removed)
rc, out3, calls3 = r3.run(k.std_args(), dict(fx, deny=True), run_id="779")
t3 = "".join(open(f, encoding="utf-8").read() for f in r3.log_files())
if not re.search(r"^GOOGLE_REQUEST run=\S+ kind=gemini$", t3, re.M):
    bad.append("khi request bị chặn (lỗi mạng) GOOGLE_REQUEST vẫn phải được ghi trước lượt gửi")
k.done(bad, "log -run-<id>-discover.log đủ GOOGLE_REQUEST/GEMINI_RESPONSE, hai dòng usage cuối đúng, read_usage đếm tsp/pd/gc/gq không cộng nhầm ts/ph, sổ tháng làm cổng usd dừng sớm")
