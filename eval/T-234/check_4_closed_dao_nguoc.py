"""T-234 tiêu chí 4: đảo ngược: vendor đang vắng pool vì "closed", đổi thành "found" hoặc xoá khoá rồi chạy lại bước 6 thì quay lại pool với cùng id, tên, hạng mục."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib234 import build, single_ids, set_val, Fail, run
from lib230 import MISSING


def main():
    done = []
    for label, back in (("found", "found"), ("xoá khoá", MISSING)):
        fx = build()
        try:
            pool0 = fx.pool()
            vid = [i for i in single_ids(fx, "invitation", 40) if i in pool0][0]
            fx.regen(); p0 = fx.pool()
            set_val(fx, vid, "invitation", "closed"); fx.regen()
            if vid in fx.pool():
                raise Fail(f"{vid} closed chưa vắng pool: không thử được đảo ngược")
            if back is MISSING:
                from lib234 import edit, rec
                edit(fx, "invitation", lambda vs: rec(vs, vid).pop("ai_mode_result"))
            else:
                set_val(fx, vid, "invitation", back)
            fx.regen(); p2 = fx.pool()
            if vid not in p2 or any(p2[vid].get(k) != p0[vid].get(k) for k in ("id", "name", "category")):
                raise Fail(f"{label}: {vid} không quay lại đúng")
            done.append(label)
        finally:
            fx.close()
    return "quay lại pool khi " + ", ".join(done)


run(main)
