"""T-064 adv-01 (Code Gate, adversary): stdout không được mất dòng khi người đọc ống chậm.

Spec T-058 mục 6(d): khi dừng sớm, in FAILED cho mỗi URL đã xử lý xong mà lỗi, rồi PROGRESS cuối, rồi dòng cuối cùng SUMMARY ... stopped=early.
Mục 2: lần chạy thường in PROGRESS cuối trước SUMMARY. Mục 3/10: stdout đi qua ống (`| tee mirror.log`).
Input phá: đầu ra lớn hơn bộ đệm ống (~64 KiB, ở đây ~3000 dòng FAILED của entry mồ côi) và người đọc ống khựng 2 giây
(runner Actions bận, tee bị nghẽn). Mong đợi: người đọc vẫn nhận đủ mọi dòng, dòng cuối là SUMMARY, số dòng FAILED = failed.
Ca A: 50 ứng viên đều 403 -> mã 4. Ca B: ứng viên đầu ok -> mã 0 (cùng đường thoát).
Chạy: python3 -I eval/T-064/adv-01.py --back /home/user/tohong-back"""
import os, subprocess, sys, shlex
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-058", "lib"))
from t058 import Env, write_manifest, kv, fail, ok, parse_args  # noqa: E402

# Gate gọi file .py không tham số (classify: python3 -I <file>): khi thiếu --back thì lấy TOHONG_BACK_REPO, rồi repo cạnh tohong-hq.
_HQ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
back = (parse_args().get("back") or os.environ.get("TOHONG_BACK_REPO")
        or (os.path.join(os.path.dirname(_HQ), "tohong-back") if os.path.isdir(os.path.join(os.path.dirname(_HQ), "tohong-back")) else None)
        or fail("thiếu --back (hoặc TOHONG_BACK_REPO)"))
N_ORPHAN = 3000


def case(name, paths, expect_code, expect_stop):
    env = Env(paths)
    try:
        orph = {("https://orphan.example.com/" + "x" * 200 + "/%05d.jpg" % i): {"status": "failed", "reason": "http-404", "attempts": 1}
                for i in range(N_ORPHAN)}
        write_manifest(env.manifest, orph)
        out = os.path.join(env.tmp, "stdout.txt")
        cmd = " ".join(shlex.quote(c) for c in env.cmd(back, ["--workers", "4"]))
        sh = f"set -o pipefail; {cmd} | (sleep 2; cat) > {shlex.quote(out)}; echo ${{PIPESTATUS[0]}}"
        p = subprocess.run(["bash", "-c", sh], capture_output=True, text=True, timeout=120)
        code = int(p.stdout.strip().splitlines()[-1])
        if code != expect_code: fail(f"{name}: mã thoát phải {expect_code}, thấy {code}; stderr: {p.stderr[-200:]}")
        lines = open(out, encoding="utf-8", errors="replace").read().splitlines()
        if not lines or not lines[-1].startswith("SUMMARY "):
            fail(f"{name}: người đọc ống chậm không nhận được dòng SUMMARY cuối (nhận {len(lines)} dòng, dòng cuối: {lines[-1][:80] if lines else None!r}); "
                 "stdout bị cắt khi tiến trình thoát (mục 6d, 2)")
        s = kv(lines[-1])
        if expect_stop and s.get("stopped") != "early": fail(f"{name}: SUMMARY thiếu stopped=early: {lines[-1]}")
        nf = sum(1 for l in lines if l.startswith("FAILED "))
        if nf != int(s["failed"]): fail(f"{name}: số dòng FAILED ({nf}) khác failed={s['failed']} của SUMMARY")
        if not any(l.startswith("PROGRESS ") and kv(l).get("done") == str(int(s["ok"]) + int(s["failed"])) for l in lines):
            fail(f"{name}: thiếu dòng PROGRESS cuối khớp SUMMARY")
    finally:
        env.stop()


case("A dừng sớm", ["/forbid/%d" % i for i in range(50)], 4, True)
case("B chạy thường", ["/ok/0.png"] + ["/forbid/%d" % i for i in range(5)], 0, False)
ok("stdout đủ dòng (FAILED, PROGRESS, SUMMARY cuối) dù người đọc ống chậm, cả mã 4 và mã 0")
