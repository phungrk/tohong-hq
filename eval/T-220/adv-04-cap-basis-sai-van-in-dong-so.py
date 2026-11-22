"""T-220 adv-04 (spec Hành vi 10, Hành vi 1): chạy thật (`--stage measure`, không --dry-run) với `--cap-basis` gõ sai (workflow nhận chuỗi tự do, vd "NET"): CLI dừng
trước mọi lượt gọi, nhưng như mọi lần dừng sớm, hai dòng cuối stdout phải là GOOGLE_USAGE rồi GEMINI_USAGE (0 lượt). Nếu không, log -run-<id>- của lần chạy REAL này
không có dòng nào đếm được, read_usage coi là log hỏng (USAGE_LOG_UNREADABLE) và mọi lần chạy Google thật kế tiếp (enrich-vendors, P0) bị chặn."""
import os, subprocess, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _adv import T, env  # noqa: E402

bad = []
files, removed, fx, meta = T.world()
for val in ("NET", "gross "):
    r = T.Root(files, removed)
    args = T.std_args()
    args += ["--cap-basis", val]
    rc, out, calls = r.run(args, fx, run_id="4242", env_extra=env())
    if calls:
        bad.append("%r: %d lượt gọi" % (val, len(calls)))
    lines = [l for l in out.splitlines() if l.strip()]
    if len(lines) < 2 or not lines[-2].startswith("GOOGLE_USAGE run=4242") or not lines[-1].startswith("GEMINI_USAGE run=4242"):
        bad.append("%r: rc=%d, hai dòng cuối không phải GOOGLE_USAGE/GEMINI_USAGE: %s" % (val, rc, lines[-2:]))
    chk = subprocess.run([sys.executable, "-c", "import sys;from pathlib import Path;from enrichment import usage as u;"
                          "x=u.read_usage(Path('run-logs'), sys.argv[1]);print('UNREADABLE' if x.unreadable else 'OK')", T.datetime.datetime.now(T.datetime.timezone.utc).strftime("%Y-%m")],
                         cwd=r.path, capture_output=True, text=True)
    if "OK" not in chk.stdout:
        bad.append("%r: log của lần chạy REAL bị read_usage coi là hỏng (%s)" % (val, (chk.stdout + chk.stderr).strip()[-120:]))
T.done(bad, "cap-basis sai: dừng 0 lượt và vẫn in hai dòng sổ, log đọc được")
