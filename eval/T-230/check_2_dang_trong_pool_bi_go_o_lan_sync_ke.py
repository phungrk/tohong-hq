"""T-230 tiêu chí 2: vendor ĐANG trong pool, sau khi nguồn mang ai_mode_result "not_found", bị gỡ khỏi pool ở lần chạy bước 6 kế tiếp;
mọi vendor khác giữ nguyên từng byte so với lần chạy bước 6 không có cờ (không ảnh hưởng ngoài vendor bị gỡ)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json
from lib230 import build, picks, set_field, Fail, run


def main():
    fx = build()
    try:
        (s, _, _), _m = picks(fx)
        fx.regen()
        p0 = fx.pool()
        if s not in p0:
            raise Fail(f"{s} không có trong pool trước khi đặt cờ: phép thử không hợp lệ")
        set_field(fx, s, "not_found")
        fx.regen()
        p1 = fx.pool()
        if s in p1:
            raise Fail(f"{s} mang not_found vẫn còn trong pool sau lần sync kế tiếp")
        diff = [i for i in set(p0) | set(p1) if i != s and json.dumps(p0.get(i), sort_keys=True) != json.dumps(p1.get(i), sort_keys=True)]
        if diff:
            raise Fail(f"{len(diff)} vendor khác bị đổi theo, vd {sorted(diff)[:3]}")
        return f"{s} bị gỡ; {len(p1)} vendor còn lại không đổi"
    finally:
        fx.close()


run(main)
