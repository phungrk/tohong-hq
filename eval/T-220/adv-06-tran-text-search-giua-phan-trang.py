"""T-220 adv-06 (spec Hành vi 1/2): trần Text Search chạm giữa lúc phân trang. Thế giới chuẩn = 96 trang 1 + 4 trang 2 + 4 trang 3. max_text_search=100: đúng 100 lượt
(96 trang 1 + 4 trang 2, 0 trang 3), số GOOGLE_REQUEST search_pro = số lượt fake nhận, P0_STOP text_search, và các bước sau vẫn chạy (phân loại, Details, enrich)."""
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _adv import T, env  # noqa: E402

bad = []
files, removed, fx, meta = T.world()
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(max_text_search="100"), fx, env_extra=env())
s = [c for c in calls if c["kind"] == "search"]
p1 = sum(1 for c in s if not c["page_token"])
p2 = sum(1 for c in s if c["page_token"] == "tok1")
p3 = sum(1 for c in s if c["page_token"] == "tok2")
req = sum(1 for l in out.splitlines() if l.startswith("GOOGLE_REQUEST") and "kind=search_pro" in l)
if (len(s), p1, p2, p3) != (100, 96, 4, 0):
    bad.append("lượt search=%d trang1=%d trang2=%d trang3=%d (mong 100/96/4/0)" % (len(s), p1, p2, p3))
if req != len(s):
    bad.append("GOOGLE_REQUEST search_pro=%d khác số lượt %d" % (req, len(s)))
if "P0_STOP text_search" not in out:
    bad.append("không có P0_STOP text_search")
if T.n_kind(calls, "gemini", "classify") < 1 or T.n_kind(calls, "details") < 1 or T.n_kind(calls, "gemini", "enrich") < 1:
    bad.append("bước sau không chạy: classify=%d details=%d enrich=%d" % (T.n_kind(calls, "gemini", "classify"), T.n_kind(calls, "details"), T.n_kind(calls, "gemini", "enrich")))
if rc != 0:
    bad.append("rc=%d" % rc)
T.done(bad, "trần Text Search giữa phân trang: đúng 100 lượt, bước sau vẫn chạy")
