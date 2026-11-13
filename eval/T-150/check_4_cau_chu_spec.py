#!/usr/bin/env python3
"""T-150 tiêu chí 4: hai câu chữ sai của spec T-147 đã được sửa (ADR-083 mục 4), và số trong câu mới đúng với luật tính.
Đo văn bản của products/T-147-drawer-vendor-enrich.md (spec là hợp đồng nên đo chữ là đo hành vi đã hứa) cộng một phép tính độc lập:
  min = min(560, V); max = max(min, 90% V); tay cầm hiện khi max > min. Ngưỡng nhỏ nhất V (nguyên) thoả điều đó phải bằng con số spec ghi.
(a) spec không còn câu "tay cầm ... khung nhìn > 560px" và ghi đúng ngưỡng tính được (623px);
(b) spec không còn câu "chỉ có hai tệp nguồn" mà không kèm extra_inputs; danh mục thật có đúng hai mục extra_inputs (pool_base, image_manifest) khớp câu mới.
Chạy: python3 -I eval/T-150/check_4_cau_chu_spec.py   Thoát 0 = PASS, 1 = FAIL.  Repo tohong: TOHONG_REPO hoặc ../tohong (chỉ để đọc danh mục)."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
spec = open(os.path.join(HQ, "products", "T-147-drawer-vendor-enrich.md"), encoding="utf-8").read()
bad = []

# phép tính độc lập
first = next(v for v in range(300, 2000) if max(min(560, v), 0.9 * v) > min(560, v))
if first != 623:
    bad.append("phép tính ngưỡng tay cầm ra %d, không phải 623 (đo sai?)" % first)
line = next((l for l in spec.splitlines() if "Kéo giãn" in l and "tay cầm" in l), "")
if not line:
    bad.append("không thấy dòng Kéo giãn trong spec")
if re.search(r"tức khung nhìn\s*>\s*560\s*px", line):
    bad.append("còn câu cũ: tay cầm hiện khi 'khung nhìn > 560px'")
if "623px" not in line:
    bad.append("dòng Kéo giãn không ghi ngưỡng 623px của tay cầm")
if "561–622px" not in spec:
    bad.append("mục khung hẹp chưa ghi khoảng 561–622px (min = max, không có tay cầm)")

if re.search(r"chỉ có hai tệp nguồn\.", spec):
    bad.append("còn câu cũ: 'chỉ có hai tệp nguồn.'")
if not re.search(r"hai tệp nguồn\*\*[^\n]{0,200}extra_inputs", spec):
    bad.append("câu về hai tệp nguồn không nhắc extra_inputs")
tohong = next((p for p in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if p and os.path.exists(os.path.join(p, "tools/scraper/pool-input-fields.json"))), None)
if not tohong:
    print("FAIL không thấy repo tohong (đặt TOHONG_REPO)"); sys.exit(2)
cat = json.load(open(os.path.join(tohong, "tools/scraper/pool-input-fields.json"), encoding="utf-8"))
ids = sorted(x.get("id") for x in cat.get("extra_inputs", []))
if ids != ["image_manifest", "pool_base"]:
    bad.append("danh mục thật có extra_inputs %s, không phải [image_manifest, pool_base]" % ids)
files = sorted({f["file"] for f in cat["fields"] if f["file"] in ("vendors.json", "enrichment-audit.json")})
if files != ["enrichment-audit.json", "vendors.json"]:
    bad.append("danh mục thật dùng tệp nguồn %s" % files)
print("PASS" if not bad else "FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else ""))
sys.exit(0 if not bad else 1)
