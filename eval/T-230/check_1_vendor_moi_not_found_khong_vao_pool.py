"""T-230 tiêu chí 1: vendor có trong nguồn nhưng chưa có trong pool, mang ai_mode_result "not_found", KHÔNG được thêm vào pool ở bước 6;
vendor đối chứng cùng tình huống nhưng không mang cờ thì được thêm vào (đường thêm lại của --prune vẫn chạy)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib230 import build, picks, set_field, drop_from_base_pool, Fail, run


def main():
    st = {}

    def prep(fx):
        (s, c, _), _m = picks(fx)
        st.update(s=s, c=c)
        drop_from_base_pool(fx, [s, c])
        set_field(fx, s, "not_found")
    fx = build(prep)
    try:
        fx.regen()
        pool = fx.pool()
        if st["c"] not in pool:
            raise Fail(f"đối chứng {st['c']} (không cờ) không được thêm lại vào pool: phép thử không hợp lệ")
        if st["s"] in pool:
            raise Fail(f"{st['s']} mang ai_mode_result=not_found vẫn được thêm vào pool")
        return f"{st['s']} (not_found) không vào pool; đối chứng {st['c']} vào pool"
    finally:
        fx.close()


run(main)
