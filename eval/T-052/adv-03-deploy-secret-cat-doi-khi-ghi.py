#!/usr/bin/env python3
"""T-052 adv-03 (adversary, tầng 3). Spec T-051 mục 25: giá trị token và account id không in ra log.
Input: wrangler (giả, qua WRANGLER_BIN) in token thành hai lần ghi cách nhau 300ms, như khi một dòng dài bị cắt ở biên
bộ đệm ống; và in token kèm ký tự đặc biệt của regex/shell.
Mong đợi: stdout và stderr của `deploy` không chứa token hay account id (đủ chuỗi). Lọc theo từng mẩu dữ liệu (chunk)
để lọt token khi nó nằm vắt qua hai mẩu.
Không gọi Cloudflare. Chạy không tham số. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back, rồi /home/user/tohong-back."""
import json, os, stat, subprocess, sys, tempfile

back = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back")
             if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
if not back:
    print("FAIL không tìm thấy repo tohong-back"); sys.exit(1)
tool = os.path.join(back, "scripts", "vendor-images", "vendor-images.mjs")
tmp = tempfile.mkdtemp(prefix="t052-adv03-")
out = os.path.join(tmp, "out"); os.makedirs(os.path.join(out, "v"))
open(os.path.join(out, "v", "a.webp"), "wb").write(b"RIFF\x00\x00\x00\x00WEBPVP8 ")
man = os.path.join(tmp, "manifest.json")
json.dump({"version": 1, "baseUrl": "https://tohong-img.pages.dev",
           "entries": {"https://src.example/a.jpg": {"status": "ok", "file": "v/a.webp", "width": 1, "height": 1, "bytes": 16}}}, open(man, "w"))
wr = os.path.join(tmp, "fake-wrangler.sh")
open(wr, "w").write("""#!/bin/bash
t="$CLOUDFLARE_API_TOKEN"; a="$CLOUDFLARE_ACCOUNT_ID"
printf 'debug token=%s' "${t:0:12}"; sleep 0.3; printf '%s\\n' "${t:12}"
printf 'debug account=%s' "${a:0:10}" >&2; sleep 0.3; printf '%s\\n' "${a:10}" >&2
echo "full token=$t account=$a"
exit 0
""")
os.chmod(wr, os.stat(wr).st_mode | stat.S_IEXEC)
TOKEN = "Zx9.q*Ab$(id)[0-9]+^cF_Tok3n-" + "k" * 12
ACC = "0a1b2c3d4e5f60718293a4b5c6d7e8f9"
env = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
env.update(CLOUDFLARE_API_TOKEN=TOKEN, CLOUDFLARE_ACCOUNT_ID=ACC, WRANGLER_BIN=wr)
r = subprocess.run(["node", tool, "deploy", "--dir", out, "--manifest", man, "--project", "tohong-img"], capture_output=True, text=True, env=env, timeout=60)
leaks = [f"{name} trong {stream}" for stream, s in (("stdout", r.stdout), ("stderr", r.stderr)) for name, v in (("token", TOKEN), ("account id", ACC)) if v in s]
if leaks:
    print("FAIL deploy để lọt secret ra log khi wrangler ghi nó qua hai lần ghi: " + ", ".join(leaks)); sys.exit(1)
if r.returncode != 0:
    print(f"FAIL deploy với wrangler giả thoát {r.returncode}: {r.stderr[-200:]}"); sys.exit(1)
print("PASS token và account id không lọt ra stdout/stderr, kể cả khi bị cắt đôi"); sys.exit(0)
