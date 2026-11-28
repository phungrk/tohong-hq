"""T-232 tiêu chí 7 (SC-004, FR-004, US3): `python3 ai_mode_flags.py check [--base <git ref>]`.
- verified_not_found: bản ghi verification_status "verified" mà cờ là not_found, address_mismatch hoặc wrong_category (US3: verified qua AI Mode thì cờ là found).
- status_changed (chỉ khi có --base): so với bản ghi cùng hạng mục, cùng id ở ref nền, cờ đổi VÀ verification_status đổi, mà dòng enrichment_log google_ai_mode
  cuối có khoá changes.verification_status không mang đúng trạng thái mới (đổi trạng thái không được ghi là quyết định riêng).
  Chỉ thêm cờ (trạng thái giữ nguyên) không vi phạm; đổi trạng thái có ghi trong dòng log thì không vi phạm."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib232 import build, single_ids, flag, edit, rec, ai_log, tool, violations, commit, Fail, run


def main():
    st = {}

    def prep(fx):
        ids = single_ids(fx, "invitation", 6)
        st["ids"] = ids
        for vid in ids:
            edit(fx, "invitation", lambda vs, vid=vid: rec(vs, vid).__setitem__("verification_status", "auto_scraped"))
    fx = build(prep)
    try:
        a, b, c, d, e, f = st["ids"]
        flag(fx, "invitation", a, "found", verification_status="verified")         # verified + found, nhưng KHÔNG log trạng thái: status_changed
        flag(fx, "invitation", b, "not_found")                                     # chỉ thêm cờ: đạt
        def logged(vs):                                                            # đổi trạng thái có ghi log: đạt
            v = rec(vs, c); v["ai_mode_result"] = "found"; v["verification_status"] = "verified"
            v.setdefault("enrichment_log", []).append(ai_log("found", verification_status="verified"))
        edit(fx, "invitation", logged)
        flag(fx, "invitation", d, "wrong_category", verification_status="verified")  # verified + wrong_category: hai vi phạm
        code, out, _ = tool(fx, "check", "--state", "HCMC", "--output-dir", "output", "--base", "HEAD")
        v = set(violations(out))
        exp = {("status_changed", "invitation", a), ("status_changed", "invitation", d), ("verified_not_found", "invitation", d)}
        if v != exp or code != 1:
            raise Fail(f"có --base: thoát {code}, vi phạm {sorted(v)}, cần {sorted(exp)}")
        code, out, _ = tool(fx, "check", "--state", "HCMC", "--output-dir", "output")
        v = set(violations(out))
        if v != {("verified_not_found", "invitation", d)}:
            raise Fail(f"không --base: vi phạm {sorted(v)}, cần chỉ verified_not_found {d}")
        commit(fx)
        flag(fx, "invitation", e, "address_mismatch")                                # nền mới: thêm cờ thôi
        code, out, _ = tool(fx, "check", "--state", "HCMC", "--output-dir", "output", "--base", "HEAD")
        if ("status_changed", "invitation", e) in set(violations(out)):
            raise Fail("chỉ thêm cờ mà bị báo status_changed")
        return "verified_not_found và status_changed đúng; thêm cờ đơn thuần không vi phạm"
    finally:
        fx.close()


run(main)
