"""T-234 tiêu chí 1: tools/scraper/schema.py có ĐÚNG MỘT dòng khai báo `ai_mode_result:` và dòng đó (bỏ khoảng trắng đầu/cuối) giống hệt dòng của 6 nhánh
PR dữ liệu (BRANCH_LINE); Vendor.model_validate nhận 5 giá trị, null và vắng khoá (giữ đúng giá trị), và vẫn từ chối giá trị lạ (kể cả biến thể của closed)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json, os, sys
from lib234 import build, Fail, run, VALID5, BRANCH_LINE

ODD = ["Closed", "closed ", "CLOSED", "permanently_closed", "", ["closed"], 0]


def main():
    fx = build()
    try:
        sc = os.path.join(fx.tohong, "tools", "scraper")
        decl = [l.strip() for l in open(os.path.join(sc, "schema.py"), encoding="utf-8") if l.strip().startswith("ai_mode_result:")]
        if decl != [BRANCH_LINE]:
            raise Fail(f"schema.py khai báo {decl}, cần đúng một dòng {BRANCH_LINE!r}")
        sys.path.insert(0, sc)
        from schema import Vendor
        base = json.load(open(fx.source_files()[0], encoding="utf-8"))
        base = {k: v for k, v in (base["vendors"] if isinstance(base, dict) else base)[0].items() if k != "ai_mode_result"}
        if Vendor.model_validate(base).ai_mode_result is not None:
            raise Fail("vắng khoá không đọc ra None")
        for val in VALID5 + [None]:
            if Vendor.model_validate(dict(base, ai_mode_result=val)).ai_mode_result != val:
                raise Fail(f"{val!r} đọc ra sai")
        acc = []
        for val in ODD:
            try:
                Vendor.model_validate(dict(base, ai_mode_result=val)); acc.append(repr(val))
            except Exception:  # noqa: BLE001
                pass
        if acc:
            raise Fail("schema nhận giá trị lạ: " + ", ".join(acc))
        return "schema đúng dòng của nhánh; nhận 5 giá trị + null/vắng, từ chối biến thể lạ"
    finally:
        fx.close()


run(main)
