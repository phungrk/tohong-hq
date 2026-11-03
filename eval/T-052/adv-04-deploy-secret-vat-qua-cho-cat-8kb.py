#!/usr/bin/env python3
"""T-052 adv-04 (adversary, tầng 3). Spec T-051 mục 25: giá trị token và account id không in ra log.
Input: wrangler (giả, qua WRANGLER_BIN) in một đoạn dài hơn 8KB KHÔNG có dấu xuống dòng (vd thanh tiến trình, JSON dài),
trong đó token nằm vắt qua chỗ bộ đệm cắt (bộ đệm v2 cắt ở buf.length - KEEP rồi lọc từng nửa, nên secret nằm
ngang chỗ cắt bị tách đôi và không nửa nào bị che). Thử nhiều vị trí và hai cách ghi (một lần, hai lần).
Mong đợi: stdout và stderr của `deploy` không chứa đủ chuỗi token hay account id ở bất kỳ ca nào.
Không gọi Cloudflare. Chạy không tham số. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back, rồi /home/user/tohong-back."""
import json, os, stat, subprocess, sys, tempfile

back = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back")
             if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
if not back:
    print("FAIL không tìm thấy repo tohong-back"); sys.exit(1)
tool = os.path.join(back, "scripts", "vendor-images", "vendor-images.mjs")
tmp = tempfile.mkdtemp(prefix="t052-adv04-")
out = os.path.join(tmp, "out"); os.makedirs(os.path.join(out, "v"))
open(os.path.join(out, "v", "a.webp"), "wb").write(b"RIFF\x00\x00\x00\x00WEBPVP8 ")
man = os.path.join(tmp, "manifest.json")
json.dump({"version": 1, "baseUrl": "https://tohong-img.pages.dev",
           "entries": {"https://src.example/a.jpg": {"status": "ok", "file": "v/a.webp", "width": 1, "height": 1, "bytes": 16}}}, open(man, "w"))
wr = os.path.join(tmp, "fake-wrangler.py")
open(wr, "w").write("""#!/usr/bin/env python3
import os, sys, time
stream = sys.stdout if os.environ["ADV_STREAM"] == "out" else sys.stderr
t = os.environ["CLOUDFLARE_API_TOKEN"] if os.environ["ADV_WHICH"] == "token" else os.environ["CLOUDFLARE_ACCOUNT_ID"]
L, p, mode = int(os.environ["ADV_LEN"]), int(os.environ["ADV_POS"]), os.environ["ADV_MODE"]
s = "A" * p + t; s += "B" * (L - len(s))
if mode == "one":
    stream.write(s); stream.flush()
else:
    stream.write(s[:p]); stream.flush(); time.sleep(0.2); stream.write(s[p:]); stream.flush()
""")
os.chmod(wr, os.stat(wr).st_mode | stat.S_IEXEC)
TOKEN = "cfTk_9fQ2xLmA7bZ0pR4sV8wY1cE6gH3jK5nT"   # 38 ký tự, như token API thật
ACC = "0a1b2c3d4e5f60718293a4b5c6d7e8f9"
base = {k: v for k, v in os.environ.items() if k not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "WRANGLER_BIN")}
base.update(CLOUDFLARE_API_TOKEN=TOKEN, CLOUDFLARE_ACCOUNT_ID=ACC, WRANGLER_BIN=wr)
leaks = []
cases = 0
for which, val in (("token", TOKEN), ("account", ACC)):
    for st in ("out", "err"):
        for L in (9000, 20000):
            for back_off in (5, 20, 300, 512 + 5, 512 + 20):
                pos = L - back_off
                if pos < 0 or pos + len(val) > L:
                    pos = max(0, L - len(val) - 1)
                for mode in ("one", "two"):
                    cases += 1
                    env = dict(base, ADV_STREAM=st, ADV_WHICH=which, ADV_LEN=str(L), ADV_POS=str(pos), ADV_MODE=mode)
                    r = subprocess.run(["node", tool, "deploy", "--dir", out, "--manifest", man, "--project", "tohong-img"],
                                       capture_output=True, text=True, env=env, timeout=60)
                    for sname, s in (("stdout", r.stdout), ("stderr", r.stderr)):
                        if TOKEN in s or ACC in s:
                            leaks.append(f"{which} std{st} L={L} pos={pos} {mode} → lọt ở {sname}")
if leaks:
    print(f"FAIL {len(leaks)}/{cases} ca để lọt secret khi output dài >8KB không xuống dòng, vd {leaks[0]}"); sys.exit(1)
print(f"PASS {cases} ca, secret không lọt kể cả khi nằm ngang chỗ cắt bộ đệm"); sys.exit(0)
