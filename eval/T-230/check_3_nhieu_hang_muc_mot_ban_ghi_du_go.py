"""T-230 tiêu chí 3: vendor có nhiều bản ghi nguồn (nhiều hạng mục) bị gỡ khỏi pool khi CHỈ MỘT bản ghi mang "not_found"; các bản ghi còn lại
không mang cờ (hoặc mang "found") không giữ vendor lại."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib230 import build, picks, set_field, Fail, run


def main():
    st = {}

    def prep(fx):
        _s, m = picks(fx)
        st["m"] = m
        set_field(fx, m, "found")
        set_field(fx, m, "not_found", only_first=True)
    fx = build(prep)
    try:
        fx.regen()
        if st["m"] in fx.pool():
            raise Fail(f"{st['m']}: một bản ghi not_found, bản ghi khác found -> vẫn trong pool")
        return f"{st['m']} (nhiều hạng mục, một bản ghi not_found) bị gỡ"
    finally:
        fx.close()


run(main)
