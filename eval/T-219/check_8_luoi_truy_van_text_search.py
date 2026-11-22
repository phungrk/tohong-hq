#!/usr/bin/env python3
"""T-219 tiêu chí 8 (offline): lưới truy vấn và Text Search Pro.
 - lượt gọi ĐẦU TIÊN của cả lần chạy là Gemini sinh lưới (không tools); chưa có lượt Maps nào trước nó;
 - queries.json: phrasings = 4 cách của Gemini, areas = 12 khu vực của spec, queries = đúng 48 chuỗi '<cách gọi> <khu vực>, Thành phố Hồ Chí Minh';
 - mọi Text Search có field mask CHÍNH XÁC {places.id, places.displayName, places.formattedAddress, places.businessStatus, places.types, nextPageToken}
   (Google giả trả 400 cho mask Enterprise, nên mask dư cũng làm đỏ ở chỗ khác);
 - 48 truy vấn khác nhau đủ; trang 1 của mọi truy vấn đi trước mọi trang 2, trang 2 trước trang 3; tối đa 3 trang (tổng 56 lượt);
 - lưới sai lược đồ (thiếu cách gọi / trùng sau khi bỏ dấu): thử lại đúng 1 lần (2 lượt Gemini), rồi P0_STOP grid_invalid, thoát 1, 0 lượt Maps."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run()
if not calls or calls[0]["kind"] != "gemini" or calls[0]["role"] != "grid" or calls[0]["tools"]:
    bad.append("lượt đầu phải là Gemini sinh lưới không tools, thấy %r" % ({x: calls[0][x] for x in ("kind", "role", "tools")} if calls else None))
q = r.read("p0-out/t/private/queries.json") or {}
want = ["%s %s, Thành phố Hồ Chí Minh" % (p, a) for p in k.PHRASINGS for a in k.AREAS]
if q.get("phrasings") != k.PHRASINGS or q.get("areas") != k.AREAS or sorted(q.get("queries") or []) != sorted(want) or len(want) != 48:
    bad.append("queries.json sai (phrasings=%r areas=%d queries=%d)" % (q.get("phrasings"), len(q.get("areas") or []), len(q.get("queries") or [])))
ss = [c for c in calls if c["kind"] == "search"]
PRO = {"places.id", "places.displayName", "places.formattedAddress", "places.businessStatus", "places.types", "nextPageToken"}
for c in ss:
    if set(c["mask"].replace(" ", "").split(",")) != PRO:
        bad.append("Text Search mask %r không đúng bậc Pro" % c["mask"])
        break
if sorted({c["q"] for c in ss}) != sorted(want):
    bad.append("tập truy vấn gửi đi không khớp 48 truy vấn của spec (%d khác nhau)" % len({c["q"] for c in ss}))
pg = [0 if not c["page_token"] else int(c["page_token"][3:]) for c in ss]
if sorted(pg) != pg or (pg.count(0), pg.count(1), pg.count(2)) != (48, 4, 4) or len(pg) != 56:
    bad.append("thứ tự trang sai: (trang1,2,3)=%s, tổng=%d, kỳ vọng tăng dần (48,4,4)=56" % ((pg.count(0), pg.count(1), pg.count(2)), len(pg)))
if any(c["kind"] == "search" for c in calls[:1]):
    bad.append("có lượt Maps trước lượt Gemini đầu")
for tag, grid in (("thiếu", {"phrasings": ["thuê xe hoa", "xe cưới"]}), ("trùng sau bỏ dấu", {"phrasings": ["thuê xe hoa", "Thuê xe hoa", "xe cưới", "dịch vụ xe hoa"]})):
    files, removed, fx, meta = k.world()
    fx["gemini"]["grid"] = grid
    r2 = k.Root(files, removed)
    rc, out, c2 = r2.run(k.std_args(), fx)
    if rc != 1 or "P0_STOP grid_invalid" not in out or k.n_kind(c2, "gemini") != 2 or k.n_kind(c2, "search") or k.n_kind(c2, "details"):
        bad.append("lưới %s: rc=%d gemini=%d search=%d, kỳ vọng rc 1, P0_STOP grid_invalid, 2 lượt Gemini, 0 Maps" % (tag, rc, k.n_kind(c2, "gemini"), k.n_kind(c2, "search")))
k.done(bad, "lưới 48 truy vấn từ Gemini (lượt đầu), Text Search chỉ mask Pro, trang 1 trước trang 2-3, lưới sai dừng với 0 lượt Maps")
