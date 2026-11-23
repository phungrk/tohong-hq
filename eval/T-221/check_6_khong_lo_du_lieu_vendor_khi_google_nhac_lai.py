#!/usr/bin/env python3
"""T-221 tiêu chí 6 (offline): dòng P0_HTTP_ERROR KHÔNG BAO GIỜ chứa place_id, tên, địa chỉ, website hay truy vấn đã gửi trong CHÍNH lượt gọi đó, ở BẤT KỲ dạng mã hoá nào đọc lại được
(chữ thường/hoa, thoát JSON \\uXXXX, thực thể HTML &#NN;), kể cả khi Google nhắc lại chúng trong error.message hay trong thân. Ràng buộc stdout của T-219 (check_16: không tên/địa chỉ/place_id) giữ nguyên.
Hàm phát hiện lộ GIẢI MÃ dòng trước khi tìm (json-unescape rồi html.unescape, lặp tới khi ổn định, hạ về casefold, gộp trắng) và tìm MỌI giá trị đã gửi của lô (không chỉ vendor đầu).
 1. Details 404 có message nhắc place_id trong đường dẫn (`places/<id>`), cả dạng viết hoa: mọi lượt lỗi không lộ; còn chữ lành; có [REDACTED]; vẫn tiếp tục, không P0_STOP;
 2. Gemini phân loại 400 trích tên + địa chỉ + id của vendor ĐẦU, GIỮA và CUỐI lô (lô 49 vendor), có dạng viết hoa/thường khác bản gốc: không lộ;
 3. Gemini enrich 400 trích tên/địa chỉ/website (cả viết hoa); 4. Text Search 403 trích truy vấn (cả viết hoa): không lộ;
 5. JSON có `error` là đối tượng nhưng không có message (hoặc null/số/rỗng/đối tượng), kèm tên/địa chỉ/place_id ở error.details và places: `reason=<error.status> message=` rỗng;
 6. thân KHÔNG phải JSON (HTML có thực thể số cho tên/địa chỉ/place_id, văn bản thường): đúng `message=non_json_body bytes=<n> content_type=<ct>`, không nội dung thân, không lộ giải mã;
 7. thân JSON KHÔNG có `error` (có \\uXXXX của tên/địa chỉ, ensure_ascii True và False; `error` là chuỗi): `reason= message=` RỖNG;
 8. giá trị đã gửi 2 ký tự bị che (ngưỡng 2), dấu che do CLI chèn không bị quét lại (vendor tên "ed" không biến [REDACTED] thành [R[REDACTED]ACT[REDACTED]]);
 9. toàn bộ stdout của mọi ca không chứa tên/địa chỉ/place_id của thế giới giả (mẫu như T-219 check_16), kể cả sau giải mã các dòng P0_HTTP_ERROR."""
import html, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
ID = re.compile(r"(?<![A-Za-z0-9])(?:P\d{3}|PE1|PV1|PR1|PD2|PR2|V\d{2})(?![A-Za-z0-9])")
NAMES = ("Xe hoa Mẫu", "Garage sửa xe", "Studio Ảnh", "Địa điểm Mẫu", "Đường Mẫu", "Xe Cưới Hoàng Gia", "Nhà hàng Gold", "Đường Tiệc", "Thuê xe hoa An Phát", "Đã Gỡ", "Minh Tâm", "gold", ".example")


def dec(t):
    """Giải mã mọi dạng ai cũng đọc lại được: thoát JSON \\uXXXX, thực thể HTML; lặp đến ổn định; hạ casefold; gộp trắng."""
    for _ in range(4):
        u = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), t)
        u = html.unescape(u)
        if u == t:
            break
        t = u
    return re.sub(r"\s+", " ", t).casefold()


def values(sent):
    """Mọi giá trị đã gửi của lượt (cả toàn bộ lô phân loại), dài >= 2."""
    vs = [sent.get(k) or "" for k in ("PID", "NAME", "ADDR", "WEB", "QUERY")]
    for b_ in sent.get("BATCH") or []:
        vs += [b_["PID"], b_["NAME"], b_["ADDR"]]
    return [re.sub(r"\s+", " ", v).strip() for v in vs if len(re.sub(r"\s+", " ", v).strip()) >= 2]


def leaks(out, e_line, sent):
    """Mô tả chỗ lộ (hoặc None): MỘT giá trị đã gửi (mọi vendor của lô) còn trong dòng sau giải mã; hoặc mẫu tên/địa chỉ/place_id còn trong stdout."""
    body = dec(e_line.split(" reason=", 1)[-1])
    for v in values(sent):
        if len(v) >= 4 and dec(v) in body:
            return "giá trị đã gửi %r còn trong dòng (sau giải mã)" % v
    return None


def stdout_leak(out):
    if ID.search(out):
        return "place_id/vendor id trong stdout: %r" % ID.search(out).group(0)
    txt = out + "\n" + "\n".join(dec(l) for l in E.errs(out))
    for n in NAMES:
        if n in out or n.casefold() in dec(txt):
            return "tên/địa chỉ trong stdout: %r" % n
    return None


