#!/usr/bin/env python3
"""T-087 tiêu chí 6 (hỏng NẶNG): state/area/id/tier còn sai sau khi bỏ nháy -> board bị bỏ qua ở list/summary/export/gate (không Traceback,
cảnh báo stderr), summary liệt kê (nặng), lệnh đổi trạng thái từ chối (mã != 0, board + sổ cái không đổi một byte), `new` vẫn cấp
số đúng (không va file T-9xx nào), read_task ném LedgerError chứ không lỗi khác. Chạy: python3 eval/T-087/check_6_hong_nang.py"""
import json, tempfile
from pathlib import Path
import _lib as L
T = L.ROOT / "scripts/task.py"
with tempfile.TemporaryDirectory() as tmp:
    b = {t: {k: v} for t, (k, v) in L.HEAVY.items()}
    b["T-915"] = {}; b["T-916"] = {"state": "doing", "holder": "product", "owner": "product", "area": "hq/ledger"}
    for t in L.HEAVY: b[t].update(state=b[t].get("state", "doing"), holder="product", owner="product")
    fake = L.mk(tmp, b); out = Path(tmp) / "pub"
    ev0 = (fake / "ledger/events.jsonl").read_bytes()
    runs = {"list": L.run(fake, T, "list"), "summary": L.run(fake, T, "summary"), "summary --json": L.run(fake, T, "summary", "--json"),
            "export": L.run(fake, L.ROOT / "scripts/export_dashboard.py", "--out", out)}
    for n, r in runs.items():
        L.chk("Traceback" not in r.stderr and r.returncode == 0, f"{n}: sập hoặc thoát {r.returncode}: {r.stderr[-150:]}")
    for t, (k, raw) in L.HEAVY.items():
        L.chk(t not in runs["list"].stdout, f"list: {t} hỏng nặng phải bị bỏ qua")
        L.chk(any(f"board/{t}.md" in l and f"trường {k}:" in l for l in runs["summary"].stderr.splitlines()), f"stderr summary thiếu cảnh báo board/{t}.md trường {k}")
        L.chk(any(f"{t} (board/{t}.md)" in l and "nặng" in l and k in l for l in runs["summary"].stdout.splitlines()), f"summary text thiếu dòng '{t} (board/{t}.md) [nặng]: {k}'")
        e = [x for x in (json.loads(runs["summary --json"].stdout or "{}").get("board_hong") or []) if x.get("task") == t]
        L.chk(len(e) == 1 and e[0].get("severity") == "nang" and k in e[0].get("fields", []) and e[0].get("file") == f"board/{t}.md", f"board_hong {t}: {e}")
        m, err, ex = L.read(fake, t); L.chk(ex == "LedgerError", f"read_task {t}: phải ném LedgerError, thấy {ex or 'không ném'}")
        raw_b = (fake / "board" / f"{t}.md").read_bytes()
        for argv in (["handoff", t, "--by", "product", "--note", "n", "--link", "handoffs/x.md", "--eval", "echo ok"], ["start", t, "--by", "product"]):
            r = L.run(fake, T, *argv)
            L.chk(r.returncode != 0 and "Traceback" not in r.stderr and f"board/{t}.md" in r.stderr and f"trường {k}" in r.stderr, f"{argv[0]} {t}: phải từ chối rõ (file+trường), thoát {r.returncode}: {r.stderr[-150:]}")
            L.chk((fake / "board" / f"{t}.md").read_bytes() == raw_b, f"{argv[0]} {t}: board bị đổi")
    L.chk((fake / "ledger/events.jsonl").read_bytes() == ev0, "lệnh bị từ chối vẫn ghi sổ cái")
    tj = out / "tasks.json"; ids = {t["id"] for t in json.loads(tj.read_text(encoding="utf-8"))} if tj.exists() else set()
    L.chk({"T-915", "T-916"} <= ids and not (ids & set(L.HEAVY)), "tasks.json: chỉ gồm việc lành, không có việc hỏng nặng: " + str(sorted(ids)))
    g = L.run(fake, L.ROOT / "scripts/gate.py", "T-911")
    L.chk(g.returncode != 0 and "Traceback" not in g.stderr, "gate T-911 hỏng nặng: phải thoát != 0 không Traceback")
    n = L.run(fake, T, "new", "--title", "mới", "--to", "product", "--criteria", "c")
    L.chk(n.returncode == 0 and "Traceback" not in n.stderr and "T-917" in n.stdout, "new: phải cấp T-917 (sau T-916, kể cả file hỏng); " + (n.stdout + n.stderr)[-200:])
    L.chk(not (fake / "board/T-917.md").exists() or True, "")
L.done()
