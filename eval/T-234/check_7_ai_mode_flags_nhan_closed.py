"""T-234 tiêu chí 7: `ai_mode_flags.py`:
- count: mỗi hạng mục có khoá "closed" đếm đúng; "Closed" đếm vào invalid; tổng các khoá = số bản ghi.
- check: "closed" có dòng log google_ai_mode cuối cùng giá trị -> không vi phạm; "closed" không log -> no_log; "Closed" -> invalid_value;
  "closed" + verification_status "verified" -> verified_not_found (closed là giá trị báo vấn đề như not_found)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import json
from lib234 import build, single_ids, flag, set_val, tool, violations, Fail, run

KEYS = ["found", "not_found", "closed", "address_mismatch", "wrong_category", "empty", "invalid"]


def main():
    st = {}

    def prep(fx):
        a, b, c, d, e = single_ids(fx, "wedding_gift", 5)
        st.update(a=a, b=b, c=c, d=d, e=e)
        flag(fx, "wedding_gift", a, "closed")
        flag(fx, "wedding_gift", b, "closed", log=False)
        flag(fx, "wedding_gift", c, "Closed")
        flag(fx, "wedding_gift", d, "closed", verification_status="verified")
        flag(fx, "wedding_gift", e, "closed")
    fx = build(prep)
    try:
        code, out, err = tool(fx, "count", "--state", "HCMC", "--output-dir", "output")
        try:
            got = json.loads(out)["wedding_gift"]
        except (ValueError, KeyError):
            raise Fail("count không in JSON có wedding_gift: " + (out or err)[:200])
        if got.get("closed") != 4 or got.get("invalid") != 1 or sorted(got) != sorted(KEYS):
            raise Fail(f"count wedding_gift = {got}, cần closed=4, invalid=1, khoá {KEYS}")
        code, out, _ = tool(fx, "check", "--state", "HCMC", "--output-dir", "output")
        v = set(violations(out))
        exp = {("no_log", "wedding_gift", st["b"]), ("invalid_value", "wedding_gift", st["c"]), ("verified_not_found", "wedding_gift", st["d"])}
        if v != exp or code != 1:
            raise Fail(f"check: thoát {code}, vi phạm {sorted(v)}, cần {sorted(exp)}")
        return "count có closed; check: closed hợp lệ, no_log/invalid_value/verified_not_found đúng"
    finally:
        fx.close()


run(main)
