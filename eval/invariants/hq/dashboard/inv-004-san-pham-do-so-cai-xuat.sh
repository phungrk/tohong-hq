#!/usr/bin/env bash
# Nguồn: T-041 (spec products/T-041-loc-san-pham.md v2 mục H8, quyết định decisions/2026-11-02-t041-pham-vi-loc-san-pham.md mục 2, qua Spec Gate 2026-11-02, spec-critic; đề xuất INV-P4 của Product).
# Bất biến: scripts/export_dashboard.py xuất cho MỌI việc (dashboard.json và tasks.json, cùng giá trị) trường `product` thuộc task.PRODUCTS ∪ {""}
#   và bằng phần trước "/" của task.normalize_area(area) (vùng cũ front/*, back/* -> planner; dashboard/* -> hq; rỗng -> ""; vùng normalize_area từ chối -> "");
#   vùng lạ do sửa tay file board không làm exporter sập. Bắt lỗi: thêm sản phẩm hay vùng cũ vào task.py mà quên exporter, hoặc dashboard tự suy sản phẩm.
# Áp dụng từ khi T-041 vào (board/T-041.md ở trạng thái done, hoặc exporter đã xuất `product` cho ít nhất một việc); trước đó PASS "chưa áp dụng".
# Chạy trong repo này, không cần repo dashboard: bash eval/invariants/hq/dashboard/inv-004-san-pham-do-so-cai-xuat.sh
set -u
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
exec python3 -I - "$ROOT" <<'PY'
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path(sys.argv[1])
sys.path.insert(0, str(ROOT / "scripts"))
import task as T

VALID = set(T.PRODUCTS) | {""}
bad = []

def want_of(area):
    try:
        p = T.normalize_area(area or "").split("/")[0]
    except T.LedgerError:
        return ""
    return p if p in VALID else ""

def export(root, out):
    env = dict(os.environ, TOHONG_ROOT=str(root))
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        bad.append(f"export_dashboard.py thoát {r.returncode} trên {root.name}: {(r.stderr.strip().splitlines() or ['?'])[-1][:200]}")
        return None, None
    dj = json.loads((out / "dashboard.json").read_text(encoding="utf-8"))["tasks"]
    tj = json.loads((out / "tasks.json").read_text(encoding="utf-8"))
    return dj, tj

def check(tasks, tasks_json, tag):
    for t in tasks:
        if "product" not in t:
            bad.append(f"{tag}: {t['id']} thiếu trường product"); continue
        if t["product"] not in VALID:
            bad.append(f"{tag}: {t['id']} product={t['product']!r} ngoài {sorted(VALID)}"); continue
        w = want_of(t.get("area", ""))
        if t["product"] != w:
            bad.append(f"{tag}: {t['id']} area={t.get('area')!r} phải có product={w!r}, thấy {t['product']!r}")
    pj = {t.get("id"): t.get("product", "<thiếu>") for t in (tasks_json or [])}
    for t in tasks:
        if pj.get(t["id"], "<thiếu>") != t.get("product", "<thiếu>"):
            bad.append(f"{tag}: {t['id']} product trong tasks.json ({pj.get(t['id'], '<thiếu>')!r}) khác dashboard.json ({t.get('product', '<thiếu>')!r})")

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    real, real_json = export(ROOT, tmp / "real")
    if real is None:
        print("FAIL " + bad[0]); sys.exit(1)
    b041 = ROOT / "board" / "T-041.md"
    t041_done = b041.exists() and bool(re.search(r"(?m)^state:\s*\"?done\"?\s*$", b041.read_text(encoding="utf-8")))
    if not t041_done and not any("product" in t for t in real):
        print("PASS chưa áp dụng (T-041 chưa xong và exporter chưa xuất trường product)"); sys.exit(0)
    check(real, real_json, "sổ cái thật")

    # bản sao sổ cái có đủ loại vùng, kể cả vùng lạ do sửa tay file board
    fake = tmp / "ledger"
    (fake / "board").mkdir(parents=True); (fake / "org").mkdir()
    if (ROOT / "org" / "roster.json").exists():
        shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = sorted((ROOT / "board").glob("T-*.md"))[-1].read_text(encoding="utf-8")
    areas = ["dashboard/model", "dashboard", "front/layout", "front", "back/api", "hq/dashboard/model", "hq", "planner/front/x", "planner",
             "", "hqx/dashboard", "planner-x/front", "zzz", "/hq/dashboard/"] + [k + "/x" for k in getattr(T, "LEGACY_AREAS", {})] + [p + "/x" for p in T.PRODUCTS]
    for i, area in enumerate(areas):
        body = re.sub(r"(?m)^id:.*$", f"id: T-9{i:02d}", src, count=1)
        body = re.sub(r"(?m)^area:.*$", f'area: "{area}"', body, count=1)
        (fake / "board" / f"T-9{i:02d}.md").write_text(body, encoding="utf-8")
    fk, fk_json = export(fake, tmp / "fake")
    if fk is not None:
        check(fk, fk_json, "bản sao sổ cái")
        # kỳ vọng ghi cứng theo ADR-011 cho các vùng đã biết (không chỉ dựa vào normalize_area)
        FIXED = {"dashboard/model": "hq", "front/layout": "planner", "back/api": "planner", "": "", "hqx/dashboard": "", "planner-x/front": "", "zzz": ""}
        by_area = {}
        for t in fk:
            by_area.setdefault(t.get("area", ""), t.get("product", "<thiếu>"))
        for a, w in FIXED.items():
            if a in by_area and by_area[a] != w:
                bad.append(f"bản sao sổ cái: area={a!r} phải có product={w!r} (ADR-011), thấy {by_area[a]!r}")

if bad:
    for b in bad[:12]: print("FAIL " + b)
    if len(bad) > 12: print(f"FAIL ... và {len(bad) - 12} lỗi cùng loại")
    sys.exit(1)
print("PASS product do sổ cái xuất, khớp normalize_area")
PY
