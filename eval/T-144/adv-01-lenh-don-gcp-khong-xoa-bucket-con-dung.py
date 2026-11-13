#!/usr/bin/env python3
"""T-144 adv-01 (adversary, tầng 3). Lệnh dọn Google cho Capu (spec T-140 mục "Bước 2", và mô tả PR nếu đưa vào qua T144_PR_BODY=<file>)
KHÔNG được xoá một bucket GCS mà workflow còn sống ở tohong / tohong-back / tohong-front vẫn đọc hoặc ghi.
Lý do: gs://wedding-planner-vendors dùng chung. matcher Cloud Run đọc vendors.json ở gốc, nhưng tohong/.github/workflows/scrape-vendors.yml
tải gs://wedding-planner-vendors/vendors/vendors.json (kho vendor đã gộp, giữ vendor verified) rồi ghi đè lại sau khi enrich Google.
Xoá cả bucket: lần scrape REAL sau đó tải lỗi -> rơi về '{"vendors":[]}' im lặng -> gộp mất vendor cũ -> tiêu ngân sách Google enrich -> đỏ ở bước upload.
In PASS / FAIL <lý do>; mã thoát 0/1. Không mạng, không gọi gcloud."""
import glob, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = HERE
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")): HQ = os.path.dirname(HQ)
def repo(var, name): return os.path.abspath(os.environ.get(var) or os.path.join(HQ, "..", name))
REPOS = {"tohong": repo("TOHONG_REPO", "tohong"), "tohong-back": repo("TOHONG_BACK_REPO", "tohong-back"), "tohong-front": repo("TOHONG_FRONT_REPO", "tohong-front")}
def fail(m): print("FAIL " + m); sys.exit(1)

spec = open(os.path.join(HQ, "products", "T-140-chat-ghep-vendor-computematches.md"), encoding="utf-8").read()
i = spec.find("Lệnh cho Capu tự chạy")
if i < 0: fail("spec không còn mục 'Lệnh cho Capu tự chạy' (không kiểm được)")
a = spec.find("```", i); b = spec.find("```", a + 3)
sources = {"spec T-140 bước 2": spec[a:b]}
if os.environ.get("T144_PR_BODY"): sources["mô tả PR"] = open(os.environ["T144_PR_BODY"], encoding="utf-8").read()

# lệnh xoá CẢ bucket (không phải một object cụ thể)
DEL = [re.compile(r"gcloud\s+storage\s+rm\s+(?:-\S+\s+)*-r\s+(?:-\S+\s+)*gs://([\w.-]+)/?(?=\s|$)", re.M),
       re.compile(r"gsutil\s+(?:-m\s+)?rm\s+(?:-\S+\s+)*-r\s+(?:-\S+\s+)*gs://([\w.-]+)/?(?=\s|$)", re.M),
       re.compile(r"gsutil\s+rb\s+(?:-\S+\s+)*gs://([\w.-]+)", re.M),
       re.compile(r"gcloud\s+storage\s+buckets\s+delete\s+gs://([\w.-]+)", re.M)]
wf = []
for name, r in REPOS.items():
    if not os.path.isdir(r): fail(f"không thấy repo {name} ({r})")
    for p in sorted(glob.glob(os.path.join(r, ".github", "workflows", "*.y*ml"))):
        wf.append((f"{name}/{os.path.relpath(p, r)}", open(p, encoding="utf-8").read()))
checked = 0
for src, txt in sources.items():
    for line in txt.splitlines():
        if line.lstrip().startswith("#"): continue
        for rx in DEL:
            for m in rx.finditer(line):
                checked += 1
                bucket = m.group(1)
                users = [n for n, s in wf if re.search(r"(?<![\w.-])" + re.escape(bucket) + r"(?![\w.-])", s)]
                if users:
                    fail(f"{src}: lệnh '{line.strip()}' xoá cả bucket {bucket} nhưng workflow còn sống dùng nó: {', '.join(users)}")
print(f"PASS ({checked} lệnh xoá bucket, không bucket nào còn workflow dùng)")
