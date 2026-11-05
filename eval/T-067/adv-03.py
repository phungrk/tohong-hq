#!/usr/bin/env python3
"""T-067 adv-03 (Code Gate, adversary, 2026-11-05). Spec T-065 mục 3-9, 13, 15: Wayback trả xấu.
Nguồn gốc 404 cho mọi URL; Wayback giả (cục bộ) trả, theo URL:
  raw là HTML 200 -> wayback=not-image; raw khai Content-Length 31MB -> too-large; raw 31MB không Content-Length (đóng kết nối) -> too-large;
  raw là PNG cụt -> not-image; availability `status` là số 200 / `available` là chuỗi "true" / timestamp 13 chữ số -> none (không tải raw);
  raw chuyển hướng 1 và 3 lần -> ok; 4 lần -> failed, wayback=http-302; availability 429 không Retry-After -> 4 yêu cầu, chờ >= backoff x 1,2,4,
  wayback=http-429. Mọi URL failed giữ reason/attempts của nguồn gốc (http-404, 1). Thêm: giãn cách MẶC ĐỊNH (không truyền interval)
  >= 1000 ms giữa hai yêu cầu, tính cả chuyển hướng (2 URL x 3 yêu cầu). Offline; không gọi archive.org. Mã 0 = đạt."""
import io, json, os, re, sys, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-065", "lib"))
from t065 import Env, need_back, run, need_summary, GOOD, HTML, fail, ok  # noqa: E402

back = need_back()
TS = "20200315101530"
PNG = GOOD[0]
reqs = []; lock = threading.Lock()


