#!/usr/bin/env python3
"""T-085 tiêu chí 1-2: mọi workflow trong .github/workflows là YAML hợp lệ, có `on` và `jobs`,
không dùng context `secrets` trong bất kỳ `if:` nào (GitHub từ chối cả file -> mọi lượt chạy đỏ, 0 job).
Riêng mirror-issue.yml: bước đồng bộ Project vẫn chỉ chạy khi có PROJECTS_TOKEN (điều kiện qua env, không qua secrets)."""
import pathlib, sys, re, yaml
ROOT = pathlib.Path(__file__).resolve().parents[2]
bad = []
def walk_if(node, path, fname):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "if" and isinstance(v, str) and re.search(r"\bsecrets\.", v):
                bad.append(f"{fname}:{path}: if dùng secrets: {v}")
            walk_if(v, f"{path}/{k}", fname)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk_if(v, f"{path}[{i}]", fname)
for f in sorted((ROOT / ".github/workflows").glob("*.yml")):
    try:
        d = yaml.safe_load(f.read_text())
    except Exception as e:
        bad.append(f"{f.name}: YAML lỗi {e}"); continue
    if not isinstance(d, dict) or "jobs" not in d or not ({"on", True} & set(d)):
        bad.append(f"{f.name}: thiếu on/jobs"); continue
    if not d.get("name"):
        bad.append(f"{f.name}: thiếu name")
    walk_if(d, "", f.name)
mi = yaml.safe_load((ROOT / ".github/workflows/mirror-issue.yml").read_text())
steps = [s for j in mi["jobs"].values() for s in j.get("steps", [])]
proj = [s for s in steps if "mirror_project.py" in str(s.get("run", ""))]
if len(proj) != 1:
    bad.append("mirror-issue.yml: phải có đúng 1 bước chạy mirror_project.py")
else:
    cond = str(proj[0].get("if", ""))
    if "PROJECTS_TOKEN" not in cond:
        bad.append("mirror-issue.yml: bước Project phải có điều kiện theo PROJECTS_TOKEN (qua env)")
if bad:
    print("FAIL\n" + "\n".join(bad)); sys.exit(1)
print("PASS mọi workflow hợp lệ, không if nào dùng secrets; bước Project có điều kiện PROJECTS_TOKEN qua env")
