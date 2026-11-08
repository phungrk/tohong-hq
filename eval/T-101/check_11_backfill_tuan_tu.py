#!/usr/bin/env python3
"""T-101 tiêu chí 11 (mục 9 spec): backfill (ghi thật) tuần tự với hook và với backfill khác trên một máy.
(a) khoá sổ cái đang bị giữ quá thời gian chờ (task.ledger_lock chờ 10s rồi vẫn ghi tiếp) → backfill KHÔNG ghi: thoát 3, sổ cái không đổi;
(b) hết bị giữ → backfill chạy bình thường;
(c) 1 backfill + 3 hook Stop + 2 backfill khác chạy đồng thời → mỗi (phiên, agent) khoảng tin không chồng nhau, tổng tiền = tiền transcript, backfill thoát 0."""
import sys, pathlib, subprocess, json, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
fails = []; b = lib.Box(); sid = "sess-11"
main, subs = b.session(sid)
holder = subprocess.Popen([sys.executable, "-c",
    "import sys,time; sys.path.insert(0, %r); import task\n"
    "with task.ledger_lock():\n    print('held', flush=True); time.sleep(14)" % str(lib.REPO / "scripts")],
    stdout=subprocess.PIPE, text=True, env=b.env())
if holder.stdout.readline().strip() != "held": fails.append("eval không giữ được khoá"); lib.finish(fails)
snap = b.ledger_bytes(); t0 = time.time()
r = b.run(["backfill", sid])
if r.returncode != 3 or b.ledger_bytes() != snap: fails.append(f"(a) khoá bị giữ >10s: thoát {r.returncode}, sổ cái đổi={b.ledger_bytes() != snap}; cần thoát 3 và không ghi")
if not r.stderr.strip(): fails.append("(a) phải nói lý do ra stderr")
holder.wait(timeout=30)
r = b.run(["backfill", sid])
if r.returncode != 0 or len(b.events()) != 3: fails.append(f"(b) hết bị giữ: thoát {r.returncode}, {len(b.events())} sự kiện; cần 0 và 3")

b = lib.Box(); main, subs = b.session(sid)
cmd = lambda a: subprocess.Popen([sys.executable, str(lib.COST)] + a, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                 text=True, cwd=str(b.launch), env=b.env())
ps = [cmd(["backfill", sid]), cmd(["hook"]), cmd(["hook"]), cmd(["backfill", sid]), cmd(["hook"]), cmd(["backfill", sid])]
for p in ps:
    if p.args[2] == "hook": p.stdin.write(json.dumps(b.payload("Stop", sid, main)))
    p.stdin.close()
codes = [p.wait(timeout=60) for p in ps]
ev = b.events()
if any(c != 0 for c, p in zip(codes, ps) if p.args[2] == "backfill"): fails.append(f"(c) backfill thoát {codes}; cần 0")
bad = lib.ranges_ok(ev)
if bad: fails.append(f"(c) khoảng tin chồng nhau: {bad}")
if abs(sum(e["cost"] for e in ev) - lib.usd(9)) > 1e-3: fails.append(f"(c) tổng ${sum(e['cost'] for e in ev):.4f}, cần ${lib.usd(9):.4f}")
lib.finish(fails)
