#!/usr/bin/env python3
"""Eval T-027 tiêu chí 8: ảnh chụp đã được COMMIT vào repo front, thư mục docs/screenshots/T-027/.
Chạy: python3 eval/T-027/check_8_shots.py --repo /đường/dẫn/tohong-front [--ref HEAD]
Đạt khi, ở commit --ref, thư mục có file PNG (devicePixelRatio 1, đúng chiều rộng điểm ảnh) gồm:
  rộng 390: install-android-390.png, install-ios-390.png, budget-subpage-390.png (tên chứa install-android, install-ios, budget-subpage)
  rộng 1280: ít nhất một PNG
Tạo bằng: node eval/T-027/check_t027.cjs --repo . --only 6 --shots docs/screenshots/T-027 (hoặc không --only để chụp đủ).
Không đọc file chưa commit."""
import argparse, struct, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True)
ap.add_argument('--ref', default='HEAD')
a = ap.parse_args()
d = 'docs/screenshots/T-027'
r = subprocess.run(['git', '-C', a.repo, 'ls-tree', '--name-only', a.ref, d + '/'], capture_output=True, text=True)
files = [f for f in r.stdout.split('\n') if f.lower().endswith('.png')]
info = {}
for f in files:
    b = subprocess.run(['git', '-C', a.repo, 'show', f'{a.ref}:{f}'], capture_output=True).stdout
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        info[f] = struct.unpack('>I', b[16:20])[0]
miss = []
for stem in ('install-android', 'install-ios', 'budget-subpage'):
    if not any(stem in f and w == 390 for f, w in info.items()):
        miss.append(f'PNG rộng 390 có tên chứa "{stem}"')
if not any(w == 1280 for w in info.values()):
    miss.append('PNG rộng 1280')
if miss:
    print(f'FAIL thiếu trong {d}/ ở {a.ref}: ' + '; '.join(miss) + f' (tìm thấy {len(files)} file PNG đã commit)'); sys.exit(1)
print('PASS'); sys.exit(0)
