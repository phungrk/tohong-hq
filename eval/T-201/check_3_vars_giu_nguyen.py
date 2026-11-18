#!/usr/bin/env python3
"""T-201 tiêu chí 1c: sau thay đổi (có keep_vars = true), bảng [vars] y hệt bản chụp trước thay đổi (main, 2026-11-18): đủ 11 khoá, đúng giá trị, không thêm khoá.
Bản chụp là dữ liệu của eval, không lấy từ code. Chạy: python3 -I eval/T-201/check_3_vars_giu_nguyen.py. Thoát 0 = PASS, 1 = FAIL."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import load

BASELINE = {
    "PROVIDER_TIMEOUT_MS": "30000",
    "PROVIDER_RETRIES": "1",
    "NODE_ENV": "production",
    "DEBUG_MATCHING": "true",
    "CLERK_ISSUER": "https://social-sculpin-9.clerk.accounts.dev",
    "CLERK_JWKS_URL": "https://social-sculpin-9.clerk.accounts.dev/.well-known/jwks.json",
    "CLAUDE_MODEL": "claude-sonnet-4-6",
    "PROVIDER_ORDER": "gemini",
    "GEMINI_MODEL": "gemini-2.5-flash",
    "LLM_RELAY_URL": "https://relay-beta-bay.vercel.app/api/proxy",
    "ADMIN_APP_URL": "https://tohong-front.vercel.app/?admin",
}
cfg = load()
if cfg.get("keep_vars") is not True:
    print("FAIL chưa có keep_vars = true (eval này chỉ có nghĩa khi thay đổi đã làm)"); sys.exit(1)
cur = cfg.get("vars", {})
if cur != BASELINE:
    diff = sorted(k for k in set(cur) | set(BASELINE) if cur.get(k) != BASELINE.get(k))
    print("FAIL [vars] đổi ở: " + ", ".join(diff)); sys.exit(1)
print("PASS")
