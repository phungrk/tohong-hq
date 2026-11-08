#!/usr/bin/env python3
"""T-101 tiêu chí 1: hook có mặt kể cả khi phiên mở ở thư mục không phải tohong-hq.
`cost.py install-hook` (mặc định ghi $HOME/.claude/settings.json; --settings FILE đổi nơi ghi) đăng ký cost.py hook cho
SubagentStop, Stop, SessionEnd bằng đường dẫn tuyệt đối tới cost.py của repo này (không dùng $CLAUDE_PROJECT_DIR),
giữ nguyên mọi khoá/hook có sẵn, chạy lại không đổi byte nào, file JSON hỏng thì từ chối (thoát khác 0, không ghi đè).
Rồi giả lập phiên mở ở thư mục lạ (cwd=CLAUDE_PROJECT_DIR=launch, không có .claude/ ở đó): chạy đúng lệnh đã đăng ký
với payload SubagentStop → có đúng một sự kiện cost."""
import json, subprocess, sys, pathlib, os
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); sid = "sess-1"; fails = []
sp = b.home / ".claude" / "settings.json"
git = {"type": "command", "command": "~/.claude/stop-hook-git-check.sh"}
sp.write_text(json.dumps({"theme": "dark", "hooks": {"Stop": [{"hooks": [git]}]}}), encoding="utf-8")
r = b.run(["install-hook"])
if r.returncode != 0:
    fails.append(f"install-hook thoát {r.returncode}: {(r.stderr or r.stdout).strip().splitlines()[-1][:100] if (r.stderr or r.stdout).strip() else ''}")
    lib.finish(fails)
s = json.loads(sp.read_text(encoding="utf-8"))
if s.get("theme") != "dark": fails.append("làm mất khoá có sẵn 'theme'")
want = str(pathlib.Path(lib.COST).resolve())
cmds = {}
for ev in ("SubagentStop", "Stop", "SessionEnd"):
    c = [h["command"] for g in s.get("hooks", {}).get(ev, []) for h in g.get("hooks", []) if "cost.py" in h.get("command", "")]
    if len(c) != 1: fails.append(f"{ev}: cần đúng 1 hook cost.py, có {len(c)}")
    else:
        cmds[ev] = c[0]
        if want not in c[0] or not c[0].rstrip().endswith("hook"): fails.append(f"{ev}: lệnh không trỏ {want} ... hook: {c[0]}")
        if "CLAUDE_PROJECT_DIR" in c[0]: fails.append(f"{ev}: còn phụ thuộc CLAUDE_PROJECT_DIR")
if git not in [h for g in s.get("hooks", {}).get("Stop", []) for h in g.get("hooks", [])]: fails.append("làm mất hook Stop có sẵn")
snap = sp.read_bytes(); b.run(["install-hook"])
if sp.read_bytes() != snap: fails.append("chạy lần hai làm đổi file (không idempotent)")
bad = b.home / "bad.json"; bad.write_text("{khong phai json", encoding="utf-8")
r = b.run(["install-hook", "--settings", str(bad)])
if r.returncode == 0 or bad.read_text(encoding="utf-8") != "{khong phai json": fails.append("file JSON hỏng: phải từ chối và giữ nguyên")
if "SubagentStop" in cmds:
    main, subs = b.session(sid)
    pl = b.payload("SubagentStop", sid, main, "sa1", "engineering", subs["sa1"])
    env = b.env(CLAUDE_PROJECT_DIR=str(b.launch))
    p = subprocess.run(cmds["SubagentStop"], shell=True, input=json.dumps(pl), text=True, capture_output=True,
                       cwd=str(b.launch), env=env, timeout=60)
    n = len(b.events())
    if p.returncode != 0 or n != 1: fails.append(f"chạy lệnh đã đăng ký từ thư mục lạ: thoát {p.returncode}, {n} sự kiện (cần 1)")
lib.finish(fails)
