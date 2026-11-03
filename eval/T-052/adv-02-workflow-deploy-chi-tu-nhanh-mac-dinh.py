#!/usr/bin/env python3
"""T-052 adv-02 (adversary, tầng 3). Spec T-051 mục 24(b) "luật gốc: tập file deploy không bao giờ thiếu file nào mà
manifest ok (và do đó pool trên main) đang trỏ tới" + mục 14, 28.
Input: Capu (hoặc `gh workflow run --ref <nhánh>`) chạy `Mirror vendor images` với deploy=true từ một nhánh không phải
nhánh mặc định (vd nhánh feat/t052-tu-host-anh còn sót sau merge, chưa có manifest, hoặc nhánh cũ có pool/manifest cũ).
Khi đó `mirror` dựng manifest của nhánh đó, `deploy` chỉ so với manifest đó, Direct Upload thay cả site → mọi file mà
manifest/pool trên main trỏ tới nhưng nhánh kia không có (ảnh lỗi lần này, vendor mới hơn) biến mất khỏi Pages, app vỡ ảnh.
Mong đợi: workflow chặn deploy khi ref không phải nhánh mặc định. Chấp nhận một trong hai dạng:
  (a) `if:` của job, của bước deploy, hoặc của cả hai bước deploy và mở PR có so `github.ref`/`github.ref_name` với
      nhánh mặc định (`refs/heads/main`, `main`, hoặc `github.event.repository.default_branch`);
  (b) một bước chạy TRƯỚC bước deploy có script so GITHUB_REF/GITHUB_REF_NAME/github.ref với nhánh mặc định và `exit` khác 0.
Eval tĩnh trên YAML (như check 7), vì workflow chỉ chạy được trên GitHub Actions.
Chạy không tham số. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back, rồi /home/user/tohong-back."""
import os, re, sys
try:
    import yaml
except Exception as e:
    print("FAIL cần PyYAML: " + str(e)); sys.exit(1)

back = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back")
             if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
if not back:
    print("FAIL không tìm thấy repo tohong-back"); sys.exit(1)
wf = os.path.join(back, ".github", "workflows", "mirror-vendor-images.yml")
if not os.path.isfile(wf):
    print("FAIL không có workflow mirror-vendor-images.yml"); sys.exit(1)
d = yaml.safe_load(open(wf, encoding="utf-8"))

REF = re.compile(r"github\.ref(_name)?\b|GITHUB_REF(_NAME)?\b")
DEF = re.compile(r"refs/heads/main\b|['\"]main['\"]|==\s*main\b|default_branch")
def guards(expr):
    s = str(expr or "")
    return bool(REF.search(s) and DEF.search(s))

found = []
for jname, job in (d.get("jobs") or {}).items():
    steps = job.get("steps") or []
    idx = [i for i, s in enumerate(steps) if re.search(r"vendor-images\.mjs\"?\s+deploy\b|\$TOOL\"?\s+deploy\b|\bdeploy\s+--dir\b", str(s.get("run", "")))]
    if not idx:
        continue
    di = idx[0]
    if guards(job.get("if")):
        found.append(f"job {jname} if"); continue
    if guards(steps[di].get("if")):
        found.append("bước deploy if"); continue
    for s in steps[:di]:
        run = str(s.get("run", ""))
        if guards(run) and re.search(r"\bexit\s+[1-9]", run):
            found.append(f"bước '{s.get('name')}'"); break
    if not found:
        print(f"FAIL workflow không chặn deploy=true khi chạy từ nhánh khác nhánh mặc định (job {jname}): deploy từ nhánh cũ thay cả site Pages, "
              "xoá file mà pool trên main đang trỏ tới (spec T-051 mục 24b, 14)"); sys.exit(1)
if not found:
    print("FAIL không tìm thấy bước deploy trong workflow"); sys.exit(1)
print("PASS deploy chỉ chạy từ nhánh mặc định: " + ", ".join(found)); sys.exit(0)
