"""T-232 tiêu chí 2: vendor nhiều bản ghi lấy một giá trị theo thứ tự ưu tiên not_found > wrong_category > address_mismatch > found; giá trị lạ bị bỏ qua
(như vắng); cả hai bản ghi lạ hoặc vắng thì null. Thứ tự bản ghi không ảnh hưởng."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib232 import build, multi_ids, edit, rec, report, Fail, run

CASES = [(("wrong_category", "address_mismatch"), "wrong_category"), (("address_mismatch", "wrong_category"), "wrong_category"),
         (("address_mismatch", "found"), "address_mismatch"), (("found", "wrong_category"), "wrong_category"),
         (("wrong_category", "not_found"), "not_found"), (("bogus", "address_mismatch"), "address_mismatch"),
         (("Wrong_Category", "found"), "found"), (("bogus", None), None)]


def main():
    st = {}

    def prep(fx):
        ms = multi_ids(fx, len(CASES))
        st["ms"] = ms
        for (vid, cats), (vals, _) in zip(ms, CASES):
            for cat, val in zip(cats, vals):
                edit(fx, cat, lambda vs, vid=vid, val=val: rec(vs, vid).__setitem__("ai_mode_result", val))
    fx = build(prep)
    try:
        _, r = report(fx)
        rows = {x["id"]: x for x in r["vendors"]}
        bad = []
        for (vid, _), (vals, exp) in zip(st["ms"], CASES):
            got = rows.get(vid, {}).get("ai_mode_result", "<thiếu>")
            if got != exp:
                bad.append(f"{vals} -> {got!r}, cần {exp!r}")
        if bad:
            raise Fail("; ".join(bad))
        return f"{len(CASES)} tổ hợp gộp đúng thứ tự ưu tiên"
    finally:
        fx.close()


run(main)
