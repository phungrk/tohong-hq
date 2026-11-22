#!/usr/bin/env python3
"""T-219 tiêu chí 15 (offline): khoá API.
 - thiếu GEMINI_API_KEY (hoặc rỗng) khi chạy thật: thoát 2, in 'MISSING_SECRET GEMINI_API_KEY' (chỉ tên), 0 lượt gọi, không dòng GOOGLE_REQUEST; thiếu GOOGLE_MAPS_API_KEY tương tự;
   thiếu cả hai: in cả hai tên;
 - khoá đặt đủ: mọi lượt Gemini mang đúng GEMINI_API_KEY trong header, mọi lượt Maps mang đúng GOOGLE_MAPS_API_KEY trong header (không đổi chéo), KHÔNG lượt nào có khoá trong URL;
 - giá trị khoá (đầy đủ và 12 ký tự đầu) KHÔNG xuất hiện ở stdout/stderr hay bất kỳ file nào CLI tạo ra, trên đường chạy thành công, bị dừng vì 401, bị chặn mạng (deny) và dry-run."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
files, removed, fx, meta = k.world()
for tag, kw, names in (("thiếu Gemini", dict(gemini=False), ["GEMINI_API_KEY"]), ("Gemini rỗng", dict(env_extra={"GEMINI_API_KEY": ""}), ["GEMINI_API_KEY"]),
                       ("thiếu Maps", dict(maps=False), ["GOOGLE_MAPS_API_KEY"]), ("thiếu cả hai", dict(maps=False, gemini=False), ["GEMINI_API_KEY", "GOOGLE_MAPS_API_KEY"])):
    r = k.Root(files, removed)
    rc, out, calls = r.run(k.std_args(), fx, **kw)
    if rc != 2 or calls or any("MISSING_SECRET %s" % n not in out for n in names):
        bad.append("%s: rc=%d calls=%d, kỳ vọng rc 2, 0 lượt gọi, MISSING_SECRET %s" % (tag, rc, len(calls), "+".join(names)))
    if any("GOOGLE_REQUEST" in open(f, encoding="utf-8").read() for f in r.log_files()):
        bad.append("%s: không được ghi GOOGLE_REQUEST khi thiếu khoá" % tag)
    if k.MAPS_KEY in out or k.GEM_KEY in out:
        bad.append("%s: thông báo lỗi lộ giá trị khoá" % tag)


def leaks(r, out, tag):
    before = getattr(r, "_before", {})
    bl = [out] + [open(os.path.join(r.path, f), "rb").read().decode("utf-8", "replace") for f in r.all_files() if f not in before and not f.endswith(".py")]
    for secret in (k.MAPS_KEY, k.GEM_KEY):
        for frag in (secret, secret[:12]):
            if any(frag in t for t in bl):
                bad.append("%s: giá trị khoá (%s…) xuất hiện trong đầu ra" % (tag, frag[:6]))
                return


scen = (("chạy thật", {}, k.std_args()), ("bị dừng 401", {"gemini": dict(fx["gemini"], grid_status=401)}, k.std_args()), ("bị chặn mạng", {"deny": True}, k.std_args()),
        ("dry-run", {}, k.std_args() + ["--dry-run"]))
for tag, patch, argv in scen:
    f2 = dict(fx, **patch)
    r = k.Root(files, removed)
    r._before = r.all_files()
    rc, out, calls = r.run(argv, f2, run_id="31")
    leaks(r, out, tag)
    if tag == "chạy thật":
        for c in calls:
            if c["key_in_url"]:
                bad.append("khoá nằm trong URL: %s" % c["url"][:60])
                break
            want = k.GEM_KEY if c["kind"] == "gemini" else k.MAPS_KEY
            if c["key_header"] != want:
                bad.append("lượt %s mang khoá header %r, kỳ vọng khoá của nó" % (c["kind"], (c["key_header"] or "")[:8]))
                break
        if not calls or not any(c["kind"] == "gemini" for c in calls) or not any(c["kind"] == "search" for c in calls):
            bad.append("chạy thật không gọi cả Gemini và Maps (setup)")
k.done(bad, "thiếu khoá thì MISSING_SECRET <tên> thoát 2 trước mọi lượt gọi; khoá chỉ ở header; không lộ ở stdout, log, file, đường lỗi")
