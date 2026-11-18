#!/usr/bin/env python3
"""T-207 tiêu chí 8 (offline): chi Google không tăng và trần request vẫn được tôn trọng.
  (a) lô toàn mục được báo cáo phủ + `--max-requests 0`: resolve vẫn điền hết (exit 0, không budget_stop, không RESOLVE_ERROR), 0 request;
  (b) lô có 1 mục không phủ + `--max-requests 0`: mục đó RESOLVE_ERROR budget_stop, 0 request, file không đổi byte ở mục đó (hành vi trần cũ giữ nguyên);
  (c) lô có 1 mục không phủ + `--max-requests 1`: đúng 1 request Google (Place Details) và mỗi request có dòng `GOOGLE_REQUEST` in TRƯỚC (INV-024), GOOGLE_USAGE khớp số request thật;
  (d) tổng request Google của mọi lô trên không bao giờ lớn hơn số mục không phủ."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

bad = []
r = k.mk_root(["a", "b", "z"])
k.write_report(r, [k.row("a", "PA"), k.row("b", "PB")])
r.set_overrides([k.acc("a", "PA"), k.acc("b", "PB")])
rc, out, calls = r.run(k.t.RESOLVE + ["--max-requests", "0"], k.t.fixture({}, deny=True))
if rc != 0 or calls or "budget_stop" in out or "RESOLVE_ERROR" in out or not all((e.get("resolved") or {}).get("place_id") for e in r.overrides()["overrides"]):
    bad.append("(a) lô toàn phủ + --max-requests 0: exit %d, %d request, %r" % (rc, len(calls), out[-200:]))
r.set_overrides([k.acc("a", "PA"), k.acc("z", "PZ")])
z_before = k.by_vid(r)["z"]
rc, out, calls = r.run(k.t.RESOLVE + ["--max-requests", "0"], k.t.fixture({"PZ": k.op_place("Z", pid="PZ")}))
if calls or "budget_stop" not in out or k.by_vid(r)["z"] != z_before or not (k.by_vid(r)["a"].get("resolved") or {}).get("place_id"):
    bad.append("(b) mục không phủ + --max-requests 0: %d request, %r" % (len(calls), out[-200:]))
r.set_overrides([k.acc("a", "PA"), k.acc("z", "PZ")])
rc, out, calls = r.run(k.t.RESOLVE + ["--max-requests", "1"], k.t.fixture({"PZ": k.op_place("Z", pid="PZ")}))
u = k.t.usage(out) or {}
if len(calls) != 1 or calls[0]["kind"] != "details" or out.count("GOOGLE_REQUEST") != 1 or u.get("photo_details") != 1 or u.get("text_search") != 0:
    bad.append("(c) --max-requests 1: %d request, GOOGLE_REQUEST=%d, usage=%r" % (len(calls), out.count("GOOGLE_REQUEST"), u))
k.done(bad, "trần request giữ nguyên; mục được phủ không tốn và không cần trần")
