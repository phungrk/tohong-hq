#!/usr/bin/env python3
"""T-103 adv-07 (tầng 3). Spec T-101 mục 4 (không đếm trùng), mục 9 (backfill tuần tự với hook), mục 10 (--expect-usd).
Input: backfill đọc transcript NGOÀI khoá rồi chờ khoá; trong lúc chờ, transcript mọc thêm tin và một "hook" (giữ khoá)
ghi con trỏ mới cho phiên chính và một subagent, trỏ tới tin mới mà bản đọc của backfill chưa có.
Mong: (a) không cặp (session, agent) nào có khoảng tin chồng nhau; tổng tiền mỗi agent không vượt tiền transcript;
(b) với --expect-usd = số dry-run trước đó: thoát 5 hoặc 2, sổ cái không có sự kiện nào của backfill (số đã duyệt
không còn đúng thì không ghi); (c) chạy lại backfill sau đó thì bù đủ, dry-run ra 0."""
import sys, json, os, pathlib, subprocess, time, re
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish, ranges_ok, usd, COST

HOLDER = r'''
import sys, os, time, json, pathlib
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[2])
import task, cost
from lib import Box
main, sub, ready, go = sys.argv[3:7]
with task.ledger_lock(strict=True):
    open(ready, "w").close()
    while not os.path.exists(go): time.sleep(0.02)      # backfill đã đọc transcript xong, đang chờ khoá
    b = Box.__new__(Box); b.n = 1000
    b.append(main, ["race-m1", "race-m2"]); b.append(sub, ["race-s1"])
    p = cost.load_pricing()
    cost.account(p, main, "s-race", "main", "chief-of-staff", "", True, "hook giả")
    cost.account(p, sub, "s-race", "sa1", "engineering", "", True, "hook giả")
'''

def scenario(extra):
    b = Box()
    main, subs = b.session("s-race"); b.age(main, *subs.values())
    r = b.run(["backfill", "s-race", "--dry-run"])
    exp = re.search(r"usd=([\d.]+)", r.stdout).group(1)
    ready, go = b.d / "ready", b.d / "go"
    env = b.env()
    h = subprocess.Popen([sys.executable, "-c", HOLDER, str(COST.parent), str(pathlib.Path(__file__).resolve().parents[1] / "T-101"),
                          str(main), str(subs["sa1"]), str(ready), str(go)], env=env)
    while not ready.exists(): time.sleep(0.02)
    args = ["backfill", "s-race"] + (["--expect-usd", exp] if extra else [])
    bf = subprocess.Popen([sys.executable, str(COST)] + args, env=env, cwd=str(b.launch),
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    time.sleep(1.5)            # backfill đọc xong transcript nhỏ, đang chờ khoá
    go.touch(); h.wait(timeout=30)
    out, err = bf.communicate(timeout=60)
    return b, main, subs, bf.returncode, out, err

fails = []
# (a) không --expect-usd
b, main, subs, rc, out, err = scenario(False)
ev = b.events()
fails += [f"(a) chồng khoảng: {x}" for x in ranges_ok(ev)]
for agent, n in (("main", 5), ("sa1", 3), ("sa2", 4)):
    got = sum(e["cost"] for e in ev if e["src"]["agent"] == agent)
    if got > usd(n) + 1e-6:
        fails.append(f"(a) {agent}: ghi ${got:.4f} > transcript ${usd(n):.4f} (đếm trùng)")
r = b.run(["backfill", "s-race"]); r2 = b.run(["backfill", "s-race", "--dry-run"])
if "msgs=0" not in r2.stdout:
    fails.append(f"(c) sau khi chạy lại dry-run vẫn {r2.stdout.strip()!r}")
# (b) --expect-usd
b, main, subs, rc, out, err = scenario(True)
bf_ev = [e for e in b.events() if "hook giả" not in e.get("detail", e.get("note", "")) and "hook giả" not in json.dumps(e, ensure_ascii=False)]
if rc not in (2, 5) or bf_ev:
    fails.append(f"(b) --expect-usd: thoát {rc}, {len(bf_ev)} sự kiện của backfill được ghi dù số đã duyệt không còn đúng")
fails += [f"(b) chồng khoảng: {x}" for x in ranges_ok(b.events())]
finish(fails)