def one(tag, fx_err, want_kind, expect_sent=("PID",), min_lines=1, need_red=True, world=None):
    rc, out, calls, r = E.run({}, fx_err, run_id="61", world=world)
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
        if need_red and "[REDACTED]" not in l:
            bad.append("%s: dòng phải có [REDACTED] thay giá trị đã gửi: %r" % (tag, l[:120]))
    h = stdout_leak(out)
    if h:
        bad.append("%s: %s" % (tag, h))
    return out, es, r


rc, out0, calls0, _ = E.run({}, {})
g = [c for c in calls0 if c["kind"] == "gemini"]
ic = next((i for i, c in enumerate(g) if c["role"] == "classify"), None)
ie = next((i for i, c in enumerate(g) if c["role"] == "enrich" and re.search(r"website: https?://", c.get("text", ""))), None)
if ic is None or ie is None:
    bad.append("setup: thế giới chuẩn thiếu lượt classify hoặc enrich có website (classify=%s enrich=%s)" % (ic, ie))
    T.done(bad, "")
nb = len([l for l in g[ic]["text"].splitlines() if len(l.split(" | ")) == 4])
if nb < 5:
    bad.append("setup: lô phân loại chỉ có %d vendor, cần >= 5 để thử giữa/cuối" % nb)
MID = nb // 2
# 1. Details 404 nhắc place_id (cả dạng viết hoa)
out, es, r = one("details-404", {"details": {"status": 404, "body": {"error": {"code": 404, "status": "NOT_FOUND", "message": "Requested entity was not found: places/<<PID>>. Place ID <<PID:upper>> / <<PID:lower>> is invalid."}}}}, "details", min_lines=2)
if es and ("Requested entity was not found" not in es[0] or "kind=details status=404 reason=NOT_FOUND" not in es[0]):
    bad.append("details-404: mất phần chữ lành hoặc reason: %r" % es[0][:120])
if "P0_STOP http_404" in out:
    bad.append("details-404: không được dừng")
