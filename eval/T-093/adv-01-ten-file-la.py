#!/usr/bin/env python3
"""Eval đối kháng tầng 3 của T-093 (adversary): exporter khối `model` với tên file bất biến lạ (spec T-092 mục A).
Input: sổ cái tạm có các file bất biến KHÔNG có dòng mô tả và tên lạ:
  inv-040.py (không slug), inv-041 (không đuôi, không slug), inv-.sh (không số, không slug), inv-042-co-slug.sh (đối chứng).
Mong đợi (spec A, "Kết quả không bao giờ rỗng (bước 3 bảo đảm)"; inv-017 chờ merge cũng đòi name không rỗng):
  mọi `name` là chuỗi không rỗng sau khi bỏ khoảng trắng; id đúng (INV-040, INV-041, INV-?, INV-042); số đếm = 4; cả hai chế độ.
Không ép giá trị slug cụ thể cho file không slug (spec chưa nói rõ), chỉ ép name không rỗng.
Chạy: cd /home/user/tohong-hq && python3 eval/T-093/adv-01-ten-file-la.py   In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
bad = []
with tempfile.TemporaryDirectory() as t:
    t = Path(t); f = t / "ledger"
    (f / "board").mkdir(parents=True); (f / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
    shutil.copy(ROOT / "board" / "T-041.md", f / "board" / "T-041.md")
    d = f / "eval" / "invariants" / "hq" / "dashboard"; d.mkdir(parents=True)
    for n in ("inv-040.py", "inv-041", "inv-.sh", "inv-042-co-slug.sh"):
        (d / n).write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
    for pub in (False, True):
        k = "public" if pub else "thường"
        out = t / ("o" + k)
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                           capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(f)))
        if r.returncode:
            bad.append(f"[{k}] exporter thoát {r.returncode}: {r.stderr.strip()[-200:]}"); continue
        m = json.loads((out / "dashboard.json").read_text(encoding="utf-8")).get("model") or {}
        lst = m.get("invariant_list") or []
        if m.get("invariants_total") != 4 or len(lst) != 4:
            bad.append(f"[{k}] phải đếm 4 file inv-*, thấy total={m.get('invariants_total')} len={len(lst)}")
        ids = sorted(x.get("id") for x in lst)
        if ids != sorted(["INV-040", "INV-041", "INV-?", "INV-042"]):
            bad.append(f"[{k}] id phải INV-040, INV-041, INV-042, INV-?; thấy {ids}")
        for x in lst:
            nm = x.get("name")
            if not isinstance(nm, str) or not nm.strip():
                bad.append(f"[{k}] {x.get('url', '').rsplit('/', 1)[-1]}: name rỗng {nm!r} (slug={x.get('slug')!r}); spec A: name không bao giờ rỗng")
print("FAIL " + "; ".join(bad) if bad else "PASS")
sys.exit(1 if bad else 0)
