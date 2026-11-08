#!/usr/bin/env python3
"""Bất biến hq/ledger INV-008 · nguồn: T-101 (Spec Gate v2 2026-11-08, spec-critic rút từ mục "Bất biến đề xuất" của
products/T-101-cost-hook-phien-cloud.md, mục 2-4 Hành vi).
Hook chi phí độc lập thư mục mở phiên và chạy lại không ghi trùng:
  `scripts/cost.py hook` chạy với cwd khác repo, không có biến CLAUDE_*, HOME lạ,
  (a) cùng một payload SubagentStop gửi hai lần → đúng MỘT sự kiện `cost` cho subagent đó, src có đủ session/agent/msgs/last;
  (b) cùng một payload Stop gửi hai lần, rồi SessionEnd → đúng MỘT sự kiện `cost` cho phiên chính (src.agent = "main");
  mọi lần gọi: thoát 0, stdout rỗng (Stop hook đọc stdout như quyết định).
Chạy trên sổ cái tạm qua TOHONG_ROOT; không bao giờ chạm ledger/ thật."""
import json, os, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[4]
COST = REPO / "scripts" / "cost.py"
fails = []


def asst(mid):
    return {"type": "assistant", "uuid": "u-" + mid, "timestamp": "2026-11-08T08:00:00.000Z",
            "message": {"id": mid, "model": "claude-sonnet-5-5", "stop_reason": "end_turn",
                        "usage": {"input_tokens": 1000, "output_tokens": 500,
                                  "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}}}


def write(path, first_user, mids, attr=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    u = {"type": "user", "uuid": "u0", "message": {"role": "user", "content": first_user}}
    if attr:
        u["attributionAgent"] = attr
    path.write_text("".join(json.dumps(r) + "\n" for r in [u] + [asst(m) for m in mids]), encoding="utf-8")
    return path


with tempfile.TemporaryDirectory(prefix="inv008-") as tmp:
    d = pathlib.Path(tmp)
    root = d / "hq"; (root / "ledger").mkdir(parents=True); (root / "board").mkdir()
    ledger = root / "ledger" / "events.jsonl"; ledger.write_text("", encoding="utf-8")
    home = d / "home"; launch = d / "launch"; launch.mkdir()
    proj = home / ".claude" / "projects" / "-home-user"
    sid = "inv008-sess"
    main = write(proj / f"{sid}.jsonl", "Phiên thử", [f"{sid}-m{i}" for i in range(3)])
    sub = write(proj / sid / "subagents" / "agent-sa1.jsonl", "Giao việc thử", [f"{sid}-sa1-m{i}" for i in range(2)],
                attr="engineering")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDE", "TOHONG"))}
    env.update(TOHONG_ROOT=str(root), HOME=str(home), PATH=os.environ.get("PATH", ""))

    def hook(payload):
        r = subprocess.run([sys.executable, str(COST), "hook"], input=json.dumps(payload), text=True,
                           capture_output=True, cwd=str(launch), env=env, timeout=60)
        if r.returncode != 0 or r.stdout.strip():
            fails.append(f"{payload['hook_event_name']}: thoát {r.returncode}, stdout {r.stdout[:60]!r}")

    def costs():
        return [e for e in (json.loads(l) for l in ledger.read_text(encoding="utf-8").splitlines() if l.strip())
                if e.get("event") == "cost"]

    base = {"session_id": sid, "transcript_path": str(main), "cwd": str(launch)}
    sa = dict(base, hook_event_name="SubagentStop", agent_id="sa1", agent_type="engineering",
              agent_transcript_path=str(sub), stop_hook_active=False)
    hook(sa); hook(sa)
    ev = [e for e in costs() if (e.get("src") or {}).get("agent") == "sa1"]
    if len(ev) != 1:
        fails.append(f"(a) SubagentStop gửi hai lần: cần đúng 1 sự kiện cost cho sa1, có {len(ev)}")
    elif not {"session", "agent", "msgs", "last"} <= set(ev[0].get("src") or {}) or not ev[0].get("cost"):
        fails.append(f"(a) sự kiện thiếu src đủ khoá hoặc cost = 0: {ev[0].get('src')} {ev[0].get('cost')}")

    hook(dict(base, hook_event_name="Stop")); hook(dict(base, hook_event_name="Stop"))
    hook(dict(base, hook_event_name="SessionEnd"))
    ev = costs()
    m = [e for e in ev if (e.get("src") or {}).get("agent") == "main"]
    s = [e for e in ev if (e.get("src") or {}).get("agent") == "sa1"]
    if len(m) != 1 or len(s) != 1 or len(ev) != 2:
        fails.append(f"(b) Stop hai lần + SessionEnd: cần đúng 1 main + 1 sa1, có main={len(m)} sa1={len(s)} tổng={len(ev)}")

if fails:
    print("FAIL " + "; ".join(fails)); sys.exit(1)
print("PASS")
