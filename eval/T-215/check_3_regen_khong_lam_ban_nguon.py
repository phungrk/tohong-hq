#!/usr/bin/env python3
"""T-215 tiêu chí 3: chạy regen-pool-styles.sh KHÔNG làm bẩn cây git của tohong (git status --porcelain rỗng sau regen, KHÔNG tính thư mục back (mặc định `edge`, submodule: ghi pool vào đó là việc đúng của regen); file ignore như output/pool-vendors.json không tính).
Bản sao tạm của tohong được commit nền trước khi chạy. Lý do: bước 'Kiểm báo cáo tươi' của sync-vendor-pool.yml sinh báo cáo từ dữ liệu SAU regen. Chạy: python3 -I <file>."""
import os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

def run():
    fx = R.build(back_rel="edge")   # back nằm trong cây như cấu hình thật (submodule edge); thư mục back bị loại khỏi phép kiểm
    try:
        fx.regen()
        st = fx.git_status()
        if st:
            raise R.Fail("regen làm bẩn cây tohong (%d file), vd: %s" % (len(st), "; ".join(st[:3])))
        return "cây git của tohong sạch sau regen"
    finally:
        fx.close()
R.main_guard(run)
