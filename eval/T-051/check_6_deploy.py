#!/usr/bin/env python3
"""T-051 tiêu chí 6: deploy lên Pages có chốt chặn: thiếu secret thì dừng, thiếu ảnh/quá giới hạn thì dừng TRƯỚC khi gọi wrangler, không in giá trị secret.
Dùng wrangler giả (biến WRANGLER_BIN). Chạy: python3 eval/T-051/check_6_deploy.py --back /đường/dẫn/tohong-back. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, json, stat, shutil
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")
w = Work()
try:
    need_summary(w.mirror(back), "mirror")
    log = os.path.join(w.tmp, "wrangler.log")
    fake = os.path.join(w.tmp, "wrangler-fake.sh")
    open(fake, "w").write('#!/usr/bin/env bash\n{ echo "ARGS $*"; echo "TOKEN_SET=${CLOUDFLARE_API_TOKEN:+yes}"; echo "ACCT_SET=${CLOUDFLARE_ACCOUNT_ID:+yes}"; } >> "%s"\necho "fake wrangler: deployed ${@: -1}"\nexit 0\n' % log)
    os.chmod(fake, 0o755)
    TOKEN, ACCT = "fake-token-VALUE-9f8e7d", "fake-acct-VALUE-1a2b3c"
    base_env = {"WRANGLER_BIN": fake}
    dep = lambda extra=None, env=None, d=None: run(cli(back) + ["deploy", "--dir", d or w.out, "--manifest", w.manifest, "--project", "tohong-img"] + (extra or []), env={**base_env, **(env or {})})
    called = lambda: os.path.isfile(log) and "ARGS" in open(log).read()
    # 1. thiếu secret
    r = dep()
    if r.returncode == 0: fail("thiếu CLOUDFLARE_API_TOKEN/ACCOUNT_ID mà vẫn thoát 0")
    if "CLOUDFLARE_API_TOKEN" not in r.stdout + r.stderr: fail("thông báo lỗi phải nêu tên biến CLOUDFLARE_API_TOKEN")
    if called(): fail("thiếu secret mà vẫn gọi wrangler")
    env = {"CLOUDFLARE_API_TOKEN": TOKEN, "CLOUDFLARE_ACCOUNT_ID": ACCT}
    # 2. dry-run: kiểm hết, không gọi wrangler
    r = dep(["--dry-run"], env)
    if r.returncode != 0: fail("dry-run đủ điều kiện phải thoát 0: " + (r.stdout + r.stderr)[-200:])
    if called(): fail("--dry-run không được gọi wrangler")
    if "tohong-img" not in r.stdout: fail("dry-run phải in kế hoạch có tên project tohong-img")
    # 3. thiếu file của entry ok -> dừng trước wrangler (deploy Direct Upload thay cả site, thiếu file = link chết)
    ents = [e for e in w.man()["entries"].values() if e["status"] == "ok"]
    victim = os.path.join(w.out, ents[0]["file"]); keep = open(victim, "rb").read(); os.remove(victim)
    r = dep(env=env)
    if r.returncode == 0 or called(): fail("thiếu file ảnh của entry ok phải dừng, không gọi wrangler")
    if ents[0]["file"] not in r.stdout + r.stderr: fail("thông báo phải nêu file thiếu " + ents[0]["file"])
    open(victim, "wb").write(keep)
    # 4. vượt giới hạn số file
    r = dep(["--max-files", "3"], env)
    if r.returncode == 0 or called(): fail("vượt --max-files phải dừng trước wrangler")
    # 5. file > 25 MiB
    big = os.path.join(w.out, "v", "zzz-big.webp"); open(big, "wb").write(b"\0" * (25 * 1024 * 1024 + 1))
    r = dep(env=env)
    if r.returncode == 0 or called(): fail("file > 25 MiB phải dừng trước wrangler")
    os.remove(big)
    # 6. đủ điều kiện: gọi wrangler đúng một lần, đúng project, secret chuyển qua môi trường, không in giá trị
    r = dep(env=env)
    if r.returncode != 0: fail("deploy đủ điều kiện phải thoát 0: " + (r.stdout + r.stderr)[-300:])
    txt = open(log).read()
    if txt.count("ARGS") != 1: fail("phải gọi wrangler đúng 1 lần")
    args = [l for l in txt.splitlines() if l.startswith("ARGS")][0]
    if "pages deploy" not in args or "--project-name tohong-img" not in args or w.out not in args: fail("lệnh wrangler sai: " + args)
    if "TOKEN_SET=yes" not in txt or "ACCT_SET=yes" not in txt: fail("secret phải tới wrangler qua biến môi trường")
    if TOKEN in args or ACCT in args: fail("secret nằm trên dòng lệnh wrangler (lộ trong ps)")
    if TOKEN in r.stdout + r.stderr or ACCT in r.stdout + r.stderr: fail("deploy in giá trị secret ra log")
    # 7. _headers: cache dài + ảnh nằm dưới /v/
    h = os.path.join(w.out, "_headers")
    if not os.path.isfile(h): fail("thư mục deploy phải có _headers")
    ht = open(h).read()
    if "/v/*" not in ht or "immutable" not in ht or "max-age=31536000" not in ht: fail("_headers phải đặt Cache-Control: public, max-age=31536000, immutable cho /v/*")
    ok("chốt chặn deploy: thiếu secret/thiếu file/quá giới hạn dừng trước wrangler; secret không lộ; _headers đúng")
finally:
    w.stop()
