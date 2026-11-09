#!/usr/bin/env python3
"""T-118: mọi bước `run:` đứng TRƯỚC bước checkout không được phụ thuộc working-directory mặc định
của job trỏ vào thư mục con của repo (thư mục đó chưa tồn tại trước checkout).
Sự cố: run 42621254239 (DRY enrich-vendors) đỏ ở bước 1 'No such file or directory'.
Chạy: python3 check.py <repo> [workflow ...]   (mặc định: mọi workflow có GOOGLE_MAPS_API_KEY hoặc concurrency google-places)"""
import sys, pathlib, yaml
repo = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
wfdir = repo / '.github/workflows'
files = [wfdir / f for f in sys.argv[2:]] or [p for p in sorted(wfdir.glob('*.y*ml'))
         if 'GOOGLE_MAPS_API_KEY' in p.read_text() or 'google-places' in p.read_text()]
bad = []
for p in files:
    wf = yaml.safe_load(p.read_text())
    for jn, job in (wf.get('jobs') or {}).items():
        dwd = (((job.get('defaults') or {}).get('run') or {}).get('working-directory')
               or ((wf.get('defaults') or {}).get('run') or {}).get('working-directory'))
        if not dwd or str(dwd).strip() in ('.', './', '${{ github.workspace }}'):
            continue
        for i, st in enumerate(job.get('steps') or []):
            if str(st.get('uses', '')).startswith('actions/checkout'):
                break
            if 'run' in st and str(st.get('working-directory', dwd)) == str(dwd):
                bad.append(f"{p.name}:{jn}: bước {i+1} '{st.get('name','')}' chạy trước checkout trong '{dwd}'")
print(f"đã kiểm {len(files)} workflow: " + ", ".join(f.name for f in files))
for b in bad: print("FAIL", b)
print("PASS" if not bad else "FAIL")
sys.exit(1 if bad else 0)
