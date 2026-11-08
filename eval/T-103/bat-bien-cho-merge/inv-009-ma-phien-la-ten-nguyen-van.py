#!/usr/bin/env python3
"""Bất biến hq/ledger INV-009 · nguồn: T-103 adv-01 (adversary, Code Gate 2026-11-08; spec T-101 mục 4, 5).
Mã phiên là tên file nguyên văn, không phải mẫu glob:
  `scripts/cost.py backfill <mã>` với mã chứa ký tự glob (`*`, `?`, `[..]`) mà không có file `<mã>.jsonl` đúng tên
  → (a) `--dry-run` thoát 1, không in PENDING; (b) chạy thật thoát 1, sổ cái không đổi byte nào;
  (c) sổ cái không bao giờ có src.session chứa ký tự glob; (d) đối chứng: mã thật vẫn bù được (thoát 0, có sự kiện).
Lý do: glob khớp transcript của phiên khác → ghi tiền dưới mã sai, backfill mã thật sau đó ghi lại → đếm trùng tiền thật.
Gác ngoài bể theo ADR-028 tới khi PR T-103 merge. Chạy trên sổ cái tạm (TOHONG_ROOT) và HOME giả."""
import json, os, pathlib, subprocess, sys, tempfile, time


def find_repo():
    for p in pathlib.Path(__file__).resolve().parents:
        if (p / "scripts" / "cost.py").exists() and (p / "eval").is_dir():
            return p
    raise SystemExit("FAIL không tìm thấy scripts/cost.py")


COST = find_repo() / "scripts" / "cost.py"
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
    old = time.time() - 3600
    os.utime(path, (old, old))
    return path


with tempfile.TemporaryDirectory(prefix="inv009-") as tmp:
    d = pathlib.Path(tmp)
    root = d / "hq"; (root / "ledger").mkdir(parents=True); (root / "board").mkdir()
    ledger = root / "ledger" / "events.jsonl"; ledger.write_text("", encoding="utf-8")
    home = d / "home"; launch = d / "launch"; launch.mkdir()
    proj = home / ".claude" / "projects" / "-home-user"
    sid = "only-one"
    write(proj / f"{sid}.jsonl", "Phiên thử", [f"{sid}-m{i}" for i in range(3)])
    write(proj / sid / "subagents" / "agent-sa1.jsonl", "Giao việc thử", [f"{sid}-sa1-m{i}" for i in range(2)],
          attr="engineering")
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDE", "TOHONG"))}
    env.update(TOHONG_ROOT=str(root), HOME=str(home), PATH=os.environ.get("PATH", ""))

    def run(*args):
        return subprocess.run([sys.executable, str(COST), "backfill", *args], text=True, capture_output=True,
                              cwd=str(launch), env=env, timeout=60)

    for bad in ("*", "only-on?", "only-on[e]", "only*"):
        r = run(bad, "--dry-run")
        if r.returncode != 1 or "PENDING" in r.stdout:
            fails.append(f"(a) dry-run {bad!r}: cần thoát 1 không PENDING, được {r.returncode} {r.stdout.strip()[:40]!r}")
        before = ledger.read_bytes()
        r = run(bad)
        if r.returncode != 1 or ledger.read_bytes() != before:
            fails.append(f"(b) backfill {bad!r}: cần thoát 1 và sổ cái không đổi, được thoát {r.returncode}, "
                         f"đổi={ledger.read_bytes() != before}")

    events = [json.loads(l) for l in ledger.read_text(encoding="utf-8").splitlines() if l.strip()]
    globby = [e["src"]["session"] for e in events
              if isinstance(e.get("src"), dict) and any(c in str(e["src"].get("session", "")) for c in "*?[")]
    if globby:
        fails.append(f"(c) sổ cái có src.session chứa ký tự glob: {sorted(set(globby))}")

    r = run(sid)
    n = sum(1 for l in ledger.read_text(encoding="utf-8").splitlines() if l.strip() and json.loads(l).get("event") == "cost")
    if r.returncode != 0 or n == 0:
        fails.append(f"(d) đối chứng: backfill {sid} cần thoát 0 và có sự kiện cost, được thoát {r.returncode}, {n} sự kiện")

if fails:
    print("FAIL " + "; ".join(fails)); sys.exit(1)
print("PASS")
