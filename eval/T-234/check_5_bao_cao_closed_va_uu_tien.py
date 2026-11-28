"""T-234 tiêu chí 5: báo cáo enrich giữ "closed" (một bản ghi) và gộp nhiều bản ghi theo not_found > closed > wrong_category > address_mismatch > found,
giá trị lạ bỏ qua (biến thể "Closed" là lạ). Nhóm/summary không đổi so với báo cáo không cờ."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib234 import build, single_ids, multi_ids, set_val, report, Fail, run

CASES = [(("closed", "wrong_category"), "closed"), (("wrong_category", "closed"), "closed"), (("not_found", "closed"), "not_found"),
         (("closed", "not_found"), "not_found"), (("address_mismatch", "closed"), "closed"), (("closed", "found"), "closed"),
         (("Closed", "found"), "found"), (("closed ", None), None)]


def main():
    st = {}
    fx0 = build()
    try:
        _, r0 = report(fx0)
    finally:
        fx0.close()

    def prep(fx):
        st["s"] = single_ids(fx, "invitation", 2)
        set_val(fx, st["s"][0], "invitation", "closed"); set_val(fx, st["s"][1], "invitation", "CLOSED")
        st["ms"] = multi_ids(fx, len(CASES))
        for (vid, cats), (vals, _) in zip(st["ms"], CASES):
            for c, v in zip(cats, vals):
                set_val(fx, vid, c, v)
    fx = build(prep)
    try:
        _, r = report(fx)
        rows = {x["id"]: x for x in r["vendors"]}
        bad = []
        for vid, exp in zip(st["s"], ["closed", None]):
            if rows.get(vid, {}).get("ai_mode_result", "<thiếu>") != exp:
                bad.append(f"{vid} -> {rows.get(vid, {}).get('ai_mode_result', '<thiếu>')!r} cần {exp!r}")
        for (vid, _), (vals, exp) in zip(st["ms"], CASES):
            got = rows.get(vid, {}).get("ai_mode_result", "<thiếu>")
            if got != exp:
                bad.append(f"{vals} -> {got!r} cần {exp!r}")
        if bad:
            raise Fail("; ".join(bad))
        if {x["id"]: x["group"] for x in r["vendors"]} != {x["id"]: x["group"] for x in r0["vendors"]} or r["summary"] != r0["summary"]:
            raise Fail("cờ làm đổi nhóm hoặc summary")
        return "closed giữ nguyên; 8 tổ hợp gộp đúng ưu tiên; nhóm/summary không đổi"
    finally:
        fx.close()


run(main)
