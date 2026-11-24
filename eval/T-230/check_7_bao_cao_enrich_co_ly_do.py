"""T-230 tiêu chí 7: báo cáo enrich (enrich-report.json) cho admin thấy cờ.
(a) mỗi dòng có khoá `ai_mode_result`: "not_found" / "found" theo nguồn, null khi không có cờ; vendor nhiều bản ghi có một bản ghi not_found -> "not_found";
(b) vendor not_found VẪN có dòng trong báo cáo; nhóm (`group`) và `summary` của mọi dòng giống hệt báo cáo khi không có cờ (không trùng nghĩa với nhóm not_found của Google Maps);
(c) danh mục pool-input-fields.json có mục `ai_mode_result` (file vendors.json, stage build) và drawer nhận giá trị ở pool_input.record;
(d) sinh hai lần cho cùng byte."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from lib230 import build, picks, set_field, report, Fail, run


def main():
    st = {}
    fx0 = build()
    try:
        (s, t, u), m = picks(fx0)
        _, r0 = report(fx0)
    finally:
        fx0.close()

    def prep(fx):
        set_field(fx, s, "not_found")
        set_field(fx, t, "found")
        set_field(fx, m, "found")
        set_field(fx, m, "not_found", only_first=True)
    fx = build(prep)
    try:
        b1, r1 = report(fx)
        b2, _ = report(fx)
        if b1 != b2:
            raise Fail("báo cáo sinh hai lần khác byte")
        rows = {r["id"]: r for r in r1["vendors"]}
        for vid, exp in ((s, "not_found"), (t, "found"), (u, None), (m, "not_found")):
            if vid not in rows:
                raise Fail(f"{vid} mất khỏi báo cáo")
            if "ai_mode_result" not in rows[vid] or rows[vid]["ai_mode_result"] != exp:
                raise Fail(f"{vid}: ai_mode_result = {rows[vid].get('ai_mode_result', '<thiếu khoá>')!r}, cần {exp!r}")
        g0 = {r["id"]: r["group"] for r in r0["vendors"]}
        g1 = {r["id"]: r["group"] for r in r1["vendors"]}
        if g0 != g1 or r0["summary"] != r1["summary"]:
            raise Fail("cờ AI Mode làm đổi nhóm hoặc summary của báo cáo")
        cat = [x for x in r1.get("pool_catalog", []) if x.get("key") == "ai_mode_result"]
        if not cat or cat[0].get("file") != "vendors.json" or "build" not in (cat[0].get("stages") or []):
            raise Fail("danh mục pool-input-fields.json thiếu mục ai_mode_result (file vendors.json, stage build)")
        rec = ((rows[s].get("pool_input") or {}).get("record") or {})
        if rec.get("ai_mode_result") != "not_found":
            raise Fail(f"pool_input.record của {s} không mang ai_mode_result (nhận {rec.get('ai_mode_result')!r})")
        return "báo cáo mang ai_mode_result, nhóm/summary không đổi, tất định"
    finally:
        fx.close()


run(main)
