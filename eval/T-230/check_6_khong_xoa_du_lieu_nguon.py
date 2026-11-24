"""T-230 tiêu chí 6: gỡ khỏi pool không xoá, không sửa dữ liệu nguồn: sau bước 6, cây tohong sạch (git status rỗng ngoài pool của back),
mọi bản ghi của vendor bị gỡ vẫn ở nguyên vendors.json với cờ giữ nguyên."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib230 import build, picks, set_field, counts, Fail, run


def main():
    st = {}

    def prep(fx):
        (s, _, _), m = picks(fx)
        st.update(s=s, m=m, n_s=counts(fx)[s], n_m=counts(fx)[m])
        set_field(fx, s, "not_found")
        set_field(fx, m, "not_found")
    fx = build(prep)
    try:
        fx.regen()
        pool = fx.pool()
        if st["s"] in pool or st["m"] in pool:
            raise Fail("vendor mang not_found vẫn trong pool: phép thử không áp dụng")
        dirty = fx.git_status()
        if dirty:
            raise Fail("bước 6 làm bẩn cây tohong: " + "; ".join(dirty[:5]))
        for k in ("s", "m"):
            recs = [v for _, v in fx.records() if v["id"] == st[k]]
            if len(recs) != st["n_" + k] or any(v.get("ai_mode_result") != "not_found" for v in recs):
                raise Fail(f"bản ghi nguồn của {st[k]} bị xoá hoặc đổi cờ ({len(recs)}/{st['n_' + k]})")
        return "nguồn giữ nguyên, cây sạch, vendor chỉ vắng ở pool"
    finally:
        fx.close()


run(main)
