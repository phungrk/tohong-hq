#!/usr/bin/env python3
"""Bất biến hq/dashboard · nguồn: T-083 (Spec Gate v2 2026-11-06, spec-critic; spec products/T-083-capu-queue-viec-da-xu-ly.md M5, phần đầu INV-P9 của Product).
`capu_queue` không phụ thuộc thư mục con của inbox/capu/: thêm file DR (kể cả trùng mã việc, có decide-by) vào bất kỳ
thư mục con nào (da-quyet/, sâu nhiều cấp) thì `capu_queue` giống hệt, và không có chuỗi tên thư mục con nào trong đó.
Đo trên bản sao sổ cái thật (board, ledger, inbox, handoffs, org) trong thư mục tạm, TOHONG_NOW cố định; không ghi gì vào repo.
Chạy: python3 eval/invariants/hq/dashboard/inv-010-capu-queue-khong-doc-thu-muc-con-inbox.py"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "scripts" / "task.py").is_file())
EXPORT = ROOT / "scripts" / "export_dashboard.py"

def queue(root, out):
    env = dict(os.environ, TOHONG_ROOT=str(root), TOHONG_NOW="2026-11-06T12:00"); env.pop("PR_READ_TOKEN", None)
    r = subprocess.run([sys.executable, str(EXPORT), "--public", "--out", str(out)], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        print("FAIL export lỗi: " + (r.stderr.strip().splitlines() or [""])[-1]); sys.exit(1)
    return json.loads((Path(out) / "dashboard.json").read_text(encoding="utf-8")).get("capu_queue")

with tempfile.TemporaryDirectory() as tmp:
    fake = Path(tmp) / "s"
    for d in ("board", "ledger", "inbox", "handoffs", "org"):
        if (ROOT / d).is_dir(): shutil.copytree(ROOT / d, fake / d)
    (fake / "inbox" / "capu").mkdir(parents=True, exist_ok=True)
    for sub in [p for p in (fake / "inbox" / "capu").iterdir() if p.is_dir()]:
        shutil.rmtree(sub)
    q0 = queue(fake, Path(tmp) / "o0")
    if q0 is None:
        print("PASS chưa áp dụng: dashboard.json chưa có capu_queue"); sys.exit(0)
    ids = sorted(p.stem for p in (fake / "board").glob("T-*.md"))
    for sub in ("da-quyet", "zz-thu-muc-con/sau"):
        d = fake / "inbox" / "capu" / sub; d.mkdir(parents=True)
        for tid in ids:
            (d / f"{tid}-thu-muc-con.md").write_text("---\ntype: decision-request\ndecide-by: 2026-01-01\n---\nx\n", encoding="utf-8")
    q1 = queue(fake, Path(tmp) / "o1")
bad = []
if q1 != q0: bad.append("capu_queue đổi khi thêm file vào thư mục con của inbox/capu/")
if re.search(r"da-quyet|zz-thu-muc-con|thu-muc-con", json.dumps(q1, ensure_ascii=False)): bad.append("capu_queue chứa tên file/thư mục con")
if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print(f"PASS capu_queue không đổi khi thêm DR vào thư mục con inbox/capu ({len(q0)} phần tử)")
