#!/usr/bin/env python3
"""T-202 adv-03 (tầng 3): wrangler tìm cấu hình theo thứ tự wrangler.json > wrangler.jsonc > wrangler.toml, và tôn trọng chuyển hướng
.wrangler/deploy/config.json. Nếu một trong các file đó có mặt ở gốc tohong-back (kể cả không theo dõi bởi git mà CI tạo ra), keep_vars
trong wrangler.toml bị bỏ qua lặng lẽ. Kiểm: không có wrangler.json / wrangler.jsonc / .wrangler/deploy/config.json trong repo, và không
bước workflow nào tạo chúng. Đọc file, không mạng. Repo: TOHONG_BACK_REPO. Thoát 0 = PASS, 1 = FAIL, 2 = không chạy được."""
import os, re, sys

BACK = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
if not os.path.isfile(os.path.join(BACK, "wrangler.toml")):
    print("ERROR không thấy wrangler.toml trong " + BACK); sys.exit(2)
hits = [p for p in ("wrangler.json", "wrangler.jsonc", ".wrangler/deploy/config.json") if os.path.exists(os.path.join(BACK, p))]
wf = os.path.join(BACK, ".github", "workflows")
for f in sorted(os.listdir(wf)) if os.path.isdir(wf) else []:
    t = open(os.path.join(wf, f), encoding="utf-8").read()
    if re.search(r"wrangler\.jsonc?\b|\.wrangler/deploy", t):
        hits.append(".github/workflows/%s nhắc tới wrangler.json(c)/.wrangler/deploy" % f)
if hits:
    print("FAIL cấu hình che wrangler.toml: " + ", ".join(hits)); sys.exit(1)
print("PASS wrangler.toml là cấu hình duy nhất wrangler dùng")
