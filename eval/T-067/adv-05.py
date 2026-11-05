#!/usr/bin/env python3
"""T-067 adv-05 (Code Gate, adversary, 2026-11-05). Spec T-065 mục 22a + INV-002 + T-051 deploy (mọi entry ok phải có file).
Manifest ghi theo mốc khi còn entry `ok` CŨ chưa được xử lý (file chưa có trong `--out`, đứng cuối danh sách việc): giết tiến trình (SIGKILL)
ngay khi manifest theo mốc xuất hiện. Mong: manifest là JSON đọc được; mọi entry thành `ok` trong lần chạy này có file trong `--out`;
40 entry `ok` cũ vẫn còn nguyên từng trường (INV-002: không mất entry ok); và `deploy --dry-run` trên manifest đó + `--out` KHÔNG xanh
(thiếu file thì từ chối, không có site thiếu ảnh). Rồi chạy lại cùng `--out` (Pages giả có file của entry cũ): mã 0, manifest đủ,
`deploy --dry-run` xanh. Offline: nguồn, Wayback, Pages đều giả cục bộ; không gọi Cloudflare (dry-run, token giả). Mã 0 = đạt."""
import json, os, signal, subprocess, sys, time

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-065", "lib"))
from t065 import Env, need_back, run, cli, write_manifest, ok_entry, file_for, WEBP, GOOD, fail, ok  # noqa: E402

back = need_back()
new = ["/dead/n%d" % i for i in range(160)]
old = ["/ok/small.png?old=%d" % i for i in range(40)]
e = Env(new + old)
try:
    olds = {e.url(p): ok_entry(file_for("marry_%04d" % (160 + i), e.url(p))) for i, p in enumerate(old)}
    write_manifest(e.manifest, olds)
    e.wb.snaps = {p: GOOD for p in new}
    pages = e.wb.base + "/pages"   # Wayback giả trả 200 HTML cho đường lạ: khôi phục từ "Pages" lỗi (restore-not-webp) ở lần 1
    cmd = e.cmd(back, ["--retries", "0", "--workers", "4", "--restore-from", pages])
    m0 = os.stat(e.manifest).st_mtime_ns
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t = time.time()
    while time.time() - t < 120:
        if os.stat(e.manifest).st_mtime_ns != m0: break
        if proc.poll() is not None: break
        time.sleep(0.01)
    proc.send_signal(signal.SIGKILL); proc.wait()
    if os.stat(e.manifest).st_mtime_ns == m0: fail("không thấy manifest theo mốc trong 120 giây (done=100 sau khi mẫu đã qua)")
    man = json.load(open(e.manifest, encoding="utf-8"))["entries"]
    fresh = [u for u, en in man.items() if en.get("status") == "ok" and u not in olds]
    if not fresh: fail("manifest theo mốc không có entry ok mới nào")
    nofile = [u for u in fresh if not os.path.exists(os.path.join(e.out, man[u]["file"]))]
    if nofile: fail("mục 22a: %d entry ok mới trong manifest theo mốc không có file trong --out, vd %s" % (len(nofile), nofile[:2]))
    lost = [u for u, en in olds.items() if man.get(u) != en]
    if lost: fail("INV-002: %d entry ok cũ bị mất/đổi trong manifest theo mốc, vd %s -> %s" % (len(lost), lost[0], man.get(lost[0])))
    env = {"CLOUDFLARE_API_TOKEN": "fake-token-adv05", "CLOUDFLARE_ACCOUNT_ID": "fake-acct", "WRANGLER_BIN": "false"}
    d = run(cli(back) + ["deploy", "--dir", e.out, "--manifest", e.manifest, "--project", "adv05", "--dry-run"], env=env, timeout=60)
    missing = [u for u, en in man.items() if en.get("status") == "ok" and not os.path.exists(os.path.join(e.out, en["file"]))]
    if missing and d.returncode == 0: fail("deploy --dry-run xanh trên manifest theo mốc khi %d entry ok thiếu file" % len(missing))
    if "fake-token-adv05" in d.stdout + d.stderr: fail("deploy in token")

    # chạy lại cùng --out, Pages giả có file của entry cũ
    import shutil
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    import threading

    class P(BaseHTTPRequestHandler):
        def log_message(self, *a): pass

        def do_GET(self):
            self.send_response(200); self.send_header("Content-Type", "image/webp"); self.send_header("Content-Length", str(len(WEBP)))
            self.end_headers(); self.wfile.write(WEBP)
    ps = ThreadingHTTPServer(("127.0.0.1", 0), P); ps.daemon_threads = True
    threading.Thread(target=ps.serve_forever, daemon=True).start()
    try:
        cmd2 = e.cmd(back, ["--retries", "0", "--workers", "4", "--restore-from", "http://127.0.0.1:%d" % ps.server_address[1]])
        p = run(cmd2, timeout=170)
        if p.returncode != 0: fail("chạy lại sau khi bị giết: mã 0, thấy %s %r" % (p.returncode, p.stdout[-300:]))
        man = json.load(open(e.manifest, encoding="utf-8"))["entries"]
        if sum(1 for en in man.values() if en.get("status") == "ok") != 200: fail("chạy lại: 200 entry ok")
        d = run(cli(back) + ["deploy", "--dir", e.out, "--manifest", e.manifest, "--project", "adv05", "--dry-run"], env=env, timeout=60)
        if d.returncode != 0: fail("chạy lại: deploy --dry-run phải xanh, thấy %s %r" % (d.returncode, d.stderr[-300:]))
    finally:
        ps.shutdown()
finally:
    e.stop()
ok("manifest theo mốc khi còn entry ok cũ chưa xử lý: JSON đọc được, ok mới có file, ok cũ không mất, deploy không xanh giả; chạy lại cùng --out ra mã 0, deploy xanh")
