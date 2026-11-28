"""T-232 tiêu chí 8: hành vi pool của T-231 giữ nguyên: sau bước 6, vendor address_mismatch và wrong_category VẪN trong pool (không ẩn),
vendor not_found vắng pool; và eval đối kháng T-231 adv-01 (giá trị lạ không lỗi, không loại) vẫn đạt trên cùng repo."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import os, subprocess, sys
from lib232 import build, single_ids, flag, Fail, run


def main():
    st = {}

    def prep(fx):
        pool = fx.pool()
        ids = [i for i in single_ids(fx, "invitation", 40) if i in pool][:4]
        if len(ids) < 4:
            raise Fail("không đủ vendor invitation trong pool")
        st["ids"] = ids
        for vid, val in zip(ids, ["address_mismatch", "wrong_category", "found", "not_found"]):
            flag(fx, "invitation", vid, val)
    fx = build(prep)
    try:
        fx.regen()
        pool = fx.pool()
        a, w, f, n = st["ids"]
        miss = [x for x in (a, w, f) if x not in pool]
        if miss or n in pool:
            raise Fail(f"pool sai: vắng {miss} (cần có), not_found {n} {'còn' if n in pool else 'vắng'}")
    finally:
        fx.close()
    here = os.path.dirname(os.path.abspath(__file__))
    adv = os.path.join(os.path.dirname(here), "T-231", "adv-01-gia-tri-la-nhieu-ban-ghi-drawer.py")
    p = subprocess.run([sys.executable, "-I", adv], capture_output=True, text=True, timeout=900)
    if p.returncode != 0:
        raise Fail("T-231 adv-01 đỏ: " + (p.stdout.strip().splitlines() or ["?"])[-1][:300])
    return "address_mismatch/wrong_category/found trong pool, not_found vắng; T-231 adv-01 đạt"


run(main)
