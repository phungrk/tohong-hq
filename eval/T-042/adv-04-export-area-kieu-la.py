#!/usr/bin/env python3
"""Eval đối kháng T-042 (adversary, 2026-11-02, Code Gate lần 2). Spec products/T-041-loc-san-pham.md H8: product = phần trước '/' đầu của normalize_area(area);
LedgerError -> ""; việc xuất vẫn chạy; product luôn thuộc {planner, hq, ""}.

Input quanh chỗ vừa sửa (product_of với area không phải chuỗi):
  (a) gọi thẳng product_of với None, 0, 42, 3.5, True, {}, {"hq": 1}, [], ["hq"], b"hq", object() -> "" và không ném;
  (b) file board sửa tay: area null / 42 / {"hq":1} / "[" (JSON hỏng) / ["hq" (JSON hỏng) / khoảng trắng quanh vùng / "/hq/dashboard/" / "HQ/dashboard" / "hq " / "dashboard"
      -> exporter thoát 0, product đúng như normalize_area (chuỗi lạ -> "").
Chạy: python3 eval/T-042/adv-04-export-area-kieu-la.py  (trong repo tohong-hq; bản sao sổ cái qua TOHONG_ROOT, không chạm sổ cái thật)
"""
import importlib.util, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
VALID = {"planner", "hq", ""}
bad = []

# (a) gọi thẳng
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("export_dashboard", ROOT / "scripts" / "export_dashboard.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
if not hasattr(mod, "product_of"):
    bad.append("export_dashboard.py không có product_of (không gọi thẳng được)")
else:
    for v in (None, 0, 42, 3.5, True, {}, {"hq": 1}, [], ["hq"], b"hq", object()):
        try:
            got = mod.product_of(v)
        except Exception as e:  # noqa: BLE001
            bad.append(f"product_of({v!r}) ném {type(e).__name__}: {e}"); continue
        if got != "":
            bad.append(f"product_of({v!r}) phải là \"\", thấy {got!r}")

# (b) qua exporter thật, file board sửa tay
CASES = {
    "T-961": ('area: null', ""),
    "T-962": ('area: 42', ""),
    "T-963": ('area: {"hq": 1}', ""),
    "T-964": ('area: [', ""),
    "T-965": ('area: ["hq"', ""),
    "T-966": ('area:    hq/dashboard   ', "hq"),
    "T-967": ('area: "/hq/dashboard/"', "hq"),
    "T-968": ('area: "HQ/dashboard"', ""),
    "T-969": ('area: "hq "', "hq"),
    "T-970": ('area: dashboard', "hq"),
    "T-971": ('area: "  "', ""),
}
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp); fake = tmp / "ledger"
    (fake / "board").mkdir(parents=True); (fake / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    for tid, (line, _) in CASES.items():
        body = re.sub(r"(?m)^id:.*$", f"id: {tid}", src, count=1)
        body = re.sub(r"(?m)^area:.*$", lambda m: line, body, count=1)
        (fake / "board" / f"{tid}.md").write_text(body, encoding="utf-8")
    out = tmp / "out"
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)],
                       capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(fake)))
    if r.returncode != 0:
        bad.append(f"export_dashboard.py sập (thoát {r.returncode}): {(r.stderr.strip().splitlines() or ['?'])[-1][:200]}")
    else:
        for name in ("dashboard.json", "tasks.json"):
            data = json.loads((out / name).read_text(encoding="utf-8"))
            by = {t["id"]: t for t in (data["tasks"] if isinstance(data, dict) else data)}
            for tid, (line, want) in CASES.items():
                t = by.get(tid)
                if t is None:
                    bad.append(f"{name}: thiếu {tid} ({line})"); continue
                got = t.get("product", "<thiếu>")
                if got not in VALID or got != want:
                    bad.append(f"{name}: {tid} ({line}) product phải {want!r}, thấy {got!r}")

if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
