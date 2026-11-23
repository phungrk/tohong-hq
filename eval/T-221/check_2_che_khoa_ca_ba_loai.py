#!/usr/bin/env python3
"""T-221 tiêu chí 1 (offline), che khoá: thân lỗi (Gemini 402, Text Search 403, Details 429) chứa khoá giả
 - dạng AIza + 35 ký tự (khác khoá môi trường), khoá môi trường thật của lần chạy, `key=<giá trị>` (cả trong URL), `Bearer <token>` (kể cả `Bearer` + xuống dòng/tab/nhiều dấu cách + token), có xuống dòng và tab;
 thì stdout, log tee và mọi file CLI tạo ra KHÔNG chứa khoá (đủ hay 12 ký tự đầu) và không chứa giá trị sau `key=` / `Bearer `; dòng P0_HTTP_ERROR vẫn đúng một dòng (không xuống dòng giữa),
 message còn phần chữ lành, có dấu che `[REDACTED]`. Khoá nằm sát vị trí 300 vẫn không để lại mảnh (che trước, cắt sau). Thân không phải JSON hay JSON không error không in nội dung; khoá trong Content-Type vẫn bị che."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _e as E
T = E.T
T.need_cli()
bad = []
SECRET_TOK = "tok_SECRET-9f8e7d6c5b4a"
SECRET_KV = "kv_SECRET_1234567890zz"
def msg(env_key):
    return ("Request had invalid credentials.\nkey=%s used at https://x.googleapis.com/v1?key=%s&alt=json\n\tAuthorization: Bearer %s\nbad %s and %s end"
            % (SECRET_KV, KEY_X, SECRET_TOK, env_key, E.KEY_X))
KEY_X = E.KEY_X
cases = (("gemini", "gemini", 402, T.GEM_KEY, "gemini"), ("text_search", "search", 403, T.MAPS_KEY, "text_search"), ("details", "details", 429, T.MAPS_KEY, "details"))
for kind, fk, st, envk, kname in cases:
    body = {"error": {"code": st, "status": "PERMISSION_DENIED", "message": msg(envk)}}
    rc, out, calls, r = E.run({}, {fk: {"status": st, "body": body}}, run_id="31")
    e = E.errs(out)
    m = E.LINE.match(e[0]) if len(e) >= 1 else None
    if len(e) < 1 or not m or m.group(1) != kname or m.group(2) != str(st):
        bad.append("%s: không có đúng dòng P0_HTTP_ERROR kind=%s status=%d (có %r)" % (kname, kname, st, e[:1]))
        continue
    texts = [out] + [open(os.path.join(r.path, f), "rb").read().decode("utf-8", "replace") for f in r.all_files() if f.endswith((".log", ".json", ".md", ".csv", ".jsonl"))]
    for t in texts:
        hit = E.leaked(t)
        if hit or SECRET_TOK in t or SECRET_KV in t:
            bad.append("%s: lộ khoá/token trong đầu ra (%s)" % (kname, hit or "key=/Bearer"))
            break
    if "[REDACTED]" not in m.group(4) or "Request had invalid credentials." not in m.group(4):
        bad.append("%s: message phải còn phần chữ lành và có [REDACTED]: %r" % (kname, m.group(4)[:80]))
# khoá sát vị trí cắt 300
pre = "x" * 290
body = {"error": {"code": 402, "status": "S", "message": pre + E.KEY_X + " tail"}}
rc, out, calls, r = E.run({}, {"gemini": {"status": 402, "body": body}}, run_id="32")
if E.leaked(out) or E.KEY_X[4:16] in out:
    bad.append("khoá nằm ngay vị trí 300 để lại mảnh (phải che trước rồi mới cắt)")
# `Bearer` theo sau bởi MỌI loại ký tự trắng (xuống dòng, tab, nhiều dấu cách), không chỉ một dấu cách
for sep in ("\n", "\r\n", "\t", "  ", " \n\t "):
    tok = "tok_BEARERSEP-1a2b3c4d5e6f"
    body = {"error": {"code": 402, "status": "S", "message": "Auth failed: Bearer%s%s and bearer%s%s done" % (sep, tok, sep, tok)}}
    rc, out, calls, r = E.run({}, {"gemini": {"status": 402, "body": body}}, run_id="34")
    if tok in out or len(E.errs(out)) != 1 or "Auth failed:" not in out:
        bad.append("Bearer + %r + token: lộ token hoặc không đúng một dòng" % sep)
# thân không phải JSON có khoá: nội dung không bao giờ được in (chỉ bytes + content_type); Content-Type mang khoá thì khoá bị che
raw = "oops key=%s Bearer %s %s" % (SECRET_KV, SECRET_TOK, E.KEY_X)
rc, out, calls, r = E.run({}, {"search": {"status": 403, "body": raw}}, run_id="33")
if E.leaked(out) or SECRET_KV in out or SECRET_TOK in out or E.errs(out) != ["P0_HTTP_ERROR kind=text_search status=403 reason= message=non_json_body bytes=%d content_type=text/html" % len(raw.encode("utf-8"))]:
    bad.append("thân không phải JSON có khoá: phải là non_json_body bytes=%d content_type=text/html, không khoá nào: %r" % (len(raw), E.errs(out)[:1]))
ct = "text/html; key=%s; note=Bearer %s; k=%s" % (SECRET_KV, SECRET_TOK, E.KEY_X)
rc, out, calls, r = E.run({}, {"gemini": {"status": 502, "body": "<p>x</p>", "ctype": ct}}, run_id="35")
e = E.errs(out)
if E.leaked(out) or SECRET_KV in out or SECRET_TOK in out or len(e) != 1 or "content_type=text/html; [REDACTED]" not in e[0] or "bytes=8 " not in e[0]:
    bad.append("Content-Type mang khoá: khoá phải bị che trong content_type, bytes=8: %r" % (e[:1],))
# thân JSON không có `error` mà có khoá: message rỗng (không thân thô), khoá không lộ
rc, out, calls, r = E.run({}, {"details": {"status": 404, "body": {"detail": "key=%s Bearer %s %s" % (SECRET_KV, SECRET_TOK, E.KEY_X)}}}, run_id="36")
if E.leaked(out) or SECRET_KV in out or SECRET_TOK in out or E.errs(out)[:1] != ["P0_HTTP_ERROR kind=details status=404 reason= message="]:
    bad.append("JSON không error có khoá: phải reason= message= rỗng, không khoá: %r" % (E.errs(out)[:1],))
# dấu che do CLI chèn không bị quét lại bởi che dữ liệu đã gửi: đã kiểm ở check_6 (giá trị đã gửi trùng chữ trong [REDACTED])
T.done(bad, "khoá AIza…/key=…/Bearer… bị che ở cả ba loại lời gọi, kể cả khoá giả lạ, trong Content-Type của thân không phải JSON, và sát vị trí cắt; dòng vẫn một dòng")
