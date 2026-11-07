"""Thư viện chung cho eval đối kháng T-097: dựng sổ cái tạm, chạy scripts/export_dashboard.py THẬT (có và không --public)."""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent
PATHS = ("/home/", "/root/", "/tmp/", "/Users/", "/var/", "/opt/", "handoffs/", "C:\\")


def run(files):
    """files: {đường dẫn tương đối dưới eval/invariants: nội dung}. Trả {chế độ: (model, raw_json)} hoặc raise."""
    res = {}
    with tempfile.TemporaryDirectory() as t:
        f = Path(t) / "ledger"; (f / "board").mkdir(parents=True); (f / "org").mkdir()
        shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
        for rel, txt in files.items():
            p = f / "eval" / "invariants" / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(txt, encoding="utf-8")
        for pub in (False, True):
            k = "public" if pub else "thường"
            out = Path(t) / k
            r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                               capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(f)))
            if r.returncode:
                raise SystemExit(f"FAIL [{k}] exporter thoát {r.returncode}: {r.stderr[-300:]}")
            raw = (out / "dashboard.json").read_text(encoding="utf-8")
            res[k] = (json.loads(raw).get("model") or {}, raw)
    return res
