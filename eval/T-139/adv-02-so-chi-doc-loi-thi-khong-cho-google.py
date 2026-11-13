#!/usr/bin/env python3
"""T-139 adv-02 (tầng 3, adversary): cổng hạn mức tự động phải ĐÓNG (không cho phần Google nào) khi sổ chi tháng có log không đọc được, và phải cộng log của lô trước.

Vì sao: `usage.read_usage` trả `unreadable` cho log của đợt (T-110/T-111, hoặc tên có `-run-<id>-`) không có dòng GOOGLE_REQUEST/GOOGLE_USAGE nào: chi của lần chạy đó
KHÔNG đếm được (ví dụ log kiểu cũ của refresh_photos chỉ in GOOGLE_USAGE ở cuối, bị huỷ giữa chừng sau vài trăm request). Hợp đồng của usage.py
("BATCH_DIRS ... nơi log hỏng làm chạy thật bị từ chối") và enrich.py (USAGE_LOG_UNREADABLE, thoát 2) là từ chối chạy thật. `plan_batch.py` gọi read_usage nhưng
bỏ qua `unreadable`, nên "đã dùng" thiếu đúng phần không đọc được và phương án A ("chi thật $0") cho Google chạy. `check_runs.py` không bắt vì log có tên `-run-<id>-`.

Chạy NGUYÊN VĂN bước "Cổng: hạn mức tự động" của resolve-overrides.yml trên bản sao git (sự kiện pull_request merged, công tắc bật), lô 15 mục place_id, baseline tháng 0:
  (A) thêm log tháng này `run-logs/T-111/<YYYYMMDD>-run-777-refresh.log` không có dòng GOOGLE_* (lần chạy bị huỷ trước dòng GOOGLE_USAGE cuối)
      -> cổng không được cho phần Google nào: hoặc bước cổng đỏ, hoặc resolve_max = enrich_max = refresh_max = 0 và blocked = true.
  (B) đối chứng (lô trước đã merge): log tháng này `run-logs/T-110/<YYYYMMDD>-run-778-refresh.log` có 950 dòng `GOOGLE_REQUEST run=778 kind=media`
      -> 950 + phần lô + biên 50 > 1000 miễn phí: phần ảnh/resolve không được phép (resolve_max = 0, refresh_max = 0, blocked = true).
  (C) đối chứng sạch: không log nào -> cổng qua, resolve_max = 30 (15 x 2), blocked = false.
In PASS / FAIL; thoát 0/1. Không mạng, không Google."""
import datetime, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-135"))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None:
    print("FAIL thiếu resolve-overrides.yml"); sys.exit(1)
jname = next(iter(wf["jobs"]))
day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
bad = []
box = t.Box(t.TOHONG)
try:
    t.set_baseline(box, text_search=0, photos=0)
    t.add_unresolved(box, 15, form="place_id")

    def quota(extra_log=None):
        box.reset()
        if extra_log:
            rel, body = extra_log
            p = os.path.join(box.ws, "tools", "scraper", "run-logs", rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, "w", encoding="utf-8").write(body)
            t.git(box.ws, "add", "-A"); t.git(box.ws, "commit", "-q", "-m", "log lô trước")
        c = t.gh_ctx(box, "pull_request", event=t.pr_event(), vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets={"GOOGLE_MAPS_API_KEY": "fake-key-not-real"})
        res = t.run_job(box, wf, jname, c, uses={"actions/": lambda w, s: {}}, only=lambda s: str(s.get("name", "")).startswith("Cổng: hạn mức"))
        st = next((v for k, v in res["steps"].items() if k == "quota" or str(k).startswith("Cổng: hạn mức")), None)
        if extra_log:
            t.git(box.ws, "reset", "-q", "--hard", "HEAD~1")
        return st or {}

    def closed(st):
        o = st.get("outputs") or {}
        if st.get("outcome") == "failure":
            return True
        return o.get("resolve_max") == "0" and o.get("enrich_max") == "0" and o.get("refresh_max") == "0" and o.get("blocked") == "true"

    st = quota(("T-111/%s-run-777-refresh.log" % day, "Refresh vendor photos\n  vendors: 202\n"))
    if not closed(st):
        bad.append("(A) log tháng này không đọc được (-run-777-) mà cổng vẫn cho Google: outcome=%s outputs=%s" % (st.get("outcome"), {k: v for k, v in (st.get("outputs") or {}).items() if k.endswith("_max") or k == "blocked"}))
    st = quota(("T-110/%s-run-778-refresh.log" % day, "".join("GOOGLE_REQUEST run=778 kind=media\n" for _ in range(950)) + "GOOGLE_USAGE text_search=0 photo_details=0 photo_media=950\n"))
    o = st.get("outputs") or {}
    if st.get("outcome") != "failure" and not (o.get("resolve_max") == "0" and o.get("refresh_max") == "0" and o.get("blocked") == "true"):
        bad.append("(B) lô trước đã dùng 950 ảnh mà cổng vẫn cho resolve/ảnh: %s" % {k: v for k, v in o.items() if k.endswith("_max") or k == "blocked"})
    st = quota()
    o = st.get("outputs") or {}
    if st.get("outcome") != "success" or o.get("resolve_max") != "30" or o.get("blocked") != "false":
        bad.append("(C) sổ sạch: cổng phải qua với resolve_max=30, thấy outcome=%s %s" % (st.get("outcome"), {k: v for k, v in o.items() if k.endswith("_max") or k == "blocked"}))
finally:
    box.cleanup()
t.done(bad, "cổng hạn mức đóng khi sổ chi có log không đọc được, cộng log lô trước, qua khi sổ sạch")
