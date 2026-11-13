#!/usr/bin/env python3
"""T-140 BƯỚC 2, vế PR tohong (bổ sung check_go_cloud_run.py, không sửa nó). Chưa đăng ký vào board; Chief of Staff đăng ký.
tohong/.github/workflows/scrape-vendors.yml sau bước 2: KHÔNG còn MATCHER_URL, MATCHER_API_KEY, MATCHER_RELOAD_PATH, '/admin/reload', bước "Reload matcher service"
(mã chết sau khi xoá secret), VẪN còn tải/ghi gs://${GCS_VENDOR_BUCKET}/vendors/vendors.json (GCS_VENDOR_BUCKET=wedding-planner-vendors, GCS_OBJECT=vendors/vendors.json) và bước upload,
và là YAML hợp lệ. Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq). In PASS / FAIL <lý do>; mã thoát 0/1. Không mạng."""
import os, re, sys
HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")): HQ = os.path.dirname(HQ)
T = os.path.abspath(os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong"))
f = os.path.join(T, ".github", "workflows", "scrape-vendors.yml")
def fail(m): print("FAIL " + m); sys.exit(1)
if not os.path.isfile(f): fail("không thấy tohong/.github/workflows/scrape-vendors.yml")
s = open(f, encoding="utf-8").read()
for pat in ("MATCHER_URL", "MATCHER_API_KEY", "MATCHER_RELOAD_PATH", "/admin/reload", "Reload matcher"):
    if pat in s: fail(f"scrape-vendors.yml còn '{pat}' (khối reload matcher là mã chết)")
if "wedding-planner-vendors" not in s or "vendors/vendors.json" not in s: fail("scrape-vendors.yml mất bucket wedding-planner-vendors hoặc object vendors/vendors.json")
if not re.search(r"gsutil\s+cp\s+output/vendors-merged\.json", s): fail("mất bước upload vendors-merged.json lên GCS")
try:
    import yaml
    d = yaml.safe_load(s)
    if not isinstance(d, dict) or "jobs" not in d: fail("scrape-vendors.yml không phải workflow hợp lệ")
except ImportError: pass
except Exception as e: fail(f"scrape-vendors.yml không phải YAML hợp lệ: {e}")
print("PASS")
