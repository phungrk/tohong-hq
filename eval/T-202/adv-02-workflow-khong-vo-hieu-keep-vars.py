#!/usr/bin/env python3
"""T-202 adv-02 (tầng 3): đường deploy thật (.github/workflows/*.yml dùng cloudflare/wrangler-action, và script deploy trong package.json)
không làm keep_vars mất tác dụng. Đọc file, không mạng. Vi phạm nếu:
  - lệnh wrangler/command: có --var/--vars, --keep-vars=false/--no-keep-vars, -c/--config trỏ file khác wrangler.toml, hoặc --env/environment:
    (wrangler.toml không có [env.*]; đổi env là đổi cấu hình deploy, phải có spec riêng);
  - wrangler-action có input vars: (đẩy biến text từ workflow, ghi đè dashboard) hoặc wranglerVersion: (bỏ qua bản wrangler đã kiểm trong lockfile);
  - workflow gọi wrangler-action mà không chạy `npm ci` trước (action khi đó tự cài wrangler bản khác, không phải bản eval đã kiểm).
Repo: TOHONG_BACK_REPO (mặc định /home/user/tohong-back). Thoát 0 = PASS, 1 = FAIL, 2 = không chạy được."""
import json, os, re, sys

BACK = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
wfdir = os.path.join(BACK, ".github", "workflows")
if not os.path.isdir(wfdir):
    print("ERROR không thấy " + wfdir); sys.exit(2)
BAD_FLAG = re.compile(r"(--vars?[= ])|(--keep-vars[= ]+false)|(--no-keep-vars)|((^|\s)(-c|--config)[= ]+(?!wrangler\.toml\b)\S+)|(--env[= ]|(^|\s)-e\s)")
hits, actions = [], 0
for f in sorted(os.listdir(wfdir)):
    if not f.endswith((".yml", ".yaml")):
        continue
    t = open(os.path.join(wfdir, f), encoding="utf-8").read()
    for line in t.splitlines():
        if "wrangler" in line and BAD_FLAG.search(line):
            hits.append("%s: %s" % (f, line.strip()))
    for m in re.finditer(r"uses:\s*cloudflare/wrangler-action@\S+", t):
        actions += 1
        before = t[:m.start()]
        if not re.search(r"run:\s*npm ci\b", before):
            hits.append("%s: wrangler-action chạy mà không có npm ci trước" % f)
        step = re.split(r"\n\s*-\s+(name|uses|run):", t[m.end():])[0]
        for key in ("vars", "wranglerVersion", "environment", "command"):
            km = re.search(r"^\s*%s:\s*(.*)$" % key, step, re.M)
            if not km:
                continue
            if key == "command" and not BAD_FLAG.search(km.group(1)) and re.match(r"^\s*deploy\s*$", km.group(1)):
                continue
            hits.append("%s: wrangler-action có input %s: %s" % (f, key, km.group(1).strip()))
pkg = json.load(open(os.path.join(BACK, "package.json"), encoding="utf-8"))
for name, cmd in (pkg.get("scripts") or {}).items():
    if "wrangler" in cmd and BAD_FLAG.search(cmd):
        hits.append("package.json scripts.%s: %s" % (name, cmd))
if actions == 0:
    print("ERROR không thấy workflow nào dùng cloudflare/wrangler-action"); sys.exit(2)
if hits:
    print("FAIL " + " | ".join(hits)); sys.exit(1)
print("PASS %d bước wrangler-action, không cờ/input nào vô hiệu keep_vars" % actions)
