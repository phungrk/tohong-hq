"""T-230 tiêu chí 4: đảo ngược bằng sửa nguồn rồi chạy lại bước 6. Đổi cờ thành "found", hoặc xoá khoá, thì vendor quay lại pool
với cùng id, tên, hạng mục như trước khi bị gỡ."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib230 import build, picks, set_field, MISSING, Fail, run


def main():
    out = []
    for label, back_to in (("đổi thành found", "found"), ("xoá khoá", MISSING)):
        fx = build()
        try:
            (s, _, _), _m = picks(fx)
            fx.regen()
            p0 = fx.pool()
            set_field(fx, s, "not_found")
            fx.regen()
            if s in fx.pool():
                raise Fail(f"{s} chưa bị gỡ khi mang not_found: không thử được đảo ngược")
            set_field(fx, s, back_to)
            fx.regen()
            p2 = fx.pool()
            if s not in p2:
                raise Fail(f"{label}: {s} không quay lại pool")
            for k in ("id", "name", "category"):
                if p2[s].get(k) != p0[s].get(k):
                    raise Fail(f"{label}: {s}.{k} khác trước khi gỡ ({p0[s].get(k)!r} -> {p2[s].get(k)!r})")
            out.append(label)
        finally:
            fx.close()
    return "quay lại pool khi " + ", ".join(out)


run(main)
