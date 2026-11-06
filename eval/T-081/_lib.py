"""Thư viện eval T-081: dùng lại dựng sổ cái giả của eval/T-076 và thêm trường `issue` vào board (mẫu T-041 không có trường này)."""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "eval" / "T-076"))
from _export_lib import build, handoff_event, ev, export, by_task, NOW  # noqa: E402,F401

GH = "https://github.com/phungrk/"
ISSUE = GH + "tohong-hq/issues/"
DRB = GH + "tohong-hq/blob/main/inbox/capu/"
DIR = GH + "tohong-hq/tree/main/inbox/capu"


def set_issue(fake, tid, raw):
    """Ghi dòng `issue: <raw>` vào frontmatter board (raw đúng như file thật: `12`, `""`, `"13"`, `abc`)."""
    p = Path(fake) / "board" / f"{tid}.md"
    t = p.read_text(encoding="utf-8")
    t = re.sub(r"(?m)^issue:.*\n", "", t, count=1)
    t = re.sub(r"(?m)^(tier:.*)$", lambda m: m.group(1) + f"\nissue: {raw}", t, count=1)
    p.write_text(t, encoding="utf-8")


class Checker:
    def __init__(self): self.bad = []
    def chk(self, c, m):
        if not c: self.bad.append(m)
    def done(self):
        if self.bad:
            for b in self.bad: print("FAIL " + b)
            sys.exit(1)
        print("PASS")
