#!/usr/bin/env python3
"""Bất biến hq/ledger INV-010 · nguồn: T-103 adv-02 (adversary, Code Gate 2026-11-08; spec T-101 mục 2-3, 6, 8).
Công cụ chi phí chịu được dòng cuối transcript ghi dở, kể cả khi bị cắt giữa một ký tự UTF-8 nhiều byte (tiếng Việt):
dòng đó bị bỏ như dòng JSON hỏng, phần còn lại vẫn tính.
  (a) `cost.py report <transcript>`: thoát 0, không traceback, in "Tổng:".
  (b) `cost.py backfill <phiên> --dry-run`: không traceback; in `PENDING msgs=5` (3 tin chính + 2 subagent) và thoát 1.
  (c) `cost.py hook` Stop: thoát 0, stdout rỗng, đúng một sự kiện cost cho phiên chính với src.msgs = 3,
      không có cost_warning.
Gác ngoài bể theo ADR-028 tới khi PR T-103 merge. Chạy trên sổ cái tạm (TOHONG_ROOT) và HOME giả."""
import json, os, pathlib, subprocess, sys, tempfile, time


def find_repo():
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / "scripts" / "cost.py").exists() and (p / "eval").is_dir():
            return p
    raise SystemExit("FAIL không tìm thấy scripts/cost.py")


COST = find_repo() / "scripts" / "cost.py"
CUT = '{"type":"user","message":{"content":"Chào anh chị'.encode("utf-8")[:-1]   # cắt giữa chữ "ị"
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
    path.write_bytes("".join(json.dumps(r) + "\n" for r in [u] + [asst(m) for m in mids]).encode("utf-8") + CUT)
    old = time.time() - 3600
    os.utime(path, (old, old))
    return path


with tempfile.TemporaryDirectory(prefix="inv010-") as tmp:
    d = pathlib.Path(tmp)
    root = d / "hq"; (root / "ledger").mkdir(parents=True); (root / "board").mkdir()
    ledger = root / "ledger" / "events.jsonl"; ledger.write_text("", encoding="utf-8")
    home = d / "home"; launch = d / "launch"; launch.mkdir()
    proj = home / ".claude" / "projects" / "-home-user"
    sid = "inv010-sess"
    main = write(proj / f"{sid}.jsonl", "Phiên thử", [f"{sid}-m{i}" for i in range(3)])
    write(proj / sid / "subagents" / "agent-sa1.jsonl", "Giao việc thử", [f"{sid}-sa1-m{i}" for i in range(2)],
          attr="engineering")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDE", "TOHONG"))}
    env.update(TOHONG_ROOT=str(root), HOME=str(home), PATH=os.environ.get("PATH", ""))

    def run(args, stdin=None):
        return subprocess.run([sys.executable, str(COST), *args], input=stdin, text=True, capture_output=True,
                              cwd=str(launch), env=env, timeout=60)

    r = run(["report", str(main)])
    if r.returncode != 0 or "Traceback" in r.stderr or "Tổng:" not in r.stdout:
        fails.append(f"(a) report: thoát {r.returncode}, traceback={'Traceback' in r.stderr}")

    before = ledger.read_bytes()
    r = run(["backfill", sid, "--dry-run"])
    if "Traceback" in r.stderr or r.returncode != 1 or r.stdout.strip().split(" usd=")[0] != "PENDING msgs=5":
        fails.append(f"(b) backfill --dry-run: thoát {r.returncode}, stdout {r.stdout.strip()[:40]!r}, "
                     f"traceback={'Traceback' in r.stderr}")
    if ledger.read_bytes() != before:
        fails.append("(b) dry-run làm đổi sổ cái")

    payload = {"session_id": sid, "transcript_path": str(main), "cwd": str(launch), "hook_event_name": "Stop"}
    r = run(["hook"], json.dumps(payload))
    if r.returncode != 0 or r.stdout.strip():
        fails.append(f"(c) hook Stop: thoát {r.returncode}, stdout {r.stdout[:60]!r}")
    ev = [json.loads(l) for l in ledger.read_text(encoding="utf-8").splitlines() if l.strip()]
    m = [e for e in ev if e.get("event") == "cost" and (e.get("src") or {}).get("agent") == "main"]
    w = [e for e in ev if e.get("event") == "cost_warning"]
    if len(m) != 1 or (m[0]["src"].get("msgs") != 3) or w:
        fails.append(f"(c) hook Stop: cần 1 sự kiện cost main msgs=3 và 0 cost_warning, có main={len(m)} "
                     f"msgs={[e['src'].get('msgs') for e in m]} warning={len(w)}")

if fails:
    print("FAIL " + "; ".join(fails)); sys.exit(1)
print("PASS")
