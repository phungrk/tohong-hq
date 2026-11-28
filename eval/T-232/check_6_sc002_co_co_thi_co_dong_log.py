"""T-232 tiêu chí 6 (SC-002 + từ chối giá trị lạ ở cổng dữ liệu): `python3 ai_mode_flags.py check` (tools/scraper) báo mỗi vi phạm một dòng
`AI_MODE_FLAG_VIOLATION <luật> <hạng mục> <id> ...` và thoát 1; không vi phạm thì thoát 0.
- no_log: bản ghi có cờ (một trong 4 giá trị) mà dòng enrichment_log source google_ai_mode CUỐI có khoá changes.ai_mode_result không mang cùng giá trị (hoặc không có dòng nào).
- invalid_value: bản ghi có khoá ai_mode_result khác null và ngoài 4 giá trị.
- Miễn trừ: tools/scraper/ai_mode_flags_exempt.json {"exempt": [{"category", "id", "rule", "reason"}]} miễn đúng luật đó cho đúng bản ghi đó (reason không rỗng);
  in dòng AI_MODE_FLAG_EXEMPT, không tính vi phạm. Mục miễn thiếu reason thì không có tác dụng."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json, os
from lib232 import build, single_ids, flag, edit, rec, ai_log, tool, violations, Fail, run


def main():
    st = {}

    def prep(fx):
        a, b, c, d, e, f, g = single_ids(fx, "invitation", 7)
        st.update(a=a, b=b, c=c, d=d, e=e, f=f, g=g)
        flag(fx, "invitation", a, "not_found")                                     # có log khớp: đạt
        flag(fx, "invitation", e, "address_mismatch", log=False)                    # miễn trừ hợp lệ
        flag(fx, "invitation", g, "wrong_category", log=False)                      # miễn trừ thiếu reason: vẫn vi phạm
        def two(vs):                                                                # log cũ found, log mới wrong_category, cờ wrong_category: đạt
            v = rec(vs, f); v["ai_mode_result"] = "wrong_category"
            v.setdefault("enrichment_log", []).extend([ai_log("found"), ai_log(None, verification_notes="x"), ai_log("wrong_category")])
        edit(fx, "invitation", two)
        ex = {"exempt": [{"category": "invitation", "id": e, "rule": "no_log", "reason": "gắn cờ bù từ verification_notes (thử)"},
                         {"category": "invitation", "id": g, "rule": "no_log", "reason": ""}]}
        json.dump(ex, open(os.path.join(fx.tohong, "tools/scraper/ai_mode_flags_exempt.json"), "w"), ensure_ascii=False)
    fx = build(prep)
    try:
        code, out, err = tool(fx, "check", "--state", "HCMC", "--output-dir", "output")
        v = set(violations(out))
        if v != {("no_log", "invitation", st["g"])} or code != 1:
            raise Fail(f"bước 1 (chỉ g vi phạm): thoát {code}, vi phạm {sorted(v)}; {err[-150:]}")
        if not any(l.startswith("AI_MODE_FLAG_EXEMPT") and st["e"] in l for l in out.splitlines()):
            raise Fail("không in dòng AI_MODE_FLAG_EXEMPT cho bản ghi được miễn")
        flag(fx, "invitation", st["b"], "found", log=False)                         # không log
        flag(fx, "invitation", st["c"], "not_found", log_value="found")             # log khác giá trị
        flag(fx, "invitation", st["d"], "Not_Found")                                # giá trị lạ
        edit(fx, "invitation", lambda vs: rec(vs, st["g"]).__setitem__("ai_mode_result", None))  # bỏ cờ g: hết vi phạm
        code, out, _ = tool(fx, "check", "--state", "HCMC", "--output-dir", "output")
        v = set(violations(out))
        exp = {("no_log", "invitation", st["b"]), ("no_log", "invitation", st["c"]), ("invalid_value", "invitation", st["d"])}
        if v != exp or code != 1:
            raise Fail(f"bước 2: thoát {code}, vi phạm {sorted(v)}, cần {sorted(exp)}")
        for k in ("b", "c", "d"):
            edit(fx, "invitation", lambda vs, k=k: rec(vs, st[k]).pop("ai_mode_result"))
        code, out, _ = tool(fx, "check", "--state", "HCMC", "--output-dir", "output")
        if code != 0 or violations(out):
            raise Fail(f"bước 3 (hết vi phạm): thoát {code}, {violations(out)}")
        return "no_log, invalid_value, miễn trừ có lý do đúng; sạch thì thoát 0"
    finally:
        fx.close()


run(main)
