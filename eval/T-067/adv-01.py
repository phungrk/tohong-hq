#!/usr/bin/env python3
"""T-067 adv-01 (Code Gate, adversary, 2026-11-05). Spec T-065 mục "Hành vi" câu mở đầu và mục 1: không có `--fallback wayback`
thì mọi hành vi T-051/T-058 giữ nguyên từng chữ. Đo bằng cách chạy CÙNG đầu vào qua bản T-064 (tohong-back 7569b74, lấy bằng
`git show`) và bản đang xét, so: mã thoát, stdout từng byte, manifest từng byte, tập file trong --out (tên + byte), tập yêu cầu
tới nguồn gốc. Ca 1: nguồn khoẻ lẫn lỗi (ok, 404, 522, HTML, entry ok có file, entry ok thiếu file, mồ côi, 130 URL để có PROGRESS).
Ca 2: 50 URL đầu đều 522: dừng sớm mã 4 (so mã, SUMMARY, manifest nguyên byte).
Offline: nguồn giả cục bộ (eval/T-065/lib), không gọi archive.org/marry.vn/Cloudflare. Thư mục tạm xoá khi thoát.
Không có commit 7569b74 trong tohong-back: PASS "chưa áp dụng". Chạy không tham số (gate.py: python3 -I). Mã 0 = đạt."""
import os, subprocess, sys

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-065", "lib"))
from t065 import Env, need_back, run, tmpdir, write_manifest, ok_entry, file_for, WEBP, BASE_URL, fail, ok  # noqa: E402

back = need_back()
REF = "7569b74"
src = subprocess.run(["git", "-C", back, "show", f"{REF}:scripts/vendor-images/vendor-images.mjs"], capture_output=True)
if src.returncode != 0:
    ok("chưa áp dụng (không có %s trong tohong-back)" % REF)
old_root = tmpdir("old-")
os.makedirs(os.path.join(old_root, "scripts", "vendor-images"))
OLD = os.path.join(old_root, "scripts", "vendor-images", "vendor-images.mjs")
open(OLD, "wb").write(src.stdout)
os.symlink(os.path.join(back, "node_modules"), os.path.join(old_root, "node_modules"))
NEW = os.path.join(back, "scripts", "vendor-images", "vendor-images.mjs")


def snapshot(e):
    files = {}
    for dp, _, fs in os.walk(e.out):
        for f in fs:
            p = os.path.join(dp, f); files[os.path.relpath(p, e.out)] = open(p, "rb").read()
    return files


def once(e, tool, entries, files, extra):
    import shutil
    if os.path.exists(e.manifest): os.remove(e.manifest)
    shutil.rmtree(e.out, True)
    e.og.hits.clear(); e.wb.reqs.clear()
    if entries is not None: write_manifest(e.manifest, entries(e))
    os.makedirs(os.path.join(e.out, "v"), exist_ok=True)
    for f in files(e): open(os.path.join(e.out, f), "wb").write(WEBP)
    before = e.man_bytes()
    cmd = ["node", tool, "mirror", "--pool", e.pool, "--manifest", e.manifest, "--out", e.out, "--base-url", BASE_URL,
           "--restore-from", e.url("/restore")] + extra
    p = run(cmd, timeout=170)
    return {"code": p.returncode, "stdout": p.stdout, "man": (e.man_bytes() or b"").decode(), "before": before,
            "after": e.man_bytes(), "files": snapshot(e), "hits": sorted(e.og.paths_hit()), "wb": e.wb.total()}


def pair(paths, entries, files, extra):
    e = Env(paths)
    try:
        return once(e, OLD, entries, files, extra), once(e, NEW, entries, files, extra)
    finally:
        e.stop()


# Ca 1: nguồn khoẻ lẫn lỗi
paths = ["/ok/small.png" + "?i=%d" % i for i in range(120)] + ["/gone/a", "/dead/b", "/html/c", "/ok/big.jpg", "/ok/small.png?have",
                                                                 "/ok/small.png?lost"]


def ents1(e):
    d = {e.url("/ok/small.png?have"): ok_entry(file_for("marry_%04d" % paths.index("/ok/small.png?have"), e.url("/ok/small.png?have"))),
         e.url("/ok/small.png?lost"): ok_entry(file_for("marry_%04d" % paths.index("/ok/small.png?lost"), e.url("/ok/small.png?lost"))),
         "https://orphan.example.com/x.jpg": {"status": "failed", "reason": "http-404", "attempts": 1, "fail_runs": 2},
         e.url("/dead/b"): {"status": "failed", "reason": "http-522", "attempts": 3, "fail_runs": 1}}
    return d


def files1(e):
    return [file_for("marry_%04d" % paths.index("/ok/small.png?have"), e.url("/ok/small.png?have"))]


ex = ["--workers", "4", "--retries", "1"]
o, n = pair(paths, ents1, files1, ex)
if o["code"] != 0: fail("ca 1: bản T-064 không chạy như mong đợi (mã %s), eval cần xem lại" % o["code"])
for k, what in (("code", "mã thoát"), ("stdout", "stdout"), ("man", "manifest"), ("hits", "tập yêu cầu tới nguồn gốc")):
    if o[k] != n[k]:
        fail("ca 1 (không cờ): %s khác bản T-064 %s.\n T-064: %r\n nay:   %r" % (what, REF, str(o[k])[-400:], str(n[k])[-400:]))
if o["files"] != n["files"]: fail("ca 1 (không cờ): file trong --out khác bản T-064 (%d vs %d file)" % (len(o["files"]), len(n["files"])))
if n["wb"]: fail("ca 1: không cờ mà Wayback giả nhận %d yêu cầu" % n["wb"])
if "PROGRESS" not in n["stdout"]: fail("ca 1: eval cần >= 100 URL để có dòng PROGRESS")

# Ca 2: dừng sớm
paths2 = ["/dead/%d" % i for i in range(60)]
ex2 = ["--workers", "4", "--retries", "0"]
ents2 = lambda e: {e.url("/ok/small.png?x"): ok_entry("v/zzz-000000000000.webp")}
o, n = pair(paths2, ents2, lambda e: [], ex2)
if o["code"] != 4: fail("ca 2: bản T-064 phải dừng sớm mã 4, thấy %s; eval cần xem lại" % o["code"])
last = lambda s: [l for l in s.splitlines() if l.startswith("SUMMARY")][-1:]
if n["code"] != 4 or last(n["stdout"]) != last(o["stdout"]):
    fail("ca 2 (không cờ, dừng sớm): mã/SUMMARY khác T-064: %s %s vs %s %s" % (o["code"], last(o["stdout"]), n["code"], last(n["stdout"])))
if n["after"] != n["before"]: fail("ca 2: mã 4 mà manifest đổi")
if any(h.startswith("/dead/") and int(h.split("/")[2]) >= 50 for h in n["hits"]): fail("ca 2: URL 51+ bị gọi khi dừng sớm")
ok("không cờ --fallback: mã, stdout, manifest, file, yêu cầu nguồn gốc giống hệt T-064 (7569b74); dừng sớm giống hệt")
