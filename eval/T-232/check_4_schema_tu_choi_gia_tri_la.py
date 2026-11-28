"""T-232 tiêu chí 4 (FR-005): đọc dữ liệu bằng schema (tools/scraper/schema.py, Vendor.model_validate) nhận 4 giá trị, null và vắng khoá (giữ đúng giá trị
trên đối tượng đọc ra), và TỪ CHỐI (ném lỗi kiểm tra) mọi giá trị khác. Dùng một bản ghi thật của dữ liệu."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json, os, sys
from lib232 import build, Fail, run, VALID

ODD = ["NOT_FOUND", "closed", "", " found", ["found"], 0, True]


def main():
    fx = build()
    try:
        sc = os.path.join(fx.tohong, "tools", "scraper")
        sys.path.insert(0, sc)
        from schema import Vendor
        base = json.load(open(fx.source_files()[0], encoding="utf-8"))
        base = (base["vendors"] if isinstance(base, dict) else base)[0]
        base = {k: v for k, v in base.items() if k != "ai_mode_result"}
        m = Vendor.model_validate(base)
        if getattr(m, "ai_mode_result", "<thiếu thuộc tính>") is not None:
            raise Fail(f"vắng khoá: ai_mode_result = {getattr(m, 'ai_mode_result', '<thiếu thuộc tính>')!r}, cần None")
        for val in VALID + [None]:
            m = Vendor.model_validate(dict(base, ai_mode_result=val))
            if getattr(m, "ai_mode_result", "<thiếu>") != val:
                raise Fail(f"{val!r} đọc ra {getattr(m, 'ai_mode_result', '<thiếu thuộc tính>')!r}")
        accepted = []
        for val in ODD:
            try:
                Vendor.model_validate(dict(base, ai_mode_result=val))
                accepted.append(repr(val))
            except Exception:  # noqa: BLE001 — lỗi kiểm tra của schema là hành vi mong đợi
                pass
        if accepted:
            raise Fail("schema nhận giá trị lạ: " + ", ".join(accepted))
        return f"nhận {len(VALID)} giá trị + null/vắng, từ chối {len(ODD)} giá trị lạ"
    finally:
        fx.close()


run(main)
