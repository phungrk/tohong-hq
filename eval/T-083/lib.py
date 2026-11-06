"""Thư viện eval T-083: sổ cái tạm (TOHONG_ROOT) + TOHONG_NOW cố định; dùng lại dựng sổ cái của eval/T-076."""
import json, os, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "eval" / "T-076"))
from _export_lib import build, handoff_event, ev, export, by_task, NOW  # noqa: E402,F401

PR_A = "https://github.com/phungrk/tohong-hq/pull/26"
PR_B = "https://github.com/phungrk/tohong-front/pull/5"
FIELDS = ("state", "holder", "owner", "tier", "rounds", "version", "prev_state")


def task_cmd(fake, *args, now=NOW):
    env = dict(os.environ, TOHONG_ROOT=str(fake), TOHONG_NOW=now)
    return subprocess.run([sys.executable, str(ROOT / "scripts" / "task.py"), *args], capture_output=True, text=True, env=env)


def events(fake):
    p = Path(fake) / "ledger" / "events.jsonl"
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def front(fake, tid):
    t = (Path(fake) / "board" / f"{tid}.md").read_text(encoding="utf-8")
    return {k: v.strip().strip('"') for k, v in re.findall(r"(?m)^(%s):\s*(.*)$" % "|".join(FIELDS), t)}


class Checker:
    def __init__(self): self.bad = []
    def chk(self, c, m):
        if not c: self.bad.append(m)
    def done(self):
        if self.bad:
            for b in self.bad: print("FAIL " + b)
            sys.exit(1)
        print("PASS")
