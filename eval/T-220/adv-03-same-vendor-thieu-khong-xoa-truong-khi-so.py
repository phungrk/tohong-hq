"""T-220 adv-03 (spec Hành vi 7/8): chỉ `same_vendor = false` làm trường Gemini coi như rỗng. Phản hồi prompt 2 THIẾU khoá same_vendor (đối tượng JSON vẫn hợp lệ theo
lược đồ của spec) với giá đạt cổng nguồn: giá được tính vào found (Hành vi 7) thì trong so sánh với AI Mode (Hành vi 8) giá đó cũng phải được dùng, không bị coi là rỗng.
Ca: venue mẫu đầu tiên có giá Gemini trùng khớp vàng (thế giới chuẩn: price=agree); bỏ khoá same_vendor thì hạng mục giá vẫn phải là agree, nhất quán với found."""
import json, os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _adv import T, env  # noqa: E402

bad = []
files, removed, fx, meta = T.world()
vid = None
for k, v in enumerate(meta["sample_ids"]):
    if k % 5 == 0 and k not in (13, 25) and meta["gold"][v].get("price_range"):
        vid = v
        break
if vid is None:
    T.fail("thế giới chuẩn không có venue phù hợp")
for rule in fx["gemini"]["enrich"]:
    if rule["match"] == "Nhà hàng Gold %s" % vid[1:]:
        rule["resp"].pop("same_vendor", None)
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(), fx, env_extra=env())
rows = {}
p = os.path.join(r.path, "p0-out/t/private/enrich.jsonl")
if os.path.exists(p):
    rows = {json.loads(l)["id"]: json.loads(l) for l in open(p, encoding="utf-8")}
cmp_ = r.read("p0-out/t/private/compare.json", {}) or {}
pv = {x.get("id"): x for x in cmp_.get("per_vendor") or []}
row = rows.get(vid) or {}
if rc != 0 or not row:
    bad.append("rc=%s, dòng enrich %s=%s" % (rc, vid, bool(row)))
elif row.get("price") is None:
    bad.append("%s: giá bị rớt (%s) dù same_vendor không phải false" % (vid, row.get("price_dropped_reason")))
elif (pv.get(vid) or {}).get("price") != "agree":
    bad.append("%s: giá Gemini tính vào found nhưng so sánh ra %s (coi Gemini rỗng dù same_vendor không phải false)" % (vid, (pv.get(vid) or {}).get("price")))
T.done(bad, "thiếu same_vendor: giá dùng nhất quán ở found và so sánh")
