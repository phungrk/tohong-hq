#!/usr/bin/env python3
"""Bất biến chờ merge (vùng planner, workflow của repo tohong) · nguồn: T-134 adv-04 (adversary, 2026-11-12).
INV-??? · Trong `.github/workflows/*.yml` của tohong, mọi bước `run:` có dòng chạy một chương trình của repo (python/python3/node/bash/sh/npm/npx)
  rồi đẩy đầu ra qua ống `|` (vd `python apply.py … | tee log`) phải chạy dưới pipefail: `shell: bash` khai ở bước, ở `jobs.<id>.defaults.run`
  hoặc `defaults.run` của workflow (GitHub khi đó chạy `bash --noprofile --norc -eo pipefail {0}`), hoặc thân bước có `set -o pipefail` / `set -eo pipefail`.
Lý do: không khai `shell`, GitHub trên Linux chạy `bash -e {0}` KHÔNG pipefail → mã lỗi của chương trình bị lệnh cuối của ống (tee) nuốt, job xanh
  dù bước đã từ chối (T-134: apply_admin_reviews.py từ chối chữ ký → bước xanh → PR dữ liệu bị đóng thay vì job đỏ). Tiền lệ repo:
  enrich-vendors.yml / enrich-venue.yml đều khai `shell: bash`.
Tĩnh, không mạng. Repo: TOHONG_REPO hoặc ../tohong. Chạy: python3 -I <file>. 0 = đạt, 1 = vi phạm.
"""
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def hq_root(d):
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        d = os.path.dirname(d)


HQ = hq_root(HERE) or os.getcwd()
TOHONG = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
               if p and os.path.isdir(os.path.join(p, ".github", "workflows"))), None)
if not TOHONG:
    print("FAIL không thấy repo tohong"); sys.exit(1)
import yaml  # noqa: E402

PROG = re.compile(r"^\s*(?:[A-Z_][A-Z0-9_]*=\S*\s+)*(?:python3?|node|bash|sh|npm|npx)\b[^|]*(?<!\|)\|(?!\|)")
bad = []
for f in sorted(glob.glob(os.path.join(TOHONG, ".github", "workflows", "*.y*ml"))):
    d = yaml.safe_load(open(f, encoding="utf-8")) or {}
    wsh = ((d.get("defaults") or {}).get("run") or {}).get("shell")
    for jn, j in (d.get("jobs") or {}).items():
        jsh = ((j.get("defaults") or {}).get("run") or {}).get("shell")
        for i, s in enumerate(j.get("steps") or []):
            r = s.get("run")
            if not isinstance(r, str):
                continue
            sh = s.get("shell") or jsh or wsh
            if sh == "bash" or re.search(r"set -[a-z]*o pipefail|set -o pipefail", r):
                continue
            for line in r.splitlines():
                if PROG.search(line):
                    bad.append(f"{os.path.basename(f)} job {jn} bước {i} ({s.get('name') or '-'}): shell={sh!r} không pipefail: {line.strip()[:120]}")
if bad:
    for b in bad:
        print("FAIL " + b)
    sys.exit(1)
print("PASS mọi bước có ống sau chương trình của repo đều chạy dưới pipefail")
