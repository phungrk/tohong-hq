#!/usr/bin/env python3
"""T-221 tiêu chí 6 (offline): dòng P0_HTTP_ERROR KHÔNG BAO GIỜ chứa place_id, tên, địa chỉ, website hay truy vấn đã gửi trong CHÍNH lượt gọi đó, kể cả khi Google nhắc lại chúng
trong error.message hay trong thân thô; và JSON có đối tượng `error` thì không bao giờ rơi về thân thô. Ràng buộc stdout của T-219 (check_16: không tên/địa chỉ/place_id) giữ nguyên cho dòng này.
 1. Details 404 có message nhắc place_id trong đường dẫn (`places/<id>`): mọi lượt lỗi, dòng của lượt đó không chứa place_id của lượt đó; phần chữ lành còn; có [REDACTED]; vẫn tiếp tục, không P0_STOP;
 2. Gemini lượt phân loại 400 có message trích tên + địa chỉ + id của lô đã gửi: không lộ;
 3. Gemini lượt enrich 400 có message trích tên + địa chỉ + website của prompt: không lộ;
 4. Text Search 403 có message trích truy vấn đã gửi: không lộ;
 5. JSON có `error` là đối tượng nhưng không có message (hoặc message null/số/rỗng/đối tượng), kèm tên/địa chỉ/place_id ở error.details và places: dòng là
    `... reason=<error.status> message=` (message RỖNG đúng nghĩa, không thân thô);
 6. thân dự phòng (không phải JSON; JSON không có đối tượng `error`) nhắc place_id/tên/địa chỉ: bị che;
 7. toàn bộ stdout của mọi ca không chứa tên/địa chỉ/place_id của thế giới giả (mẫu như T-219 check_16)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
ID = re.compile(r"(?<![A-Za-z0-9])(?:P\d{3}|PE1|PV1|PR1|PD2|PR2|V\d{2})(?![A-Za-z0-9])")
NAMES = ("Xe hoa Mẫu", "Garage sửa xe", "Studio Ảnh", "Địa điểm Mẫu", "Đường Mẫu", "Xe Cưới Hoàng Gia", "Nhà hàng Gold", "Đường Tiệc", "Thuê xe hoa An Phát", "Đã Gỡ", "Minh Tâm", "gold", ".example")


def leaks(out, e_line, sent):
    """Mô tả chỗ lộ (hoặc None): giá trị đã gửi (không rỗng) còn trong dòng; hoặc mẫu tên/địa chỉ/place_id còn trong stdout."""
    for k in ("PID", "NAME", "ADDR", "WEB", "QUERY"):
        v = (sent.get(k) or "").strip()
        if len(v) >= 4 and v in re.sub(r"\s+", " ", e_line):
            return "%s=%r còn trong dòng" % (k, v)
    return None


def stdout_leak(out):
    if ID.search(out):
        return "place_id/vendor id trong stdout: %r" % ID.search(out).group(0)
    for n in NAMES:
        if n in out:
            return "tên/địa chỉ trong stdout: %r" % n
    return None


def one(tag, fx_err, want_kind, expect_sent=("PID",), min_lines=1):
    rc, out, calls, r = E.run({}, fx_err, run_id="61")
    es = E.errs(out)
    if len(es) < min_lines or len(es) != len(r.err_sent) or any(not E.LINE.match(l) for l in es):
        bad.append("%s: cần %d dòng P0_HTTP_ERROR hợp lệ (mỗi lượt lỗi một dòng), có %d / %d lượt lỗi" % (tag, len(r.err_sent), len(es), len(r.err_sent)))
        return out, es, r
    for l, s in zip(es, r.err_sent):
        if not all((s.get(k) or "").strip() for k in expect_sent):
            bad.append("%s: setup: lượt lỗi không mang %s (%r)" % (tag, expect_sent, s))
            continue
        h = leaks(out, l, s)
        if h:
            bad.append("%s: %s: %s" % (tag, l[:100], h))
        if "[REDACTED]" not in l:
            bad.append("%s: dòng phải có [REDACTED] thay giá trị đã gửi: %r" % (tag, l[:120]))
    h = stdout_leak(out)
    if h:
        bad.append("%s: %s" % (tag, h))
    return out, es, r


# 1. Details 404 nhắc place_id
out, es, r = one("details-404", {"details": {"status": 404, "body": {"error": {"code": 404, "status": "NOT_FOUND", "message": "Requested entity was not found: places/<<PID>>. Place ID <<PID>> is invalid."}}}}, "details", min_lines=2)
if es and ("Requested entity was not found" not in es[0] or "kind=details status=404 reason=NOT_FOUND" not in es[0]):
    bad.append("details-404: mất phần chữ lành hoặc reason: %r" % es[0][:120])
if "P0_STOP http_404" in out:
    bad.append("details-404: không được dừng")
# 2. Gemini phân loại 400: tìm lượt gemini đầu tiên có vai classify trong lần chạy nền
rc, out0, calls0, _ = E.run({}, {})
g = [c for c in calls0 if c["kind"] == "gemini"]
ic = next((i for i, c in enumerate(g) if c["role"] == "classify"), None)
ie = next((i for i, c in enumerate(g) if c["role"] == "enrich" and re.search(r"website: https?://", c.get("text", ""))), None)
if ic is None or ie is None:
    bad.append("setup: thế giới chuẩn thiếu lượt classify hoặc enrich có website (classify=%s enrich=%s)" % (ic, ie))
else:
    one("gemini-classify-400", {"gemini": {"status": 400, "after": ic, "times": 1, "body": {"error": {"code": 400, "status": "INVALID_ARGUMENT",
        "message": "Invalid JSON payload. Bad content: \"<<PID>> | <<NAME>> | car_rental | <<ADDR>>\" (unsupported)."}}}}, "gemini", expect_sent=("PID", "NAME", "ADDR"))
    one("gemini-enrich-400", {"gemini": {"status": 400, "after": ie, "times": 1, "body": {"error": {"code": 400, "status": "INVALID_ARGUMENT",
        "message": "Cannot ground: tên: <<NAME>> · địa chỉ:\n<<ADDR>> ; website <<WEB>> unreachable."}}}}, "gemini", expect_sent=("NAME", "ADDR", "WEB"))
# 4. Text Search nhắc truy vấn
one("search-403", {"search": {"status": 403, "body": {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": "Denied for query \"<<QUERY>>\" in project."}}}}, "text_search", expect_sent=("QUERY",))
# 5. error là đối tượng không có message hữu dụng: message rỗng, không thân thô
LEAKY = {"details": [{"reason": "<<NAME>>", "metadata": {"address": "<<ADDR>>", "place": "places/<<PID>>"}}], "places": [{"id": "<<PID>>", "formattedAddress": "<<ADDR>>"}]}
for tag, fk, kind, st, extra, after in (("details-no-msg", "details", "details", 404, {}, 0), ("details-null-msg", "details", "details", 404, {"message": None}, 0), ("details-num-msg", "details", "details", 404, {"message": 123}, 0),
                                        ("details-empty-msg", "details", "details", 404, {"message": ""}, 0), ("details-obj-msg", "details", "details", 404, {"message": {"a": "<<PID>>"}}, 0),
                                        ("search-no-msg", "search", "text_search", 400, {}, 0), ("gemini-classify-no-msg", "gemini", "gemini", 400, {}, ic or 0)):
    err = {"code": st, "status": "INVALID_ARGUMENT"}
    err.update(extra)
    err.update(LEAKY)
    body = dict(LEAKY, error=err)
    rc, out, calls, r = E.run({}, {fk: {"status": st, "body": body, "after": after, "times": 1}}, run_id="62")
    es = E.errs(out)
    want = "P0_HTTP_ERROR kind=%s status=%d reason=INVALID_ARGUMENT message=" % (kind, st)
    if es != [want]:
        bad.append("%s: cần đúng một dòng %r (message rỗng, không thân thô), có %r" % (tag, want, [l[:140] for l in es]))
    h = stdout_leak(out)
    if h:
        bad.append("%s: %s" % (tag, h))
# 6. thân dự phòng: không phải JSON, hoặc JSON không có đối tượng error
for tag, fk, kind, st, body, ex in (
        ("details-html", "details", "details", 404, "<p>No such place <<PID>> (<<NAME>>)</p>", ("PID",)),
        ("details-json-noerror", "details", "details", 404, {"detail": "unknown places/<<PID>>"}, ("PID",)),
        ("details-error-string", "details", "details", 404, {"error": "bad places/<<PID>>"}, ("PID",)),
        ("gemini-html", "gemini", "gemini", 400, "<p>Bad <<NAME>> at <<ADDR>></p>", ("NAME", "ADDR")),
        ("gemini-json-noerror", "gemini", "gemini", 400, {"detail": "bad <<NAME>> | <<ADDR>> | <<PID>>"}, ("PID", "NAME", "ADDR"))):
    one(tag, {fk: {"status": st, "body": body, "after": (ic or 0) if fk == "gemini" else 0, "times": 1}}, kind, expect_sent=ex)
T.done(bad, "place_id/tên/địa chỉ/website/truy vấn đã gửi bị che dù Google nhắc lại; JSON có error không message in message rỗng, không thân thô; stdout sạch")
