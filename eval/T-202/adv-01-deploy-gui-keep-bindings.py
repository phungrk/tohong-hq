#!/usr/bin/env python3
"""T-202 adv-01 (tầng 3): chạy `wrangler deploy` THẬT (wrangler trong tohong-back/node_modules, bản npm ci cài) với cấu hình wrangler.toml
của repo, nhưng trỏ CLOUDFLARE_API_BASE_URL vào một API giả trên 127.0.0.1. Không gọi Cloudflare, không deploy thật.
Bắt multipart metadata của lần upload script và kiểm:
  (a) metadata.keep_bindings chứa "plain_text" (và "json") -> Cloudflare giữ biến dashboard như ADMIN_OPEN;
  (b) không binding nào trong metadata tên ADMIN_OPEN (file không ghi đè cờ của Capu).
Eval check_4 (dry-run) không chạm được điều này vì dry-run không dựng request upload.
Repo: TOHONG_BACK_REPO (mặc định /home/user/tohong-back). Chạy: python3 -I eval/T-202/adv-01-deploy-gui-keep-bindings.py
Thoát 0 = PASS, 1 = FAIL, 2 = không chạy được."""
import json, os, re, shutil, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BACK = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
if not os.path.exists(os.path.join(BACK, "node_modules/.bin/wrangler")):
    print("ERROR thiếu node_modules/.bin/wrangler trong " + BACK); sys.exit(2)

uploads = []
seen = []


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _reply(self, result):
        b = json.dumps({"success": True, "errors": [], "messages": [], "result": result}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def handle_any(self):
        body = self._body()
        p = self.path.split("?")[0]
        seen.append("%s %s" % (self.command, p))
        if (self.command == "PUT" and re.search(r"/workers/scripts/[^/]+$", p)) or \
                (self.command == "POST" and p.endswith("/versions")):
            m = re.search(rb'name="metadata"[^\r\n]*\r\n(?:[^\r\n]+\r\n)*\r\n(\{.*?\})\r\n--', body, re.S)
            uploads.append(json.loads(m.group(1)) if m else None)
            return self._reply({"id": "w", "etag": "e", "deployment_id": "d", "startup_time_ms": 1,
                                "has_modules": True, "handlers": ["fetch"]})
        if p.endswith("/workers/subdomain"):
            return self._reply({"subdomain": "mock"})
        if p.endswith("/subdomain"):
            return self._reply({"enabled": True, "previews_enabled": True})
        if p.endswith("/deployments"):
            return self._reply({"deployments": []})
        if p.endswith("/schedules"):
            return self._reply({"schedules": []})
        if re.search(r"/workers/services/[^/]+$", p):
            return self._reply({"id": "w", "default_environment": {"environment": "production",
                                "script": {"tag": "t", "last_deployed_from": "wrangler"}}})
        if re.search(r"/workers/scripts/[^/]+$", p) or p.endswith("/settings"):
            return self._reply({"bindings": [], "default_environment": {"script": {"last_deployed_from": "wrangler"}}})
        if p.endswith("/memberships") or p.endswith("/accounts"):
            return self._reply([{"id": "acc", "name": "mock"}])
        return self._reply([])

    do_GET = do_PUT = do_POST = do_PATCH = do_DELETE = handle_any


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.server_address[1]

work = tempfile.mkdtemp()
try:
    # bản sao để .wrangler/ tạm không rơi vào repo thật
    shutil.copytree(BACK, os.path.join(work, "r"), ignore=shutil.ignore_patterns("node_modules", ".git", ".wrangler"), symlinks=True)
    os.symlink(os.path.join(BACK, "node_modules"), os.path.join(work, "r", "node_modules"))
    env = dict(os.environ, CI="1", WRANGLER_SEND_METRICS="false", CLOUDFLARE_API_TOKEN="mock-token",
               CLOUDFLARE_ACCOUNT_ID="acc", CLOUDFLARE_API_BASE_URL="http://127.0.0.1:%d/client/v4" % port,
               NO_PROXY="127.0.0.1,localhost", no_proxy="127.0.0.1,localhost", WRANGLER_LOG="error")
    r = subprocess.run(["npx", "--no-install", "wrangler", "deploy"], cwd=os.path.join(work, "r"),
                       capture_output=True, text=True, timeout=300, env=env)
finally:
    srv.shutdown()
    shutil.rmtree(work, ignore_errors=True)

if not uploads:
    print("ERROR không bắt được request upload script (wrangler thoát %d): %s | requests: %s"
          % (r.returncode, (r.stdout + r.stderr).strip()[-400:], seen[:20])); sys.exit(2)
md = uploads[0]
if md is None:
    print("ERROR không đọc được metadata trong multipart upload"); sys.exit(2)
kb = md.get("keep_bindings") or []
if "plain_text" not in kb or "json" not in kb:
    print("FAIL deploy không gửi keep_bindings plain_text/json (được %r): Cloudflare sẽ xoá biến dashboard như ADMIN_OPEN" % (kb,)); sys.exit(1)
names = [b.get("name") for b in md.get("bindings", [])]
if "ADMIN_OPEN" in names:
    print("FAIL metadata upload có binding ADMIN_OPEN: deploy ghi đè cờ của Capu"); sys.exit(1)
print("PASS upload metadata keep_bindings=%r, %d binding, không có ADMIN_OPEN" % (kb, len(names)))
