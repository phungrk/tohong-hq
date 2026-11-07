#!/usr/bin/env python3
"""INV-040 hq/dashboard/model · nguồn: T-096 (rút bởi spec-critic khi spec v3 qua Spec Gate, 2026-11-07).
Gác ở eval/T-096/bat-bien-cho-merge/ theo ADR-028; Chief of Staff đưa vào eval/invariants/hq/dashboard/model/ khi PR T-096 merge và xanh trên main.
Bất biến: số eval đối kháng và hồi quy trên tab của drawer bằng số mục thật của danh sách, ở cả bản thường và --public.
Chạy scripts/export_dashboard.py THẬT trên sổ cái hiện tại: model.adversarial_evals = len(adversarial_list) = số file adv-* trực tiếp trong eval/T-<số>/ (đếm độc lập);
model.regression_evals = len(regression_list) = số mục cấp một của eval/regression/ (trừ tên bắt đầu '.' và README.md); mỗi mục có name không rỗng và url;
bản public: không khoá path, không '/home/', '/root/', '/tmp/', 'handoffs/' trong hai danh sách. Chưa có hai khoá danh sách (trước T-096) thì PASS chưa áp dụng.
Chạy: python3 eval/T-096/inv-proposed-danh-sach-khop-so.py   Mã thoát 0 = đạt. In PASS hoặc FAIL <lý do>."""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent
ev = ROOT / "eval"
adv = sum(1 for d in ev.iterdir() if d.is_dir() and re.fullmatch(r"T-\d+", d.name) for p in d.iterdir() if p.is_file() and p.name.startswith("adv-"))
rd = ev / "regression"
reg = sum(1 for p in rd.iterdir() if not p.name.startswith(".") and p.name != "README.md") if rd.is_dir() else 0
bad = []
with tempfile.TemporaryDirectory() as t:
    for pub in (False, True):
        k = "public" if pub else "thường"
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", t] + (["--public"] if pub else []), capture_output=True, text=True)
        if r.returncode:
            bad.append(f"[{k}] exporter lỗi: {(r.stderr.strip().splitlines() or ['?'])[-1][:120]}"); continue
        m = json.loads((Path(t) / "dashboard.json").read_text(encoding="utf-8")).get("model", {})
        if "adversarial_list" not in m and "regression_list" not in m:
            print("PASS chưa áp dụng: model chưa có adversarial_list/regression_list (T-096)"); sys.exit(0)
        A, R = m.get("adversarial_list"), m.get("regression_list")
        if not isinstance(A, list) or not isinstance(R, list):
            bad.append(f"[{k}] thiếu một trong hai danh sách"); continue
        if not (m.get("adversarial_evals") == len(A) == adv): bad.append(f"[{k}] adversarial: số {m.get('adversarial_evals')}, list {len(A)}, đếm {adv}")
        if not (m.get("regression_evals") == len(R) == reg): bad.append(f"[{k}] regression: số {m.get('regression_evals')}, list {len(R)}, đếm {reg}")
        for x in A + R:
            if not x.get("name") or not x.get("url"): bad.append(f"[{k}] mục thiếu name/url: {x.get('file')}")
        if pub:
            s = json.dumps([A, R], ensure_ascii=False)
            for bit in ('"path"', "/home/", "/root/", "/tmp/", "handoffs/"):
                if bit in s: bad.append(f"[public] danh sách chứa {bit}")
print("FAIL " + "; ".join(bad[:5]) if bad else "PASS")
sys.exit(1 if bad else 0)
