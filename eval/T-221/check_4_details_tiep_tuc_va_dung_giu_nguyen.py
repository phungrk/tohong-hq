#!/usr/bin/env python3
"""T-221 tiêu chí 1 (offline), hành vi dừng/tiếp tục giữ nguyên:
 - Details 404 (kèm error.message) -> mỗi lượt lỗi in một dòng `P0_HTTP_ERROR kind=details status=404 reason=NOT_FOUND message=...`, KHÔNG có P0_STOP, lần chạy vẫn tiếp tục và ghi báo cáo;
   số lượt gọi mỗi loại và các dòng GOOGLE_USAGE/GEMINI_USAGE y hệt lần chạy 404 với thân lỗi cũ của fake T-219 (số dòng chẩn đoán = số lượt Details lỗi);
 - Details 429 -> dòng trước P0_STOP http_429; Details 401/403 tương tự (dừng như cũ);
 - Text Search 403 -> dòng kind=text_search trước P0_STOP http_403; Text Search 500 lượt giữa chừng cũng dừng đúng như cũ;
 - Gemini lỗi ở lượt SAU lượt đầu (vd 429 ở lượt 3) -> dòng kind=gemini trước P0_STOP http_429.
 Ở mọi ca: ngoài các dòng P0_HTTP_ERROR, đầu ra và mã thoát y hệt lần chạy nền (cùng mã, thân lỗi mặc định)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
files, removed, fx0, meta = T.world()


def baseline(fx, argv=None):
    r = T.Root(files, removed)
    return r.run(argv or T.std_args(), fx, run_id="221")


def body(st, status, m):
    return {"error": {"code": st, "status": status, "message": m}}


# Details 404 tiếp tục. fixture details_404 của fake T-219 làm 404 một số lượt; để chắc chắn có lượt lỗi, ép 404 ở mọi lượt Details bằng fake lỗi
rc, out, calls, _ = E.run({}, {"details": {"status": 404, "body": body(404, "NOT_FOUND", "Place not found: gone")}})
rcb, outb, callsb = baseline(dict(fx0, details_404=[p for p in fx0["places"]]))
nd = sum(1 for c in calls if c["kind"] == "details")
es = E.errs(out)
if nd == 0:
    bad.append("setup: thế giới chuẩn không có lượt Details")
want = "P0_HTTP_ERROR kind=details status=404 reason=NOT_FOUND message=Place not found: gone"
if len(es) != nd or any(l != want for l in es):
    bad.append("Details 404: cần %d dòng chẩn đoán đúng %r, có %d" % (nd, want, len(es)))
if "P0_STOP" in out and "http_404" in out:
    bad.append("Details 404 không được dừng")
if E.strip_err(out) != E.strip_err(outb) or rc != rcb or len(calls) != len(callsb):
    bad.append("Details 404: hành vi đổi so với nền (rc %d/%d, calls %d/%d)" % (rc, rcb, len(calls), len(callsb)))
# dừng như cũ
def stop_case(tag, fk, kind, st, status, stop, after=0):
    rc, out, calls, _ = E.run({}, {fk: {"status": st, "body": body(st, status, "msg-" + tag), "after": after}})
    # nền: cùng mã ở cùng lượt, thân lỗi mặc định của fake T-219 (qua fake lỗi nhưng thân kiểu cũ)
    rcb, outb, callsb, _ = E.run({}, {fk: {"status": st, "body": {"error": {"code": st, "message": "fake"}}, "after": after}})
    L = E.lines(out)
    w = "P0_HTTP_ERROR kind=%s status=%d reason=%s message=msg-%s" % (kind, st, status, tag)
    if L.count(w) != 1 or ("P0_STOP " + stop) not in L or L.index(w) > L.index("P0_STOP " + stop):
        bad.append("%s: cần đúng một %r trước P0_STOP %s" % (tag, w, stop))
    if E.strip_err(out).replace("msg-" + tag, "fake") != E.strip_err(outb) or rc != rcb or len(calls) != len(callsb):
        bad.append("%s: hành vi dừng đổi (rc %d/%d, calls %d/%d)" % (tag, rc, rcb, len(calls), len(callsb)))
stop_case("d429", "details", "details", 429, "RESOURCE_EXHAUSTED", "http_429")
stop_case("d403", "details", "details", 403, "PERMISSION_DENIED", "http_403")
stop_case("s403", "search", "text_search", 403, "PERMISSION_DENIED", "http_403")
stop_case("s500", "search", "text_search", 500, "INTERNAL", "http_500", after=3)
stop_case("g429", "gemini", "gemini", 429, "RESOURCE_EXHAUSTED", "http_429", after=2)
T.done(bad, "Details 404 tiếp tục kèm dòng; Details 429/403, Text Search 403/500, Gemini lượt sau 429 dừng như cũ, dòng đứng trước P0_STOP")
