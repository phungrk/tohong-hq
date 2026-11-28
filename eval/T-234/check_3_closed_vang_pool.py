"""T-234 tiêu chí 3: sau bước 6 (regen), vendor có ÍT NHẤT MỘT bản ghi mang đúng chuỗi "closed" vắng pool, như "not_found":
vendor một bản ghi; vendor nhiều bản ghi (một closed, một found); vendor nhiều bản ghi (một closed, một not_found); vendor mới chưa có trong pool nền
không được thêm vào. Biến thể "Closed", "closed ", "CLOSED" không loại. Vendor đối chứng found còn trong pool. Nguồn không đổi (cây sạch)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib234 import build, single_ids, multi_ids, set_val, Fail, run
from lib230 import drop_from_base_pool


def main():
    st = {}

    def prep(fx):
        pool = fx.pool()
        s = [i for i in single_ids(fx, "invitation", 60) if i in pool][:6]
        (m1, c1), (m2, c2) = [x for x in multi_ids(fx, 20) if x[0] in pool][:2]
        st.update(s=s, m1=m1, m2=m2)
        set_val(fx, s[0], "invitation", "closed")
        for i, v in zip(s[1:4], ["Closed", "closed ", "CLOSED"]):
            set_val(fx, i, "invitation", v)
        set_val(fx, s[4], "invitation", "found")
        set_val(fx, s[5], "invitation", "closed"); drop_from_base_pool(fx, [s[5]])
        set_val(fx, m1, c1[0], "closed"); set_val(fx, m1, c1[1], "found")
        set_val(fx, m2, c2[0], "not_found"); set_val(fx, m2, c2[1], "closed")
    fx = build(prep)
    try:
        fx.regen()
        pool = fx.pool(); s = st["s"]
        gone = [s[0], s[5], st["m1"], st["m2"]]; stay = s[1:5]
        e1 = [i for i in gone if i in pool]; e2 = [i for i in stay if i not in pool]
        if e1 or e2:
            raise Fail(f"còn trong pool (cần vắng): {e1}; vắng (cần còn): {e2}")
        if fx.git_status():
            raise Fail("bước 6 làm bẩn nguồn: " + "; ".join(fx.git_status()[:3]))
        return "closed (đơn, nhiều bản ghi, mới) vắng pool; biến thể và found còn; nguồn sạch"
    finally:
        fx.close()


run(main)
