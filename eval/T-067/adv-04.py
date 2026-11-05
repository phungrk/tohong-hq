#!/usr/bin/env python3
"""T-067 adv-04 (Code Gate, adversary, 2026-11-05). Spec T-065 mục 9, 15, 17, 18, 20 với `--workers 1`.
Ca A (mẫu nguồn toàn entry failed vĩnh viễn kiểu manifest trước T-065, không có trường wayback): 50 entry `http-404` đứng đầu, 60 URL mới,
nguồn gốc 522 (`--retries 0`). Mẫu nguồn = 50 entry cũ, mẫu dừng sớm = 50 URL mới đầu (khác nhau). Mong: không kẹt (< 90 giây),
nguồn gốc chỉ nhận 50 yêu cầu cho 50 URL đầu; 60 URL mới `origin-skipped`, attempts 0; Wayback chỉ có ảnh cho URL mới thứ 55 (ứng viên 51+):
mã 0, wayback=1 (mẫu rỗng sau khi mọi URL mẫu bị bỏ qua nguồn gốc).
Ca B (lần 2 trên manifest đó, Wayback 429 mãi không Retry-After): ngắt mạch, mã 0. Ca C (lần 3, Wayback có hết): mã 0, mọi URL
`circuit-open` được hỏi lại và thành ok, không yêu cầu nào tới nguồn gốc ngoài 50 URL đầu.
Ca D (dừng sớm khi hàng Wayback còn URL ngoài mẫu): URL mẫu đầu treo ở nguồn (`--timeout 4`), 49 URL mẫu khác 522, Wayback không có;
một entry failed ngoài mẫu (đã có `wayback`, chờ quyết định "nguồn chết") xếp hàng Wayback ngay sau URL mẫu cuối (đang chờ giãn cách khi
dừng), Wayback cho URL đó (D1) treo, (D2) 429 Retry-After 60. Mong: mã 4, manifest nguyên byte, thoát trong 3 giây kể từ yêu cầu Wayback
cuối của mẫu. (Một URL một lúc nên lúc dừng không thể có yêu cầu Wayback của URL khác đang bay.) Offline. Mã 0 = đạt."""
import os, sys, time

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-065", "lib"))
from t065 import Env, need_back, need_summary, write_manifest, GOOD, fail, ok  # noqa: E402

back = need_back()
old = ["/dead/old%d" % i for i in range(50)]
new = ["/dead/new%d" % i for i in range(60)]
e = Env(old + new)
try:
    write_manifest(e.manifest, {e.url(p): {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 1} for p in old})
    e.wb.snaps = {"/dead/new55": GOOD}
    ex = ["--retries", "0", "--workers", "1"]
    p = e.mirror(back, ex, timeout=90)
    if p.returncode != 0: fail("A: mã 0, thấy %s; cuối stdout %r" % (p.returncode, p.stdout[-300:]))
    s = need_summary(p, "A")
    if s.get("wayback") != "1" or "stopped" in s: fail("A: wayback=1, không stopped=, thấy %s" % s)
    hit = e.og.paths_hit()
    if sorted(hit) != sorted(old): fail("A: nguồn gốc chỉ nhận 50 yêu cầu cho 50 URL đầu (mẫu nguồn), thấy %d yêu cầu, URL mới: %s" % (len(hit), [h for h in hit if "new" in h][:5]))
    ents = e.man()["entries"]
    for i, pth in enumerate(new):
        en = ents[e.url(pth)]
        if i == 55:
            if en.get("source") != "wayback": fail("A: new55 phải ok qua Wayback, thấy %s" % en)
        elif (en.get("reason"), en.get("attempts"), en.get("wayback")) != ("origin-skipped", 0, "none"):
            fail("A: %s phải origin-skipped, attempts 0, wayback none; thấy %s" % (pth, en))
    for pth in old:
        en = ents[e.url(pth)]
        if (en.get("reason"), en.get("wayback"), en.get("fail_runs")) != ("http-522", "none", 2): fail("A: %s phải http-522, wayback none, fail_runs 2; thấy %s" % (pth, en))

    # B: Wayback 429 mãi -> ngắt mạch, vẫn mã 0
    e.og.hits.clear(); e.wb.reqs.clear()
    e.wb.pre = lambda kind, n, path: (429, {})
    p = e.mirror(back, ex, timeout=90)
    if p.returncode != 0: fail("B: ngắt mạch không làm đổi mã thoát, mã 0; thấy %s %r" % (p.returncode, p.stdout[-300:]))
    ents = e.man()["entries"]
    co = [x for x in old + new if ents[e.url(x)].get("wayback") == "circuit-open"]
    if len(co) != 109 - 5: fail("B: 5 URL hết lần thử 429 rồi ngắt mạch: %d URL circuit-open, thấy %d" % (109 - 5, len(co)))
    if len(e.wb.reqs) != 20: fail("B: đúng 5 URL x 4 yêu cầu tới Wayback, thấy %d" % len(e.wb.reqs))

    # C: Wayback có hết -> circuit-open được hỏi lại, mã 0
    e.og.hits.clear(); e.wb.reqs.clear(); e.wb.pre = None
    e.wb.snaps = {p_: GOOD for p_ in old + new}
    p = e.mirror(back, ex, timeout=170)
    if p.returncode != 0: fail("C: mã 0, thấy %s %r" % (p.returncode, p.stdout[-300:]))
    s = need_summary(p, "C")
    if s.get("wayback") != "109" or s.get("failed") != "0": fail("C: 109 URL failed (gồm circuit-open) được hỏi lại và ok, thấy %s" % s)
    if sorted(e.og.paths_hit()) != sorted(old): fail("C: nguồn gốc chỉ nhận yêu cầu cho mẫu nguồn (50 URL đầu)")
finally:
    e.stop()

# D: dừng sớm lúc Wayback đang bận một URL ngoài mẫu
for label, pre in (("D1 treo", ("hang", 60)), ("D2 429 Retry-After 60", (429, {"Retry-After": "60"}))):
    smp = ["/hang/s0"] + ["/dead/s%d" % i for i in range(1, 50)]
    e = Env(smp + ["/gone/outside"], hang_secs=60)
    try:
        write_manifest(e.manifest, {e.url("/gone/outside"): {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 1, "wayback": "none"}})
        before = e.man_bytes()
        e.wb.pre = (lambda pr: lambda kind, n, path: pr if path == "/gone/outside" else None)(pre)
        p = e.mirror(back, ["--retries", "0", "--workers", "1", "--timeout", "4"], timeout=120)
        end = time.time()
        if p.returncode != 4: fail("%s: cả mẫu lỗi sau Wayback: mã 4, thấy %s %r" % (label, p.returncode, p.stdout[-300:]))
        if e.man_bytes() != before: fail("%s: mã 4 mà manifest đổi" % label)
        last = max(r["t"] for r in e.wb.reqs if r["path"] in smp)
        if end - last > 3.5: fail("%s: dừng sớm phải thoát trong 3 giây, thoát sau %.1f giây kể từ yêu cầu Wayback cuối của mẫu" % (label, end - last))
    finally:
        e.stop()
ok("workers 1: mẫu nguồn toàn failed vĩnh viễn không kẹt, origin-skipped làm mẫu rỗng -> mã 0; ngắt mạch rồi hỏi lại circuit-open; dừng sớm thoát < 3 giây khi Wayback đang treo/lùi URL ngoài mẫu")
