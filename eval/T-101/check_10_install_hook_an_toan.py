#!/usr/bin/env python3
"""T-101 tiêu chí 10 (mục 1 spec): install-hook an toàn.
(a) file settings chưa tồn tại (ca thật: /root/.claude/settings.json không có) → tạo mới, kể cả thư mục cha, chỉ có khoá `hooks`;
(b) chỉ chạm khoá `hooks`: `permissions`, `env`, khoá khác, hook của sự kiện khác, hook không phải cost trong SubagentStop/Stop/SessionEnd giữ nguyên;
(c) đã có hook `cost.py hook` ở đường dẫn khác → THAY bằng đường dẫn repo này, mỗi sự kiện còn đúng một hook cost, chạy lại không đổi byte;
(d) không chạm launcher-settings.json (file do launcher ghi, chứa git-check);
(e) không bao giờ tự chạy: hook / backfill / sync / report không tạo hay sửa settings.json."""
import sys, pathlib, json, os
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
fails = []; EVS = ("SubagentStop", "Stop", "SessionEnd")
want = str(pathlib.Path(lib.COST).resolve())
def cost_hooks(s, ev): return [h["command"] for g in s.get("hooks", {}).get(ev, []) for h in g.get("hooks", []) if "cost.py" in h.get("command", "")]
def check_one_each(s, tag):
    for ev in EVS:
        c = cost_hooks(s, ev)
        if len(c) != 1 or want not in c[0] or not c[0].rstrip().endswith("hook"): fails.append(f"{tag} {ev}: cần đúng 1 hook cost trỏ {want}, có {c}")

b = lib.Box(); cl = b.home / ".claude"
launcher = cl / "launcher-settings.json"
launcher.write_text(json.dumps({"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "~/.claude/stop-hook-git-check.sh"}]}]}}), encoding="utf-8")
lsnap = launcher.read_bytes()

# (a) chưa có file: đường dẫn mặc định, rồi --settings vào thư mục chưa tồn tại
dflt = cl / "settings.json"; assert not dflt.exists()
r = b.run(["install-hook"])
if r.returncode != 0 or not dflt.exists(): fails.append(f"(a) file chưa có: thoát {r.returncode}, file tồn tại={dflt.exists()}; cần tạo mới")
else:
    s = json.loads(dflt.read_text(encoding="utf-8"))
    if set(s) != {"hooks"}: fails.append(f"(a) file mới chỉ được có khoá hooks, có {sorted(s)}")
    check_one_each(s, "(a)")
if launcher.read_bytes() != lsnap: fails.append("(d) đã sửa launcher-settings.json")
deep = b.d / "chua" / "co" / "settings.json"
r = b.run(["install-hook", "--settings", str(deep)])
if r.returncode != 0 or not deep.exists(): fails.append("(a) --settings vào thư mục chưa tồn tại: phải tạo cả thư mục cha")

# (b)+(c) file có đủ thứ, kèm hook cost ở đường dẫn khác
git = {"type": "command", "command": "~/.claude/stop-hook-git-check.sh"}
other = {"type": "command", "command": "echo xong"}
pre = {"matcher": "Bash", "hooks": [{"type": "command", "command": "~/bin/guard.sh"}]}
orig = {"permissions": {"allow": ["Bash(git status:*)", "Read(*)"], "deny": ["Bash(rm -rf:*)"], "defaultMode": "acceptEdits"},
        "env": {"FOO": "bar"}, "theme": "dark", "model": "x",
        "hooks": {"PreToolUse": [pre],
                  "Stop": [{"hooks": [git, {"type": "command", "command": "python3 /old/place/scripts/cost.py hook"}]}],
                  "SessionEnd": [{"hooks": [other]}, {"hooks": [{"type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/scripts/cost.py\" hook"}]}]}}
sp = b.home / "s2.json"; sp.write_text(json.dumps(orig, indent=2), encoding="utf-8")
r = b.run(["install-hook", "--settings", str(sp)])
if r.returncode != 0: fails.append(f"(b) thoát {r.returncode}: {(r.stderr or r.stdout)[:100]}")
else:
    s = json.loads(sp.read_text(encoding="utf-8"))
    for k in ("permissions", "env", "theme", "model"):
        if s.get(k) != orig[k]: fails.append(f"(b) khoá {k!r} bị đổi: {s.get(k)!r}")
    if s["hooks"].get("PreToolUse") != [pre]: fails.append("(b) hook PreToolUse bị đổi")
    flat = lambda ev: [h for g in s["hooks"].get(ev, []) for h in g.get("hooks", [])]
    if git not in flat("Stop"): fails.append("(b) mất hook git-check trong Stop")
    if other not in flat("SessionEnd"): fails.append("(b) mất hook echo trong SessionEnd")
    check_one_each(s, "(c)")
    txt = sp.read_text(encoding="utf-8")
    if "/old/place" in txt or "CLAUDE_PROJECT_DIR" in txt: fails.append("(c) hook cost cũ còn nguyên (phải thay bằng đường dẫn repo này)")
    snap = sp.read_bytes(); b.run(["install-hook", "--settings", str(sp)])
    if sp.read_bytes() != snap: fails.append("(c) chạy lần hai làm đổi file")

# (e) không tự chạy
b2 = lib.Box(); sid = "sess-10"; main, subs = b2.session(sid)
d2 = b2.home / ".claude"; snapdir = sorted(p.relative_to(d2).as_posix() for p in d2.rglob("*") if p.is_file())
for a, sin in ((["hook"], json.dumps(b2.payload("Stop", sid, main))), (["backfill", sid], None), (["backfill", sid, "--dry-run"], None),
               (["sync", str(main)], None), (["report", str(main)], None)):
    b2.run(a, sin)
if (d2 / "settings.json").exists(): fails.append("(e) hook/backfill/sync/report đã tạo settings.json (install-hook không được tự chạy)")
if (d2 / "launcher-settings.json").exists(): fails.append("(e) lệnh khác đã tạo launcher-settings.json")
lib.finish(fails)
