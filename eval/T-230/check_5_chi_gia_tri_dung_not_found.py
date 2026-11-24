"""T-230 tiêu chí 5: chỉ khoá cấp vendor `ai_mode_result` bằng đúng chuỗi "not_found" mới loại vendor. Các giá trị khác ("found", null,
"NOT_FOUND", "not found", " not_found", true) và cờ chỉ nằm trong một dòng enrichment_log (không có khoá cấp vendor) đều không loại."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib230 import build, set_field, counts, Fail, run

CASES = [("found", False), (None, False), ("NOT_FOUND", False), ("not found", False), (" not_found", False), (True, False), ("not_found", True)]


def main():
    st = {}

    def prep(fx):
        pool, c = fx.pool(), counts(fx)
        ids = sorted(i for i in pool if c.get(i) == 1)[: len(CASES) + 1]
        st["ids"] = ids
        for (val, log_only), vid in zip(CASES, ids):
            set_field(fx, vid, val if not log_only else "not_found", log_only=log_only)
        set_field(fx, ids[-1], "not_found")  # đối chứng: phải bị loại
    fx = build(prep)
    try:
        fx.regen()
        pool = fx.pool()
        ids = st["ids"]
        if ids[-1] in pool:
            raise Fail(f"đối chứng {ids[-1]} mang \"not_found\" vẫn trong pool")
        bad = [f"{CASES[k][0]!r}{' (chỉ trong log)' if CASES[k][1] else ''} -> {vid}" for k, vid in enumerate(ids[:-1]) if vid not in pool]
        if bad:
            raise Fail("giá trị không phải \"not_found\" cấp vendor vẫn loại vendor: " + "; ".join(bad))
        return f"{len(CASES)} giá trị khác giữ vendor trong pool; \"not_found\" loại vendor"
    finally:
        fx.close()


run(main)