# 2. Gemini phân loại 400: vendor đầu, GIỮA, CUỐI của lô; chữ hoa/thường khác bản gốc; địa chỉ đứng sau xuống dòng
CL = {"status": 400, "after": ic, "times": 1}
one("gemini-classify-400-first", {"gemini": dict(CL, body={"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "Invalid JSON payload. Bad content: \"<<PID>> | <<NAME>> | car_rental | <<ADDR>>\" (unsupported)."}})}, "gemini", expect_sent=("PID", "NAME", "ADDR"))
one("gemini-classify-400-middle-end", {"gemini": dict(CL, body={"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "bad rows: <<PID@%d>> | <<NAME@%d>> ;\n<<ADDR@%d>> and <<PID@-1>> | <<NAME@-1>> | <<ADDR@-1>> ok" % (MID, MID, MID)}})}, "gemini", expect_sent=("PID", "NAME", "ADDR"))
one("gemini-classify-400-case", {"gemini": dict(CL, body={"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "bad <<NAME:upper>> | <<ADDR:lower>> | <<PID:lower>> and <<NAME@-1:upper>> / <<NAME@%d:lower>>" % MID}})}, "gemini", expect_sent=("PID", "NAME", "ADDR"))
one("gemini-enrich-400", {"gemini": {"status": 400, "after": ie, "times": 1, "body": {"error": {"code": 400, "status": "INVALID_ARGUMENT",
    "message": "Cannot ground: tên: <<NAME>> · địa chỉ:\n<<ADDR>> ; website <<WEB>> unreachable; again <<NAME:upper>> <<ADDR:lower>> <<WEB:upper>>."}}}}, "gemini", expect_sent=("NAME", "ADDR", "WEB"))
# 4. Text Search nhắc truy vấn
one("search-403", {"search": {"status": 403, "body": {"error": {"code": 403, "status": "PERMISSION_DENIED", "message": "Denied for query \"<<QUERY>>\" / <<QUERY:upper>> in project."}}}}, "text_search", expect_sent=("QUERY",))
# 5. error là đối tượng không có message hữu dụng: message rỗng, không thân thô
LEAKY = {"details": [{"reason": "<<NAME>>", "metadata": {"address": "<<ADDR>>", "place": "places/<<PID>>"}}], "places": [{"id": "<<PID>>", "formattedAddress": "<<ADDR>>"}]}
for tag, fk, kind, st, extra, after in (("details-no-msg", "details", "details", 404, {}, 0), ("details-null-msg", "details", "details", 404, {"message": None}, 0), ("details-num-msg", "details", "details", 404, {"message": 123}, 0),
                                        ("details-empty-msg", "details", "details", 404, {"message": ""}, 0), ("details-obj-msg", "details", "details", 404, {"message": {"a": "<<PID>>"}}, 0),
                                        ("search-no-msg", "search", "text_search", 400, {}, 0), ("gemini-classify-no-msg", "gemini", "gemini", 400, {}, ic)):
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
# 6. thân KHÔNG phải JSON: không bao giờ in nội dung, kể cả thực thể số; chỉ non_json_body bytes=<n> content_type=<ct>
NJ = re.compile(r"^P0_HTTP_ERROR kind=(gemini|text_search|details) status=\d{3} reason= message=non_json_body bytes=\d+ content_type=(text/html|text/plain)$")
for tag, fk, kind, st, body, ct, ex in (
        ("details-html-ent", "details", "details", 404, "<p>No such place <<PID:ent>> / places/<<PID:upper>></p>", "text/html", ("PID",)),
        ("gemini-html-ent", "gemini", "gemini", 400, "<p>Bad <<NAME:ent>> at <<ADDR:ent>> id <<PID:ent>></p>", "text/html", ("NAME", "ADDR", "PID")),
        ("gemini-html-plain", "gemini", "gemini", 400, "<p>Bad <<NAME>> at <<ADDR>> id <<PID>> and <<NAME@-1>></p>", "text/html", ("NAME", "ADDR", "PID")),
        ("search-text", "search", "text_search", 400, "oops <<QUERY>> / <<QUERY:upper>>", "text/plain", ("QUERY",))):
    after = ic if fk == "gemini" else 0
    out, es, r = one(tag, {fk: {"status": st, "body": body, "after": after, "times": 1, "ctype": ct}}, kind, expect_sent=ex, need_red=False)
    if len(es) != 1 or not NJ.match(es[0]):
        bad.append("%s: thân không phải JSON phải ra `reason= message=non_json_body bytes=<n> content_type=%s`, có %r" % (tag, ct, [l[:140] for l in es]))
    elif es[0].split("bytes=")[1].split()[0] != str(r.err_sent[0]["body_bytes"]):
        bad.append("%s: bytes phải bằng số byte của thân (%s), có %r" % (tag, r.err_sent[0]["body_bytes"], es[0][:140]))
# 7. thân JSON KHÔNG có `error`: chứa tên/địa chỉ dạng thoát \\uXXXX (ensure_ascii True/False) -> message RỖNG; error là chuỗi -> rỗng
for tag, fk, kind, st, body, asc, ex in (
        ("details-json-noerror", "details", "details", 404, {"detail": "unknown places/<<PID>> <<PID:upper>>"}, True, ("PID",)),
        ("details-error-string", "details", "details", 404, {"error": "bad places/<<PID>> <<PID:lower>>"}, True, ("PID",)),
        ("gemini-json-noerror-ascii", "gemini", "gemini", 400, {"detail": "bad <<NAME>> | <<ADDR>> | <<PID>>"}, True, ("PID", "NAME", "ADDR")),
        ("gemini-json-noerror-utf8", "gemini", "gemini", 400, {"detail": "bad <<NAME@-1>> | <<ADDR@-1>> | <<PID@-1>>"}, False, ("PID", "NAME", "ADDR")),
        ("gemini-json-noerror-list", "gemini", "gemini", 400, [{"x": "<<NAME@%d>> <<ADDR@%d>>" % (MID, MID)}], True, ("PID", "NAME", "ADDR"))):
    after = ic if fk == "gemini" else 0
    out, es, r = one(tag, {fk: {"status": st, "body": body, "after": after, "times": 1, "ascii": asc}}, kind, expect_sent=ex, need_red=False)
    if es and not es[0].endswith(" reason= message="):
        bad.append("%s: thân JSON không có đối tượng error phải ra `reason= message=` RỖNG, có %r" % (tag, es[0][:160]))
# 8. ngưỡng 2 ký tự và dấu che không bị quét lại: đổi tên vendor thứ 2 và thứ 3 của lô thành "ed" và "Ab"
files, removed, fx, meta = T.world()
pids = sorted(fx["places"])
fx["places"]["P002"]["name"] = "ed"
fx["places"]["P003"]["name"] = "Ab"
w2 = (files, removed, fx, meta)
rc, out, calls, r = E.run({}, {"gemini": dict(CL, body={"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "Bearer tok1 | ab | ED | ok"}})}, run_id="63", world=w2)
es = E.errs(out)
if not r.err_sent or not any((b_["NAME"] in ("ed", "Ab")) for b_ in r.err_sent[0].get("BATCH", [])):
    bad.append("setup (ngưỡng 2): lô phân loại không mang tên 'ed'/'Ab' (%r)" % (r.err_sent[:1],))
elif es != ["P0_HTTP_ERROR kind=gemini status=400 reason=INVALID_ARGUMENT message=[REDACTED] | [REDACTED] | [REDACTED] | ok"]:
    bad.append("giá trị đã gửi 2 ký tự phải bị che (không phân biệt hoa thường), dấu che không bị quét lại: cần `[REDACTED] | [REDACTED] | [REDACTED] | ok`, có %r" % ([l[:160] for l in es],))
T.done(bad, "place_id/tên/địa chỉ/website/truy vấn đã gửi bị che ở mọi dạng (hoa/thường, \\uXXXX, thực thể), mọi vendor của lô; JSON có error không message và JSON không error ra rỗng; thân không phải JSON không in nội dung; stdout sạch")
