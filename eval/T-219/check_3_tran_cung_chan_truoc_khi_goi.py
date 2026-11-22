#!/usr/bin/env python3
"""T-219 tiêu chí 3 (offline): trần cứng chặn TRƯỚC lượt trả tiền. Google/Gemini giả đếm số request THẬT SỰ tới nơi.
 A --max-text-search 48: đúng 48 Text Search, cả 48 là trang 1 (trang 1 của mọi truy vấn trước trang 2), P0_STOP text_search, thoát 0, báo cáo stopped_by.
 B --max-details 5: đúng 5 Place Details, P0_STOP details, các ứng viên yes còn lại details_status=skipped, không ai trong số đó qualified.
 C --max-gemini 5: đúng 5 request Gemini (sinh lưới, phân loại, 3 enrich nhóm new), P0_STOP gemini, 0 lượt enrich venue.
 D --max-usd 0.05: không request nào làm chi net vượt 0.05 (báo cáo usd_net <= 0.05), P0_STOP usd, thoát 0.
 E Gemini trả 401 ở lượt đầu: đúng 1 request Gemini, 0 Text Search, 0 Details, P0_STOP gemini_auth, thoát 1, vẫn in hai dòng usage cuối."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []


def go(extra, patch=None):
    files, removed, fx, meta = k.world()
    if patch:
        patch(fx)
    r = k.Root(files, removed)
    rc, out, calls = r.run(k.std_args() + extra, fx)
    return r, rc, out, calls, meta


r, rc, out, calls, meta = go(["--max-text-search", "48"])
ss = [c for c in calls if c["kind"] == "search"]
if len(ss) != 48 or any(c["page_token"] for c in ss):
    bad.append("A: kỳ vọng đúng 48 Text Search toàn trang 1, thấy %d (trang sau: %d)" % (len(ss), sum(1 for c in ss if c["page_token"])))
if rc != 0 or "P0_STOP text_search" not in out:
    bad.append("A: rc=%d, thiếu P0_STOP text_search" % rc)
rep = k.read_report(r) or {}
if rep.get("stopped_by") != "text_search":
    bad.append("A: báo cáo stopped_by=%r, kỳ vọng text_search" % rep.get("stopped_by"))

r, rc, out, calls, meta = go(["--max-details", "5"])
dd = [c for c in calls if c["kind"] == "details"]
cand = r.rows("p0-out/t/private/candidates.csv") or []
sk = [x for x in cand if x.get("details_status") == "skipped"]
if len(dd) != 5 or "P0_STOP details" not in out or rc != 0:
    bad.append("B: details=%d rc=%d P0_STOP details=%s (kỳ vọng 5, 0, có)" % (len(dd), rc, "P0_STOP details" in out))
if len(sk) != 32 or any(x.get("qualified", "").lower() == "true" for x in sk):
    bad.append("B: kỳ vọng 32 dòng details_status=skipped và không dòng nào qualified, thấy %d" % len(sk))

r, rc, out, calls, meta = go(["--max-gemini", "5"])
gg = [c for c in calls if c["kind"] == "gemini"]
roles = [c["role"] for c in gg]
if len(gg) != 5 or roles[:2] != ["grid", "classify"] or roles[2:] != ["enrich"] * 3 or "P0_STOP gemini" not in out or rc != 0:
    bad.append("C: gemini=%d roles=%s rc=%d (kỳ vọng 5 = grid, classify, 3 enrich; P0_STOP gemini; rc 0)" % (len(gg), roles, rc))
if any("Gold" in c["text"] for c in gg if c["role"] == "enrich"):
    bad.append("C: nhóm venue không được enrich trước khi nhóm new xong")

r, rc, out, calls, meta = go(["--max-usd", "0.05"])
rep = k.read_report(r) or {}
un = ((rep.get("cost") or {}).get("usd_net"))
if rc != 0 or "P0_STOP usd" not in out or not isinstance(un, (int, float)) or un > 0.05 + 1e-6:
    bad.append("D: rc=%d P0_STOP usd=%s usd_net=%r (kỳ vọng rc 0, có P0_STOP usd, usd_net <= 0.05)" % (rc, "P0_STOP usd" in out, un))
if k.n_kind(calls, "gemini") >= 62:
    bad.append("D: không được chạy đủ 62 lượt Gemini dưới trần 0.05")

r, rc, out, calls, meta = go([], lambda fx: fx["gemini"].update(grid_status=401))
ls = [l for l in out.splitlines() if l.strip()]
if k.n_kind(calls, "gemini") != 1 or k.n_kind(calls, "search") or k.n_kind(calls, "details") or rc != 1 or "P0_STOP gemini_auth" not in out:
    bad.append("E: gemini=%d search=%d details=%d rc=%d gemini_auth=%s (kỳ vọng 1,0,0,1,có)" % (k.n_kind(calls, "gemini"), k.n_kind(calls, "search"), k.n_kind(calls, "details"), rc, "P0_STOP gemini_auth" in out))
if len(ls) < 2 or not ls[-2].startswith("GOOGLE_USAGE ") or not ls[-1].startswith("GEMINI_USAGE ") or "calls=1" not in ls[-1]:
    bad.append("E: hai dòng cuối phải là GOOGLE_USAGE rồi GEMINI_USAGE calls=1, thấy %r" % ls[-2:])
k.done(bad, "mỗi trần chặn đúng số request tới Google/Gemini giả; usd không vượt; 401 dừng ở lượt Gemini đầu trước mọi lượt Maps")
