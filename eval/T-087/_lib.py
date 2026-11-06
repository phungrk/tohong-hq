"""Helper chung cho eval T-087. Chạy trên sổ cái tạm (TOHONG_ROOT), không đụng board thật."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
BASE = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
bad = []
def chk(c, m):
    if not c: bad.append(m)
def done():
    if bad:
        print("FAIL " + " | ".join(bad)); sys.exit(1)
    print("PASS"); sys.exit(0)
def mk(tmp, boards):
    """boards: {T-xxx: {field: raw frontmatter value (đúng từng byte sau 'k: ')}}"""
    fake = Path(tmp) / "s"
    for d in ("board", "org", "ledger", "inbox/capu", "handoffs"): (fake / d).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    for tid, fields in boards.items():
        b = re.sub(r"(?m)^id:.*$", "id: " + tid, BASE, count=1)
        for k, v in fields.items():
            if re.search(r"(?m)^%s:" % k, b): b = re.sub(r"(?m)^%s:.*$" % k, lambda _m: "%s: %s" % (k, v), b, count=1)
            else: b = b.replace("\n---\n", "\n%s: %s\n---\n" % (k, v), 1)
        (fake / "board" / (tid + ".md")).write_text(b, encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    return fake
def env(fake): return dict(os.environ, TOHONG_ROOT=str(fake), TOHONG_NOW="2026-11-07T12:00")
def run(fake, *argv):
    return subprocess.run([sys.executable, *map(str, argv)], capture_output=True, text=True, env=env(fake), cwd=str(ROOT))
def read(fake, tid):
    """Đọc việc qua read_task của task.py trong sổ cái tạm; trả (meta|None, stderr, tên lớp lỗi|"")."""
    code = ("import sys,json; sys.path.insert(0,%r); import task\ntry:\n m,_=task.read_task(%r); print(json.dumps(m,ensure_ascii=False))\n"
            "except task.LedgerError as e:\n print('LedgerError: '+str(e),file=sys.stderr); sys.exit(3)"
            % (str(ROOT / "scripts"), tid))
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, env=env(fake))
    return (json.loads(r.stdout) if r.returncode == 0 else None), r.stderr, ("" if r.returncode == 0 else ("LedgerError" if r.returncode == 3 else "crash"))
# Hỏng NHẸ: bắt đầu+kết thúc bằng " nhưng không phải JSON chặt -> bỏ mọi " và khoảng trắng hai đầu. {trường: (thô, đọc ra)}
LIGHT = {"issue": ('""12""', "12"), "title": ('"Xin "chao" ban"', 'Xin "chao" ban'), "budget": ('"\\q"', "\\q"),
         "state": ('""review""', "review"), "area": ('""hq/ledger""', "hq/ledger"), "id": ('""T-901""', "T-901")}
CORRUPT = {k: v[0] for k, v in LIGHT.items()}
# Hỏng NẶNG: còn sai sau bước bỏ nháy. {việc: (trường, thô)}
HEAVY = {"T-911": ("state", '""xyz""'), "T-912": ("area", '"nope/xx"'), "T-913": ("id", '""T-999""'), "T-914": ("tier", '""Z""')}
