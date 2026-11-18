#!/usr/bin/env python3
"""T-209 adv-02 (tầng 3, offline): lô hỗn hợp, so ước tính (dry-run, plan_batch) với số request thật, và --max-requests 0 (spec T-207 Hành vi 3, 4).
Lô: A phủ (OPERATIONAL), C phủ (CLOSED_PERMANENTLY, resolve không tự lọc), S cũ 31 ngày, L chỉ maps_link, U place_id báo cáo không có dòng,
    N ứng viên matched=false nhưng checked_at null.
  (a) dry-run: "tối đa 4 lượt Places", SẼ RESOLVE đúng {S, L, U, N}; plan_batch: resolve = S2 + L3 + U2 + N2 = 9.
  (b) --max-requests 0: A, C điền từ báo cáo; S, L, U, N budget_stop; 0 request Places (mở share link không phải request Places, như T-110); exit khác 0.
  (c) chạy lại với --max-requests 9: số request thật <= ước tính plan_batch (9), A/C không đổi byte, không request nào nhắc PA/PC.
  (d) sau (c): dry-run và plan_batch đều 0 (không còn mục chờ)."""
import os, re, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-207"))
import _t207 as k

bad = []
r = k.mk_root(["A", "C", "S", "L", "U", "N"])
LINK = "https://share.google/t209adv"
DEST = "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Lima+Garden/@10.7800,106.7000,17z/data=!3m1!4b1"
k.write_report(r, [k.row("A", "PA"), k.row("C", "PC", status="CLOSED_PERMANENTLY"), k.row("S", "PS", checked_at=k.ago(31)),
                   k.row("N", "PN", matched=False, checked_at="__DROP__")])
r.set_overrides([k.acc("A", "PA"), k.acc("C", "PC"), k.acc("S", "PS"), k.acc("L", link=LINK), k.acc("U", "PU"), k.acc("N", "PN")])
DENY = k.t.fixture({}, deny=True)
rc, out, calls = r.run(k.t.RESOLVE + ["--dry-run"], DENY)
m = re.search(r"tối đa (\d+) lượt Places", out)
will = {l.split(":")[0].split()[-1] for l in out.splitlines() if l.startswith("SẼ RESOLVE")}
if calls or not m or int(m.group(1)) != 4 or will != {"S", "L", "U", "N"}:
    bad.append("(a) dry-run: %r, SẼ RESOLVE=%r" % (out[-200:], sorted(will)))
rc, out, _ = r.run(["plan_batch.py", "--state", "HCMC", "--usage-root", "run-logs"], DENY)
m = re.search(r"BATCH_ESTIMATE .*?resolve=(\d+)", out)
est = int(m.group(1)) if m else None
if est != 9:
    bad.append("(a) plan_batch resolve=%r, kỳ vọng 9" % est)
PL = {"PS": k.op_place("Nhà hàng S", pid="PS"), "PU": k.op_place("Nhà hàng U", pid="PU"), "PN": k.op_place("Nhà hàng N", pid="PN"),
      "PL": k.t.place("Nhà hàng Lima Garden", k.ADDR, pid="PL")}
FX = k.t.fixture(PL, [("Lima Garden", ["PL"])], {LINK: {"status": 200, "to": DEST}})
rc, out, calls = r.run(k.t.RESOLVE + ["--max-requests", "0"], FX)
e = k.by_vid(r)
for v in ("A", "C"):
    if (e[v].get("resolved") or {}).get("resolved_from") != "enrich_report":
        bad.append("(b) %s không được điền từ báo cáo khi --max-requests 0: %r" % (v, e[v].get("resolved")))
for v in ("S", "L", "U", "N"):
    if e[v].get("resolved") or not re.search(r"RESOLVE_ERROR %s budget_stop" % v, out):
        bad.append("(b) %s phải budget_stop và không có resolved" % v)
if k.places_calls(calls) or rc == 0:
    bad.append("(b) --max-requests 0: %d request Places, exit %d" % (len(k.places_calls(calls)), rc))
snap = {v: dict(e[v]) for v in ("A", "C")}
rc, out, calls = r.run(k.t.RESOLVE + ["--max-requests", str(est or 9)], FX)
places = k.places_calls(calls)
if est is not None and len(places) > est:
    bad.append("(c) request thật %d > ước tính plan_batch %d" % (len(places), est))
if any("PA" in c["url"] or "PC" in c["url"] for c in calls):
    bad.append("(c) có request nhắc mục đã phủ")
e = k.by_vid(r)
if any(e[v] != snap[v] for v in snap):
    bad.append("(c) mục đã phủ bị đổi ở lần chạy sau")
if rc != 0 or any(not (e[v].get("resolved") or {}).get("place_id") for v in e):
    bad.append("(c) chưa resolve đủ: exit %d %r" % (rc, out[-300:]))
rc, out, _ = r.run(k.t.RESOLVE + ["--dry-run"], DENY)
rc2, out2, _ = r.run(["plan_batch.py", "--state", "HCMC", "--usage-root", "run-logs"], DENY)
if "tối đa 0 lượt" not in out or not re.search(r"BATCH_ESTIMATE .*?resolve=0\b", out2):
    bad.append("(d) sau khi resolve hết, ước tính chưa về 0: %r / %r" % (out[-120:], out2[-200:]))
k.done(bad, "lô hỗn hợp: ước tính = đúng mục không phủ, --max-requests 0 vẫn điền mục phủ, request thật <= ước tính")
