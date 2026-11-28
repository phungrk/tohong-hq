"""T-232 tiêu chí 3 (SC-001): một lệnh trong repo (`python3 ai_mode_flags.py count` ở tools/scraper) in JSON đếm cờ theo từng hạng mục nguồn
(mỗi file output/<tp>/<hạng mục>/vendors.json): khoá found, not_found, address_mismatch, wrong_category, empty, invalid; cộng lại = số bản ghi của file.
Đếm theo bản ghi của chính file đó (vendor ở hai hạng mục được đếm ở cả hai, mỗi nơi theo giá trị của bản ghi nơi đó)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import collections, json
from lib232 import build, single_ids, multi_ids, edit, rec, tool, Fail, run

KEYS = ["found", "not_found", "address_mismatch", "wrong_category", "empty", "invalid"]


def main():
    st = {}

    def prep(fx):
        ids = single_ids(fx, "wedding_gift", 7)
        plan = ["found", "found", "not_found", "address_mismatch", "wrong_category", "NOT_FOUND", None]
        for vid, val in zip(ids, plan):
            edit(fx, "wedding_gift", lambda vs, vid=vid, val=val: rec(vs, vid).__setitem__("ai_mode_result", val))
        (mid, cats), = multi_ids(fx, 1)
        edit(fx, cats[0], lambda vs: rec(vs, mid).__setitem__("ai_mode_result", "wrong_category"))
        edit(fx, cats[1], lambda vs: rec(vs, mid).__setitem__("ai_mode_result", "found"))
        st.update(mid=mid, cats=cats)
    fx = build(prep)
    try:
        exp = {}
        for f in fx.source_files():
            cat = f.replace("\\", "/").split("/")[-2]
            d = json.load(open(f, encoding="utf-8"))
            c = collections.Counter()
            for v in (d["vendors"] if isinstance(d, dict) else d):
                x = v.get("ai_mode_result")
                c["empty" if x is None else x if isinstance(x, str) and x in KEYS[:4] else "invalid"] += 1
            exp[cat] = {k: c.get(k, 0) for k in KEYS}
        code, out, err = tool(fx, "count", "--state", "HCMC", "--output-dir", "output")
        if code != 0:
            raise Fail(f"count thoát {code}: {(err or out)[-200:]}")
        try:
            got = json.loads(out)
        except ValueError:
            raise Fail("count không in JSON: " + out[:200])
        if got != exp:
            diff = {k: (got.get(k), exp[k]) for k in set(exp) | set(got) if got.get(k) != exp.get(k)}
            raise Fail("đếm sai: " + json.dumps(diff, ensure_ascii=False)[:400])
        wg = got["wedding_gift"]
        return f"wedding_gift {wg}; {len(got)} hạng mục"
    finally:
        fx.close()


run(main)
