#!/usr/bin/env python3
"""T-067 adv-02 (Code Gate, adversary, 2026-11-05). Spec T-065 mục 1 và 10: `--fallback` chỉ nhận `wayback`; ba tham số thử nghiệm
bị từ chối mã 2 (một dòng stderr nêu tên tham số, không stack trace, không ghi manifest, không yêu cầu mạng nào) khi: (a) thiếu
`--fallback wayback`, (b) interval < 1000 với host base không phải loopback (127.0.0.1, localhost, [::1]), (c) backoff < 2000 với host
không phải loopback. Biên: 127.0.0.2 KHÔNG thuộc danh sách loopback của spec (server giả đặt ở đó để bắt yêu cầu lọt), interval 999,
backoff 1999, giá trị đúng mặc định khi thiếu cờ, `--fallback Wayback`/rỗng. Đối chứng: base `localhost` với interval/backoff thấp
được nhận (mã 0). Offline, server cục bộ; không gọi archive.org. Chạy không tham số (gate.py: python3 -I). Mã 0 = đạt."""
import os, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-065", "lib"))
from t065 import Env, need_back, run, cli, BASE_URL, GOOD, fail, ok  # noqa: E402

back = need_back()
hits = []


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        hits.append(self.path)
        self.send_response(200); self.send_header("Content-Length", "2"); self.end_headers(); self.wfile.write(b"{}")


try:
    s2 = ThreadingHTTPServer(("127.0.0.2", 0), H)
    NONLOOP = "http://127.0.0.2:%d" % s2.server_address[1]
    s2.daemon_threads = True
    threading.Thread(target=s2.serve_forever, daemon=True).start()
except OSError:
    s2 = None; NONLOOP = "http://wayback.invalid"

e = Env(["/gone/0", "/gone/1"])
try:
    open(e.manifest, "w").write('{"version":1,"baseUrl":"%s","entries":{}}\n' % BASE_URL)
    before = e.man_bytes()
    base = cli(back) + ["mirror", "--pool", e.pool, "--manifest", e.manifest, "--out", e.out, "--base-url", BASE_URL]
    bad = [
        (["--wayback-base", e.wb.base], "wayback-base"),
        (["--wayback-interval", "1000"], "wayback-interval"),
        (["--wayback-backoff", "2000"], "wayback-backoff"),
        (["--fallback", "Wayback"], "fallback"),
        (["--fallback", "cdx"], "fallback"),
        (["--fallback", "wayback", "--wayback-base", NONLOOP, "--wayback-interval", "999"], "wayback-interval"),
        (["--fallback", "wayback", "--wayback-base", NONLOOP, "--wayback-backoff", "1999"], "wayback-backoff"),
        (["--fallback", "wayback", "--wayback-interval", "500"], "wayback-interval"),   # base mặc định web.archive.org
        (["--fallback", "wayback", "--wayback-backoff", "0"], "wayback-backoff"),
    ]
    for extra, name in bad:
        p = run(base + extra, timeout=30)
        err = [l for l in p.stderr.splitlines() if l.strip()]
        if p.returncode != 2: fail("%s: phải mã 2, thấy %s; stdout %r" % (extra, p.returncode, p.stdout[-200:]))
        if len(err) != 1 or name not in err[0]: fail("%s: stderr phải đúng một dòng nêu '%s', thấy %r" % (extra, name, p.stderr[-300:]))
        if "    at " in p.stderr or "Error:" in p.stderr: fail("%s: có stack trace: %r" % (extra, p.stderr[-300:]))
        if e.man_bytes() != before: fail("%s: manifest bị đổi khi từ chối" % extra)
        if e.og.hits or e.wb.reqs or hits: fail("%s: có yêu cầu mạng khi từ chối (nguồn %d, wayback %d, 127.0.0.2 %d)" % (extra, len(e.og.hits), len(e.wb.reqs), len(hits)))
    # đối chứng: localhost là loopback, nhận giá trị thấp, chạy bình thường
    port = e.wb.base.rsplit(":", 1)[1]
    e.wb.snaps = {"/gone/0": GOOD}
    p = run(base + ["--fallback", "wayback", "--wayback-base", "http://localhost:" + port, "--wayback-interval", "0",
                    "--wayback-backoff", "1", "--retries", "0"], timeout=60)
    if p.returncode != 0: fail("localhost là loopback: interval 0 / backoff 1 phải được nhận, mã 0; thấy %s %r" % (p.returncode, p.stderr[-300:]))
    if "wayback=1" not in p.stdout: fail("localhost: /gone/0 phải khôi phục qua Wayback (wayback=1): %r" % p.stdout[-200:])
finally:
    e.stop()
    if s2: s2.shutdown()
ok("tham số thử nghiệm: %d ca bị từ chối mã 2 (một dòng, không ghi, không mạng, kể cả 127.0.0.2 và biên 999/1999); localhost nhận giá trị thấp" % len(bad))