class W(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body=b"", ct="application/json", headers=None, cl=True):
        try:
            self.send_response(code); self.send_header("Content-Type", ct)
            if cl is True: self.send_header("Content-Length", str(len(body)))
            elif cl: self.send_header("Content-Length", str(cl))
            for k, v in (headers or {}).items(): self.send_header(k, v)
            self.end_headers(); self.wfile.write(body)
        except Exception:
            pass

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        if u.path == "/wayback/available":
            orig = urllib.parse.parse_qs(u.query).get("url", [""])[0]; key = urllib.parse.urlsplit(orig).path.split("/")[-1]
            with lock: reqs.append((time.time(), "avail", key))
            if key == "a429": return self.send(429, b"slow", "text/plain")
            c = {"status": "200", "available": True, "timestamp": TS, "url": "http://x/decoy"}
            if key == "numstatus": c["status"] = 200
            if key == "strtrue": c["available"] = "true"
            if key == "ts13": c["timestamp"] = TS[:13]
            return self.send(200, json.dumps({"url": orig, "archived_snapshots": {"closest": c}}).encode())
        m = re.match(r"/web/(\d{14})id_/(.*)", urllib.parse.unquote(self.path))
        if not m: return self.send(404, b"", "text/plain")
        ts, orig = m.group(1), m.group(2); key = urllib.parse.urlsplit(orig).path.split("/")[-1]
        with lock: reqs.append((time.time(), "raw", key))
        hop = int(ts) - int(TS)
        need = {"r1": 1, "r1x": 1, "r1y": 1, "r3": 3, "r4": 4}.get(key, 0)
        if hop < need:
            return self.send(302, b"", "text/plain", {"Location": "/web/%did_/%s" % (int(ts) + 1, orig)})
        if key == "htmlraw": return self.send(200, HTML, "text/html")
        if key == "bigcl": return self.send(200, b"\x89PNG", "image/png", cl=31 * 1024 * 1024)
        if key == "bigchunk":
            try:
                self.send_response(200); self.send_header("Content-Type", "image/png"); self.end_headers()
                self.wfile.write(PNG[:64]); chunk = b"\0" * (1024 * 1024)
                for _ in range(31): self.wfile.write(chunk)
            except Exception:
                pass
            return
        if key == "trunc": return self.send(200, PNG[: len(PNG) // 2], "image/png")
        return self.send(200, PNG, "image/png")


ws = ThreadingHTTPServer(("127.0.0.1", 0), W); ws.daemon_threads = True
WB = "http://127.0.0.1:%d" % ws.server_address[1]
threading.Thread(target=ws.serve_forever, daemon=True).start()

expect = {"htmlraw": "not-image", "bigcl": "too-large", "bigchunk": "too-large", "trunc": "not-image", "numstatus": "none",
          "strtrue": "none", "ts13": "none", "r4": "http-302", "a429": "http-429"}
okk = ["r1", "r3"]
keys = list(expect) + okk
e = Env(["/gone/" + k for k in keys])
try:
    p = run(e.cmd(back, ["--retries", "0", "--workers", "4"], wayback=False) + ["--fallback", "wayback", "--wayback-base", WB,
            "--wayback-interval", "30", "--wayback-backoff", "100"], timeout=170)
    if p.returncode != 0: fail("mã 0, thấy %s; stderr %r" % (p.returncode, p.stderr[-300:]))
    s = need_summary(p, "xấu")
    if s.get("wayback") != str(len(okk)): fail("wayback=%d (chỉ r1, r3), thấy %s" % (len(okk), s.get("wayback")))
    ents = e.man()["entries"]
    for k, code in expect.items():
        en = ents.get(e.url("/gone/" + k), {})
        want = {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 1, "wayback": code}
        if en != want: fail("%s: entry phải %s, thấy %s" % (k, want, en))
    for k in okk:
        en = ents.get(e.url("/gone/" + k), {})
        if en.get("status") != "ok" or en.get("source") != "wayback": fail("%s: chuyển hướng <= 3 lần phải ok qua Wayback, thấy %s" % (k, en))
    for k in ("numstatus", "strtrue", "ts13"):
        if any(r[1] == "raw" and r[2] == k for r in reqs): fail("%s: availability không hợp lệ mà vẫn tải raw" % k)
    a = [r[0] for r in reqs if r[2] == "a429"]
    if len(a) != 4: fail("a429: tổng 4 yêu cầu (1 + 3 thử lại), thấy %d" % len(a))
    gaps = [a[i + 1] - a[i] for i in range(3)]
    if any(g < w * 0.9 for g, w in zip(gaps, (0.1, 0.2, 0.4))): fail("a429 không Retry-After: chờ >= 100/200/400 ms, thấy %s" % gaps)
    if len([r for r in reqs if r[2] == "r4"]) != 5: fail("r4: 1 availability + 4 raw (3 chuyển hướng theo dõi + bị từ chối ở lần 4)")
finally:
    e.stop()

# giãn cách mặc định, tính cả chuyển hướng
reqs.clear()
e = Env(["/gone/r1x", "/gone/r1y"])
try:
    t = time.time()
    p = run(e.cmd(back, ["--retries", "0", "--workers", "4"], wayback=False) + ["--fallback", "wayback", "--wayback-base", WB], timeout=60)
    if p.returncode != 0 or "wayback=2" not in p.stdout: fail("mặc định: mã 0, wayback=2; thấy %s %r" % (p.returncode, p.stdout[-200:]))
    ts = sorted(r[0] for r in reqs)
    if len(ts) != 6: fail("mặc định: 6 yêu cầu (2 x availability + raw + 1 chuyển hướng), thấy %d" % len(ts))
    g = [round(ts[i + 1] - ts[i], 3) for i in range(5)]
    if min(g) < 0.9: fail("mặc định: hai yêu cầu tới Wayback cách nhau < 1 giây (kể cả chuyển hướng): %s" % g)
finally:
    e.stop(); ws.shutdown()
ok("Wayback trả xấu: HTML, 31MB (khai/không khai), PNG cụt, availability lệch kiểu, chuyển hướng 1/3/4 lần, 429 không Retry-After; giãn cách mặc định gồm chuyển hướng")
