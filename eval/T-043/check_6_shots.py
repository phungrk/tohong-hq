#!/usr/bin/env python3
"""Eval T-043 tiêu chí 6: ảnh chụp ở 390 và 1024 (dữ liệu giả) đã được commit vào repo front, thư mục docs/screenshots/T-043/.
Chạy: python3 eval/T-043/check_6_shots.py --repo /đường/dẫn/tohong-front [--ref HEAD]
Đạt khi, ở commit --ref, mỗi bề ngang 390, 1024 có ít nhất một file PNG trong thư mục đó có đúng chiều rộng điểm ảnh bằng bề ngang ấy
(chụp ở devicePixelRatio 1; check_members_ui.cjs --shots tạo ảnh đúng khuôn này). Không đọc file chưa commit."""
import argparse, struct, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True)
ap.add_argument('--ref', default='HEAD')
a = ap.parse_args()
d = 'docs/screenshots/T-043'
r = subprocess.run(['git', '-C', a.repo, 'ls-tree', '--name-only', a.ref, d + '/'], capture_output=True, text=True)
files = [f for f in r.stdout.split('\n') if f.lower().endswith('.png')]
widths = {}
for f in files:
    b = subprocess.run(['git', '-C', a.repo, 'show', f'{a.ref}:{f}'], capture_output=True).stdout
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        widths.setdefault(struct.unpack('>I', b[16:20])[0], []).append(f)
missing = [w for w in (390, 1024) if w not in widths]
if missing:
    print(f'FAIL thiếu ảnh PNG đã commit trong {d}/ cho bề ngang {missing} (tìm thấy {len(files)} file PNG ở {a.ref})'); sys.exit(1)
print('PASS'); sys.exit(0)
