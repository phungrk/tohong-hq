#!/usr/bin/env python3
"""Bất biến hq/dashboard/model · nguồn: T-094 (Spec Gate v2 2026-11-07, spec-critic rút từ tiêu chí 1-2).
File bất biến viết lạ (dòng code, đường dẫn máy, nằm ở gốc bể) vẫn cho tên là mô tả và vùng hợp lệ trong dashboard.json
Đích: eval/invariants/hq/dashboard/model/inv-039-file-la-khong-lo-code.py sau khi PR T-094 merge và file này xanh trên main.
Dựng sổ cái tạm với các file viết lạ (không có mô tả dài, chỉ có dòng code / lệnh / đường dẫn máy; một file ở gốc eval/invariants), chạy
scripts/export_dashboard.py THẬT (có và không --public): mọi name không rỗng, không chứa đường dẫn máy hay handoffs/, không là dòng code
(eval/T-094/namerule2.py looks_like_code; trừ khi name là slug hay tên file, bước 3-4); mọi area khớp ^(_shared|_root|[a-z0-9_-]+(/[a-z0-9_-]+)*)$; url không có "/./"; file ở gốc có area _root.
Chạy: python3 eval/invariants/hq/dashboard/model/inv-039-file-la-khong-lo-code.py   Mã thoát 0 = đạt. In PASS hoặc FAIL <lý do>."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent
sys.path.insert(0, str(ROOT / "eval" / "T-094"))
import namerule2 as nr  # noqa: E402

H = "# Bất biến hq/x · nguồn: T-999.\n"
FILES = {
    "hq/x/inv-901-exec.sh": "#!/usr/bin/env bash\n" + H + 'HERE="$(cd "$(dirname "$0")" && pwd)"\nexec node "$HERE/lib/loc_inv.cjs" --repo "$REPO" --check kr-sum\n',
    "hq/x/inv-902-gan.py": '#!/usr/bin/env python3\n"""' + H[2:] + 'back, front = os.path.abspath(a.back), os.path.abspath(a.front)\nr = subprocess.run(["bash", "build.sh", "--all"], capture_output=True, text=True)\n"""\n',
    "hq/x/inv-903-goi-nhieu-dong.py": H + 'L.task("new", "--title", "x", "--to", "engineering", "--tier", "B",\n',
    "hq/x/inv-904-pipe.sh": H + 'cat "$ROOT/board/T-001.md" | sed -n 1,12p | grep -c area >/dev/null\n',
    "hq/x/inv-905.sh": "# Bất biến: cd /root/work && python3 run.py --home /home/user/x\n",
    "hq/x/inv-906-handoffs.sh": "# Bất biến: đọc handoffs/T-001-v1.md rồi so với /tmp/out\n# INV-906 · x = f(y)\n",
    "inv-907-o-goc.sh": "# Bất biến: file ở gốc bể vẫn có vùng hợp lệ và url sạch\n",
}
PATHS = ("/home/", "/root/", "/tmp/", "/Users/", "/var/", "/opt/", "handoffs/", "C:\\")
AREA = re.compile(r"_shared|_root|[a-z0-9_-]+(?:/[a-z0-9_-]+)*")
bad = []
with tempfile.TemporaryDirectory() as t:
    f = Path(t) / "ledger"; (f / "board").mkdir(parents=True); (f / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
    for rel, txt in FILES.items():
        p = f / "eval" / "invariants" / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(txt, encoding="utf-8")
    for pub in (False, True):
        k = "public" if pub else "thường"
        out = Path(t) / k
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                           capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(f)))
        if r.returncode:
            bad.append(f"[{k}] exporter thoát {r.returncode}"); continue
        lst = (json.loads((out / "dashboard.json").read_text(encoding="utf-8")).get("model") or {}).get("invariant_list") or []
        if len(lst) != len(FILES): bad.append(f"[{k}] đếm {len(lst)} != {len(FILES)} file")
        for x in lst:
            n, a, u = (x.get("name") or "").strip(), x.get("area") or "", x.get("url") or ""
            tag = u.rsplit("/", 1)[-1] or "?"
            if not n: bad.append(f"[{k}] {tag}: name rỗng")
            if any(p in n for p in PATHS): bad.append(f"[{k}] {tag}: name chứa đường dẫn máy/handoffs/ {n[:80]!r}")
            fb = n in ((x.get("slug") or "").replace("-", " "), tag)   # bước 3-4 (slug, tên file) không phải dòng code dù trùng từ khoá, vd slug "export-…"
            if not fb and nr.looks_like_code(n): bad.append(f"[{k}] {tag}: name là dòng code {n[:80]!r}")
            if not AREA.fullmatch(a): bad.append(f"[{k}] {tag}: area không hợp lệ {a!r}")
            if "/./" in u or "/../" in u: bad.append(f"[{k}] {tag}: url có /./ hoặc /../")
            if tag == "inv-907-o-goc.sh" and a != "_root": bad.append(f"[{k}] file ở gốc phải có area _root, thấy {a!r}")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
