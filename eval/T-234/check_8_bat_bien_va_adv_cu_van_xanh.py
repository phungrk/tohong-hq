"""T-234 tiêu chí 8: hành vi cũ giữ nguyên trên cùng repo: bất biến planner/vendor/pool/inv-010 (not_found vắng pool, nguồn nguyên) và eval đối kháng
T-231 adv-01 (giá trị lạ không lỗi, không loại; drawer not_found) vẫn đạt."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import glob, os, subprocess, sys
from lib234 import Fail, run

here = os.path.dirname(os.path.abspath(__file__)); ev = os.path.dirname(here)


def main():
    targets = glob.glob(os.path.join(ev, "invariants/planner/vendor/pool/inv-010-*.py")) + [os.path.join(ev, "T-231/adv-01-gia-tri-la-nhieu-ban-ghi-drawer.py")]
    for t in targets:
        p = subprocess.run([sys.executable, "-I", t], capture_output=True, text=True, timeout=900)
        if p.returncode != 0:
            raise Fail(os.path.basename(t) + " đỏ: " + (p.stdout.strip().splitlines() or ["?"])[-1][:250])
    return "pool/inv-010 và T-231 adv-01 đạt"


run(main)
