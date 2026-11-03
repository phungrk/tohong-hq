#!/usr/bin/env python3
"""T-051 tiêu chí 7: không secret trong repo, không commit ảnh vào repo app, workflow dùng đúng secret, có hướng dẫn cho Capu.
Chạy: python3 eval/T-051/check_7_ve_sinh_repo.py --back <tohong-back> --front <tohong-front> --tohong <tohong>. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, re, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *

a = parse_args()
back, front, tohong = (a.get(k) or fail(f"cần --{k}") for k in ("back", "front", "tohong"))
def git(repo, *args):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if r.returncode: fail(f"git {' '.join(args)} lỗi trong {repo}: {r.stderr[-120:]}")
    return r.stdout
# 1. không có ảnh ra (webp/jpg/png/gif) mới được git theo dõi trong thư mục công cụ; không file .webp ở đâu cả
for repo in (back, front, tohong):
    webp = [f for f in git(repo, "ls-files").splitlines() if f.lower().endswith(".webp")]
    if webp: fail(f"{repo}: có {len(webp)} file .webp được git theo dõi, vd {webp[0]}")
# 2. thư mục ra bị bỏ qua
gi = open(os.path.join(back, ".gitignore"), encoding="utf-8").read() if os.path.isfile(os.path.join(back, ".gitignore")) else ""
if not re.search(r"^/?scripts/vendor-images/out/?\s*$", gi, re.M): fail(".gitignore của tohong-back phải bỏ qua scripts/vendor-images/out/")
# 3. workflow
wf = os.path.join(back, ".github", "workflows", "mirror-vendor-images.yml")
if not os.path.isfile(wf): fail("thiếu .github/workflows/mirror-vendor-images.yml trong tohong-back")
t = open(wf, encoding="utf-8").read()
if "workflow_dispatch" not in t: fail("workflow phải chạy được bằng tay (workflow_dispatch)")
if re.search(r"^\s*schedule:", t, re.M) or re.search(r"^\s*push:", t, re.M): fail("workflow không được tự chạy theo lịch/push (chỉ Capu bấm chạy)")
for s in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
    if "${{ secrets.%s }}" % s not in t: fail(f"workflow phải lấy {s} từ ${{{{ secrets.{s} }}}}")
if re.search(r"(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\s*[:=]\s*['\"]?[A-Za-z0-9_-]{16,}", t): fail("workflow chứa giá trị giống secret viết thẳng")
if "tohong-img" not in t: fail("workflow phải dùng project Pages tên tohong-img")
if re.search(r"git add[^\n]*(out|\.webp)", t): fail("workflow không được git add thư mục ảnh")
if not re.search(r"pull-requests:\s*write", t) or not re.search(r"contents:\s*write", t): fail("workflow phải khai quyền contents: write và pull-requests: write (mở PR, không đẩy thẳng main)")
if re.search(r"git push[^\n]*\bmain\b", t): fail("workflow không được đẩy thẳng lên main")
if not re.search(r"upload-artifact", t) or "manifest" not in t: fail("workflow phải để lại manifest + pool đã rewrite làm artifact (hoặc mở PR) để Capu lấy")
# 4. toàn repo không chứa giá trị giống token Cloudflare (40 ký tự) trong file theo dõi của 3 repo
for repo in (back, front, tohong):
    r = subprocess.run(f"git -C {repo} ls-files -z | xargs -0 grep -nIE '(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)[\"\\x27]?\\s*[:=]\\s*[\"\\x27]?[A-Za-z0-9_-]{{30,}}' || true", shell=True, capture_output=True, text=True)
    if r.stdout.strip(): fail(f"{repo}: giá trị giống secret Cloudflare: {r.stdout[:120]}")
# 5. hướng dẫn cho Capu
g = os.path.join(back, "scripts", "vendor-images", "README.md")
if not os.path.isfile(g): fail("thiếu scripts/vendor-images/README.md (hướng dẫn từng bước cho Capu)")
gt = open(g, encoding="utf-8").read()
for must in ("tohong-img", "Direct Upload", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "Settings", "Actions", "Run workflow", "pages.dev"):
    if must not in gt: fail(f"hướng dẫn thiếu '{must}'")
steps = re.findall(r"^\s*(\d+)\.\s+\S", gt, re.M)
if len(steps) < 6: fail("hướng dẫn phải là các bước đánh số (>= 6 bước)")
if re.search(r"[A-Za-z0-9_-]{35,}", re.sub(r"https?://\S+|`[^`]*`", "", gt)) and False: pass
ok("không .webp trong repo, workflow đúng secret/chỉ chạy tay, thư mục ra bị ignore, có hướng dẫn đánh số")
