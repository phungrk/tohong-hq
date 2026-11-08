"""Helper dùng chung cho eval T-101 (không phải eval; gate.py không chạy file này).
Dựng sổ cái tạm + transcript giả giống thật, gọi scripts/cost.py như Claude Code gọi hook:
JSON ở stdin, cwd khác tohong-hq, CLAUDE_PROJECT_DIR không đặt. Không bao giờ chạm ledger/ thật:
mọi lệnh chạy với TOHONG_ROOT trỏ vào thư mục tạm."""
import json, os, pathlib, shutil, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
COST = REPO / "scripts" / "cost.py"
IN_RATE = OUT_RATE = None


def _rates():
    m = json.loads((REPO / "scripts" / "pricing.json").read_text(encoding="utf-8"))["models"]["claude-sonnet-5-5"]
    return m["input"], m["output"]


def usd(n_msgs, inp=1000, out=500):
    i, o = _rates()
    return n_msgs * (inp * i + out * o) / 1e6


class Box:
    """Thư mục tạm: root (sổ cái giả), home (HOME giả), launch (cwd ≠ tohong-hq), projects (transcript)."""
    def __init__(self):
        self.d = pathlib.Path(tempfile.mkdtemp(prefix="t101-"))
        self.root = self.d / "hq"; (self.root / "ledger").mkdir(parents=True); (self.root / "board").mkdir()
        shutil.copy(REPO / "board" / "T-101.md", self.root / "board" / "T-101.md")
        (self.root / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
        self.home = self.d / "home"; (self.home / ".claude" / "projects" / "-home-user").mkdir(parents=True)
        self.launch = self.d / "launch"; self.launch.mkdir()
        self.proj = self.home / ".claude" / "projects" / "-home-user"
        self.n = 0

    def env(self, **extra):
        e = {k: v for k, v in os.environ.items() if not k.startswith(("CLAUDE", "TOHONG"))}
        e.update(TOHONG_ROOT=str(self.root), HOME=str(self.home), PATH=os.environ.get("PATH", ""))
        e.update(extra)
        return e

    def run(self, args, stdin=None, cwd=None):
        return subprocess.run([sys.executable, str(COST)] + args, input=stdin, text=True, capture_output=True,
                              cwd=str(cwd or self.launch), env=self.env(), timeout=60)

    def hook(self, payload, cwd=None):
        return self.run(["hook"], json.dumps(payload), cwd)

    def events(self, kind="cost"):
        p = self.root / "ledger" / "events.jsonl"
        return [e for e in (json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip())
                if e.get("event") == kind]

    def ledger_bytes(self):
        return (self.root / "ledger" / "events.jsonl").read_bytes()

    # ---- transcript giả ----
    def _asst(self, mid, stop="end_turn", dup=False):
        self.n += 1
        row = {"type": "assistant", "uuid": f"u{self.n}", "timestamp": f"2026-11-08T08:{self.n % 60:02d}:00.000Z",
               "message": {"id": mid, "model": "claude-sonnet-5-5", "stop_reason": stop,
                           "usage": {"input_tokens": 1000, "output_tokens": 500, "cache_read_input_tokens": 0,
                                     "cache_creation_input_tokens": 0}}}
        return [row, dict(row, uuid=row["uuid"] + "b")] if dup else [row]   # một tin ghi 2 dòng cùng usage

    def write(self, path, first_user, mids, tail_unfinished=False, attr=None):
        path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
        rows = [{"type": "user", "uuid": "u0", "message": {"role": "user", "content": first_user}}]
        if attr: rows[0]["attributionAgent"] = attr
        for k, mid in enumerate(mids):
            last = tail_unfinished and k == len(mids) - 1
            rows += self._asst(mid, None if last else "end_turn", dup=(k == 0))
        path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
        return path

    def write_stops(self, path, first_user, seq, attr=None):
        """seq = [(message.id, stop_reason hoặc None)]: tự đặt tin rỗng ở bất kỳ vị trí nào."""
        path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
        rows = [{"type": "user", "uuid": "u0", "message": {"role": "user", "content": first_user}}]
        if attr: rows[0]["attributionAgent"] = attr
        for mid, stop in seq:
            rows += self._asst(mid, stop)
        path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
        return path

    def age(self, *paths, secs=3600):
        """Đặt mtime lùi secs giây (phiên đã kết thúc từ lâu)."""
        t = __import__("time").time() - secs
        for p in paths:
            os.utime(p, (t, t))

    def append(self, path, mids):
        with open(path, "a", encoding="utf-8") as f:
            for mid in mids:
                for r in self._asst(mid):
                    f.write(json.dumps(r) + "\n")

    def session(self, sid, main_msgs=3, subs=(("sa1", "engineering", "T-101", 2), ("sa2", "reviewer", "T-101", 4)),
                tail_unfinished=False):
        """Phiên cloud mở ở /home/user: transcript ở projects/-home-user/<sid>.jsonl."""
        main = self.write(self.proj / f"{sid}.jsonl", "Việc T-101", [f"{sid}-m{i}" for i in range(main_msgs)],
                          tail_unfinished=tail_unfinished)
        subp = {}
        for aid, typ, tid, n, *unf in subs:
            subp[aid] = self.write(self.proj / sid / "subagents" / f"agent-{aid}.jsonl", f"Giao việc {tid}: làm đi",
                                   [f"{sid}-{aid}-m{i}" for i in range(n)], attr=typ,
                                   tail_unfinished=bool(unf and unf[0]))
        return main, subp

    def payload(self, event, sid, main, agent=None, agent_type=None, agent_path=None):
        p = {"session_id": sid, "transcript_path": str(main), "cwd": str(self.launch), "hook_event_name": event}
        if agent:
            p.update(agent_id=agent, agent_type=agent_type, agent_transcript_path=str(agent_path),
                     stop_hook_active=False)
        return p


def ranges_ok(events):
    """Mỗi (phiên, agent): src.msgs tăng chặt theo thứ tự ghi, tức khoảng tin không chồng nhau. Trả về danh sách lỗi."""
    bad, last = [], {}
    for e in events:
        s = e["src"]; k = (s["session"], s["agent"])
        if s["msgs"] <= last.get(k, 0): bad.append(f"{k} msgs {last.get(k, 0)}→{s['msgs']}")
        last[k] = s["msgs"]
    return bad


def finish(fails):
    if fails:
        print("FAIL " + "; ".join(fails)); sys.exit(1)
    print("PASS")
