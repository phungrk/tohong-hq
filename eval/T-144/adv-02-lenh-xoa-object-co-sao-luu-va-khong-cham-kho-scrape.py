#!/usr/bin/env python3
"""T-144 adv-02 (adversary, tầng 3). Trong khối lệnh dọn Google cho Capu (spec T-140 mục "Bước 2", và thân PR nếu đưa qua T144_PR_BODY=<file>):
 (a) mọi object GCS bị `gcloud storage rm` / `gsutil rm` phải được sao lưu (`gcloud storage cp` / `gsutil cp` chính object đó) ở một dòng lệnh TRƯỚC nó;
 (b) không lệnh xoá nào chạm object mà workflow còn sống dùng (vd vendors/vendors.json của tohong scrape-vendors.yml, ghép từ GCS_VENDOR_BUCKET + GCS_OBJECT),
     kể cả xoá theo tiền tố/wildcard (gs://b/vendors/, gs://b/**).
In PASS / FAIL <lý do>; mã thoát 0/1. Không mạng, không gọi gcloud."""
import glob, os, re, sys, fnmatch
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = HERE
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")): HQ = os.path.dirname(HQ)
def repo(var, name): return os.path.abspath(os.environ.get(var) or os.path.join(HQ, "..", name))
REPOS = {"tohong": repo("TOHONG_REPO", "tohong"), "tohong-back": repo("TOHONG_BACK_REPO", "tohong-back"), "tohong-front": repo("TOHONG_FRONT_REPO", "tohong-front")}
def fail(m): print("FAIL " + m); sys.exit(1)

spec = open(os.path.join(HQ, "products", "T-140-chat-ghep-vendor-computematches.md"), encoding="utf-8").read()
i = spec.find("Lệnh cho Capu tự chạy")
if i < 0: fail("spec không còn mục 'Lệnh cho Capu tự chạy'")
a = spec.find("```", i); b = spec.find("```", a + 3)
sources = {"spec T-140 bước 2": spec[a + 3:b]}
if os.environ.get("T144_PR_BODY"):
    body = open(os.environ["T144_PR_BODY"], encoding="utf-8").read()
    j = body.find("```"); k = body.find("```", j + 3)
    if j < 0 or k < 0: fail("thân PR không có khối lệnh")
    sources["thân PR"] = body[j + 3:k]

# object đang được workflow sống dùng: gs://<bucket>/<object> ghép từ env của workflow, và mọi gs://... viết thẳng
live = set()
for name, r in REPOS.items():
    if not os.path.isdir(r): fail(f"không thấy repo {name} ({r})")
    for p in glob.glob(os.path.join(r, ".github", "workflows", "*.y*ml")):
        s = open(p, encoding="utf-8").read()
        env = dict(re.findall(r"^\s*([A-Z_][A-Z0-9_]*):\s*\"?([\w./-]+)\"?\s*$", s, re.M))
        s = re.sub(r"\$\{\{\s*env\.(\w+)\s*\}\}", lambda x: env.get(x.group(1), "?"), s)
        for m in re.finditer(r"gs://([^\s\"']+)", s):
            u = re.sub(r"\$\{?(\w+)\}?", lambda x: env.get(x.group(1), "?"), m.group(1))
            if "?" not in u and "/" in u.strip("/"): live.add((u.strip("/"), f"{name}/{os.path.relpath(p, r)}"))
if not live: fail("không tìm thấy object GCS nào workflow còn dùng (eval không tự kiểm được: dò sai?)")

RM = re.compile(r"^\s*(?:gcloud\s+storage\s+rm|gsutil\s+(?:-m\s+)?rm)\b(.*)$")
CP = re.compile(r"^\s*(?:gcloud\s+storage\s+cp|gsutil\s+(?:-m\s+)?cp)\b(.*)$")
n = 0
for src, txt in sources.items():
    backed = set()
    for line in txt.splitlines():
        if line.lstrip().startswith("#"): continue
        m = CP.match(line)
        if m:
            urls = [u.strip("/") for u in re.findall(r"gs://(\S+)", m.group(1))]
            if not line.rstrip().endswith(tuple(f"gs://{u}" for u in urls)) or len(urls) > 1:
                backed.update(urls)  # nguồn là gs:// (đích cục bộ) thì đó là sao lưu
            continue
        m = RM.match(line)
        if not m: continue
        for u in (x.strip("/") for x in re.findall(r"gs://(\S+)", m.group(1))):
            n += 1
            if u not in backed: fail(f"{src}: xoá gs://{u} mà chưa sao lưu đúng object đó ở lệnh trước")
            for obj, wf in live:
                if obj == u or fnmatch.fnmatch(obj, u) or obj.startswith(u.rstrip("*") + "/") or ("-r" in m.group(1).split() and obj.startswith(u + "/")):
                    fail(f"{src}: lệnh '{line.strip()}' xoá gs://{obj} mà {wf} còn dùng")
print(f"PASS ({n} object bị xoá, đều đã sao lưu trước; không chạm {len(live)} object workflow còn dùng)")
