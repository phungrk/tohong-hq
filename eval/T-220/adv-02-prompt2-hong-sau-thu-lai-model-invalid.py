"""T-220 adv-02 (ADR-142 M3, spec Hành vi 1/7/9): prompt 2 trả văn bản không phải JSON ở cả lượt đầu và lượt thử lại duy nhất (một vendor nhóm new, một venue):
mỗi vendor đúng 2 lượt Gemini, vẫn có dòng enrich.jsonl với price=null, price_dropped_reason=model_invalid; tính vào n, không vào found; lần chạy đi tiếp (rc 0)."""
import json, os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _adv import T, env  # noqa: E402

bad = []
files, removed, fx, meta = T.world()
new_pick = T.pick_new(meta)
pid = new_pick[0]
vid = meta["sample_ids"][0]
nm_new, nm_ven = meta["places"][pid]["name"], "Nhà hàng Gold %s" % vid[1:]
for rule in fx["gemini"]["enrich"]:
    if rule["match"] in (nm_new, nm_ven):
        rule["raw"] = "Xin lỗi, tôi không tìm thấy thông tin đáng tin cậy."
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(), fx, env_extra=env())
if rc != 0:
    bad.append("rc=%d" % rc)
for nm in (nm_new, nm_ven):
    k = sum(1 for c in calls if c["kind"] == "gemini" and c["role"] == "enrich" and T.fold(nm) in T.fold(c["text"]))
    if k != 2:
        bad.append("%s: %d lượt enrich (mong 2: lượt đầu + đúng 1 lần thử lại)" % (nm, k))
rows = [json.loads(l) for l in open(os.path.join(r.path, "p0-out/t/private/enrich.jsonl"), encoding="utf-8")] if os.path.exists(os.path.join(r.path, "p0-out/t/private/enrich.jsonl")) else []
for key in (pid, vid):
    row = [x for x in rows if x.get("id") == key]
    if not row:
        bad.append("%s: không có dòng enrich.jsonl (bị bỏ khỏi n)" % key)
    elif row[0].get("price") is not None or row[0].get("price_dropped_reason") != "model_invalid":
        bad.append("%s: price=%s reason=%s" % (key, row[0].get("price"), row[0].get("price_dropped_reason")))
rep = T.read_report(r) or {}
pz = rep.get("price") or {}
if (pz.get("gemini_new") or {}).get("n") != len(new_pick) or (pz.get("gemini_venue") or {}).get("n") != len(meta["sample_ids"]):
    bad.append("n sai: %s" % pz)
T.done(bad, "prompt 2 hỏng sau thử lại: 2 lượt, model_invalid, vẫn trong n")
