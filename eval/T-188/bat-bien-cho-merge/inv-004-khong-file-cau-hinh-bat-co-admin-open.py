#!/usr/bin/env python3
"""Nguồn: T-188 (spec products/T-188-mo-admin-khong-dang-nhap.md v2, đề xuất INV-D; spec-critic xác nhận khi spec qua Spec Gate).
Bất biến: không file cấu hình nào trong repo tohong-back và tohong-front bật cờ mở admin không đăng nhập.
  back : wrangler*.toml, .dev.vars*, .env* không có dòng ADMIN_OPEN có giá trị đúng "1"; package.json không đặt ADMIN_OPEN=1.
  front: .env*, vercel.json, package.json không đặt VITE_ADMIN_OPEN thành 1; vite.config.* không nhắc tới VITE_ADMIN_OPEN.
Lý do: mặc định TẮT (ADR-116) chỉ giữ được nếu không file nào trong repo âm thầm bật; Capu tự bật ở Cloudflare/Vercel. Quét tĩnh (build thật nằm ở eval/T-188/check_6).
Repo: TOHONG_BACK_REPO, TOHONG_FRONT_REPO (mặc định /home/user/tohong-back, /home/user/tohong-front). Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import os, re, sys

BACK = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
FRONT = os.environ.get("TOHONG_FRONT_REPO", "/home/user/tohong-front")
hits = []


def val(v):
    return re.sub(r"#.*", "", v).strip().strip("\"'")


def scan(repo, name, var, env_re, extra_files, no_mention=()):
    if not os.path.isdir(repo):
        print("FAIL không thấy repo " + repo); sys.exit(1)
    for f in sorted(os.listdir(repo)):
        full = os.path.join(repo, f)
        if not os.path.isfile(full):
            continue
        t = open(full, encoding="utf-8", errors="replace").read()
        if re.match(env_re, f):
            for line in t.splitlines():
                m = re.match(r"^\s*(?:export\s+)?" + var + r"\s*[=:]\s*(.*)$", line)
                if m and val(m.group(1)) == "1":
                    hits.append(f"{name}/{f}: {line.strip()}")
        elif any(re.match(p, f) for p in no_mention):
            if var in t:
                hits.append(f"{name}/{f}: nhắc tới {var}")
        elif f in extra_files:
            if re.search(r"""\b""" + var + r"""["']?\s*[=:]\s*["']?1(?![0-9A-Za-z])""", t):
                hits.append(f"{name}/{f}: đặt {var}=1")


scan(BACK, "back", "ADMIN_OPEN", r"^(wrangler.*\.toml|\.dev\.vars.*|\.env.*)$", {"package.json", "vercel.json"})
scan(FRONT, "front", "VITE_ADMIN_OPEN", r"^\.env(\..*)?$", {"vercel.json", "package.json"}, no_mention=(r"^vite\.config\.",))
if hits:
    print("FAIL " + " | ".join(hits)); sys.exit(1)
print("PASS")
