#!/usr/bin/env python3
"""T-221 tiêu chí 1 (offline), phần "mọi eval T-219/T-220 vẫn xanh": chạy lại nguyên từng eval tầng 1 của T-219 (check_*.py / check_*.sh) và từng eval đối kháng của T-220 (adv-*.py),
mỗi cái phải in PASS và thoát 0 (với cùng TOHONG_REPO). Không sửa, không bỏ qua eval nào. Dạng này là wrapper vì tiêu chí đòi chính các eval cũ xanh, không viết lại chúng."""
import glob, os, subprocess, sys
sys.dont_write_bytecode = True
H = os.path.dirname(os.path.abspath(__file__))
paths = sorted(glob.glob(os.path.join(H, "..", "T-219", "check_*.py")) + glob.glob(os.path.join(H, "..", "T-219", "check_*.sh")) + glob.glob(os.path.join(H, "..", "T-220", "adv-*.py")))
if len(paths) < 24:
    print("FAIL tìm thấy %d eval T-219/T-220, kỳ vọng >= 24 (thiếu file?)" % len(paths))
    sys.exit(1)
bad = []
for p in paths:
    cmd = ["bash", p] if p.endswith(".sh") else [sys.executable, p]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
    except subprocess.TimeoutExpired:
        bad.append("%s: quá giờ" % os.path.basename(p))
        continue
    last = ((r.stdout or "").strip().splitlines() or [""])[-1]
    if r.returncode != 0 or not last.startswith("PASS"):
        bad.append("%s: %s" % (os.path.basename(p), last[:140] or (r.stderr or "")[-140:]))
if bad:
    print("FAIL %d/%d eval cũ đỏ: %s" % (len(bad), len(paths), " | ".join(bad[:4])))
    sys.exit(1)
print("PASS %d eval T-219/T-220 vẫn xanh" % len(paths))
