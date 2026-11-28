"""T-232 tiêu chí 1: báo cáo enrich giữ nguyên giá trị cờ của vendor một bản ghi cho cả 4 giá trị (found, not_found, address_mismatch,
wrong_category); vendor không cờ là null; giá trị lạ (ngoài 4 giá trị, kể cả viết hoa/khoảng trắng/khác kiểu) là null và báo cáo vẫn sinh được."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib232 import build, single_ids, flag, report, VALID, Fail, run

ODD = ["NOT_FOUND", "closed", " wrong_category", ["found"], 0]


def main():
    st = {}

    def prep(fx):
        ids = single_ids(fx, "invitation", len(VALID) + len(ODD) + 1)
        st["ids"] = ids
        for vid, val in zip(ids, VALID + ODD):
            flag(fx, "invitation", vid, val)
    fx = build(prep)
    try:
        _, r = report(fx)
        rows = {x["id"]: x for x in r["vendors"]}
        ids = st["ids"]
        exp = VALID + [None] * len(ODD) + [None]
        bad = [f"{vid}: {rows.get(vid, {}).get('ai_mode_result', '<thiếu>')!r} cần {e!r}" for vid, e in zip(ids, exp) if vid not in rows or rows[vid].get("ai_mode_result", "<thiếu>") != e]
        if bad:
            raise Fail("; ".join(bad))
        return "4 giá trị giữ nguyên, giá trị lạ và vắng là null"
    finally:
        fx.close()


run(main)
