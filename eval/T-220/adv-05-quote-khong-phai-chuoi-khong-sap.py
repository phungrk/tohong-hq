"""T-220 adv-05 (spec Hành vi 7, cổng nguồn bước 5; Hành vi 1: lược đồ hợp lệ của prompt 2 = đối tượng JSON): giá đạt bước 1-4 của cổng nhưng `quote` không phải chuỗi
(số, mảng): quote không chứa số tiền => price=null, price_dropped_reason=quote_missing_amount; lần chạy KHÔNG được sập (sập = mất toàn bộ kết quả đã trả tiền: không
báo cáo, không samples.csv). Hai ca: quote là số nguyên bằng min_vnd; quote là mảng một chuỗi."""
import json, os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _adv import T, env  # noqa: E402

bad = []
for label, mk in (("int", lambda p: p["min_vnd"]), ("list", lambda p: ["Giá %sđ" % T.money(p["min_vnd"])])):
    files, removed, fx, meta = T.world()
    target = None
    picks = set(T.pick_new(meta))
    for i in range(6, 37):
        pid = T.n_pid(i)
        pr = meta["gem_new"].get(pid, {}).get("price")
        g, why = T.gate_price(pr, [{"uri": "https://vertex.example/r/%d" % i, "title": "example.org"}], meta["gem_new"][pid].get("same_vendor"))
        if pid in picks and g:
            target = (pid, meta["places"][pid]["name"])
            break
    if not target:
        T.fail("thế giới chuẩn không có vendor new có giá đạt cổng")
    for rule in fx["gemini"]["enrich"]:
        if rule["match"] == target[1]:
            rule["resp"]["price"]["quote"] = mk(rule["resp"]["price"])
    r = T.Root(files, removed)
    rc, out, calls = r.run(T.std_args(), fx, env_extra=env())
    if rc != 0 or "Traceback" in out:
        bad.append("%s: rc=%d, sập: %s" % (label, rc, out.strip().splitlines()[-1][:120]))
        continue
    p = os.path.join(r.path, "p0-out/t/private/enrich.jsonl")
    rows = {json.loads(l)["id"]: json.loads(l) for l in open(p, encoding="utf-8")} if os.path.exists(p) else {}
    row = rows.get(target[0]) or {}
    if row.get("price") is not None or row.get("price_dropped_reason") != "quote_missing_amount":
        bad.append("%s: price=%s reason=%s" % (label, row.get("price"), row.get("price_dropped_reason")))
T.done(bad, "quote không phải chuỗi: quote_missing_amount, không sập")
