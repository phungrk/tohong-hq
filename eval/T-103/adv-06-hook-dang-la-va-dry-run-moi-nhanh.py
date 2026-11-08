#!/usr/bin/env python3
"""T-103 adv-06 (tầng 3). Spec T-101 mục 1 (thay hook cost.py cũ, đúng một) và mục 6 (dry-run không ghi gì).
Input: hook cost viết dạng lạ (đường dẫn tương đối, `python` thay `python3`, có tham số thêm, đường dẫn có dấu cách
trong nháy); dry-run qua mọi nhánh lỗi (không transcript, hai nhánh, con trỏ hỏng, --final phiên đang chạy,
kèm --expect-usd sai). Mong: đúng một hook cost.py mỗi sự kiện, không còn lệnh cũ; dry-run không đổi byte sổ cái."""
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish, COST

fails = []
b = Box()
st = b.home / ".claude" / "settings.json"
old = ["python scripts/cost.py hook --verbose", "python3 '/a b/scripts/cost.py' hook",
       "cd /old && python3 ./scripts/cost.py hook"]
st.write_text(json.dumps({"hooks": {"SubagentStop": [{"hooks": [{"type": "command", "command": c} for c in old]}],
                                    "Stop": [{"hooks": [{"type": "command", "command": old[0], "timeout": 30}]}]}}))
b.run(["install-hook"])
h = json.loads(st.read_text())["hooks"]
for ev in ("SubagentStop", "Stop", "SessionEnd"):
    cmds = [x["command"] for g in h[ev] for x in g["hooks"]]
    if sum(str(COST) in c for c in cmds) != 1 or any(c in old for c in cmds):
        fails.append(f"{ev}: {cmds}")
if h["Stop"][0]["hooks"][0].get("timeout") != 30:
    fails.append("khoá timeout của hook cost cũ bị mất")

# dry-run mọi nhánh: sổ cái không đổi byte
b = Box()
main, subs = b.session("s-dry"); b.age(main, *subs.values())
b.run(["backfill", "s-dry"]); b.append(main, ["s-dry-x1"])
cases = [["backfill", "khong-co", "--dry-run"],
         ["backfill", "s-dry", "--dry-run", "--final"],
         ["backfill", "s-dry", "--dry-run", "--expect-usd", "9.9999"]]
for c in cases:
    before = b.ledger_bytes(); r = b.run(c)
    if b.ledger_bytes() != before:
        fails.append(f"{c}: sổ cái đổi")
# con trỏ hỏng + nhánh khác
sa = subs["sa1"]; sa.write_text(sa.read_text().replace("s-dry-sa1-m1", "s-dry-sa1-zz"))
b.write(b.home / ".claude" / "projects" / "-other" / "s-dry.jsonl", "x", ["lạ-1"])
before = b.ledger_bytes(); r = b.run(["backfill", "s-dry", "--dry-run"])
if b.ledger_bytes() != before or r.returncode != 2 or "PENDING" in r.stdout:
    fails.append(f"nhánh lỗi: thoát {r.returncode}, stdout {r.stdout.strip()!r}, đổi={b.ledger_bytes() != before}")
finish(fails)
