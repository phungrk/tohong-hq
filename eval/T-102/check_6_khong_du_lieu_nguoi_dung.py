#!/usr/bin/env python3
"""Tiêu chí 6: không dữ liệu người dùng thật bị gửi qua Graphify. (a) manifest ghi chế độ chỉ-mã, không backend LLM, không file media/tài liệu;
(b) quét các file Graphify được phép đọc (cây git tại mỗi base_sha, trừ media/tài liệu) tìm email thật, số điện thoại VN, khoá bí mật, .env."""
import os, re, subprocess, sys, tarfile, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
import json
def base_shas():
    out = set()
    for t in json.load(open(os.path.join(HERE, "tasks.json")))["tasks"]:
        r = subprocess.run(["git", "-C", FRONT, "rev-parse", t["base_sha"]], capture_output=True, text=True)
        if r.returncode: fail(f"không phân giải được {t['base_sha']} trong tohong-front")
        out.add(r.stdout.strip())
    return out
shas = sorted(base_shas())
SKIP_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf", ".md", ".woff", ".woff2")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
OKMAIL = ("example.", "@types/", "@vitejs", "@eslint", "@clerk", "@anthropic", "@babel", "@rollup", "@esbuild", "@react", "@ant", "@tohong.", "noreply@", "a@b.vn", "b@c.vn", "ten@email.com", "@test.", "@local")
PHONE = re.compile(r"(?<!\d)(0|\+84)[ .]?\d{2,3}[ .]?\d{3}[ .]?\d{3,4}(?!\d)")
SECRET = re.compile(r"(sk-[A-Za-z0-9]{20,}|pk_(live|test)_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16})")
for sha in shas:
    tar = subprocess.run(["git", "-C", FRONT, "archive", sha], capture_output=True)
    if tar.returncode: fail(f"không đọc được cây {sha} của tohong-front")
    for ti in tarfile.open(fileobj=io.BytesIO(tar.stdout)):
        if not ti.isfile(): continue
        n = ti.name
        if n.startswith(("docs/", "public/")) or n.lower().endswith(SKIP_EXT) or n in ("package-lock.json",): continue
        if re.search(r"(^|/)\.env", n): fail(f"{sha[:7]}: có file env {n}")
        body = tarfile.open(fileobj=io.BytesIO(tar.stdout)).extractfile(ti).read().decode("utf-8", "ignore")
        if SECRET.search(body): fail(f"{sha[:7]}: {n} có chuỗi giống khoá bí mật")
        for e in EMAIL.findall(body):
            if not any(o in e for o in OKMAIL): fail(f"{sha[:7]}: {n} có email {e}")
        if PHONE.search(body): fail(f"{sha[:7]}: {n} có chuỗi giống số điện thoại: {PHONE.search(body).group(0)}")
m = manifest()
if m.get("mode") != "code-only": fail("manifest.mode phải là code-only")
if str(m.get("backend", "")).lower() != "none": fail("manifest.backend phải là none (GRAPHIFY_BACKEND=none)")
if m.get("query_log_disabled") is not True: fail("manifest.query_log_disabled phải là true")
ok(f"chế độ chỉ-mã, quét {len(shas)} cây sạch")
