#!/usr/bin/env python3
"""Eval tầng 1 của T-092 (spec products/T-092-knowledge-reservoir-drawer.md): khối `model` của dashboard.json.
  cd /home/user/tohong-hq && python3 eval/T-092/export-be.py --criterion 1|6|7
1: sổ cái tạm nhiều biến thể -> hợp đồng dữ liệu (khoá, số, id, slug, name, source, url, path, thứ tự)
6: cùng sổ cái tạm, --public: không path, không đường dẫn máy, không thân eval
7: sổ cái thật, cả hai chế độ: số bất biến = đếm độc lập số file inv-*; adv đếm độc lập
In PASS hoặc FAIL <lý do>; mã thoát 0/1. Dùng exporter THẬT (TOHONG_ROOT trỏ sổ cái tạm). Không đọc mã nguồn exporter."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
crit = sys.argv[sys.argv.index("--criterion") + 1] if "--criterion" in sys.argv else "1"
bad = []
GH = "https://github.com/phungrk/tohong-hq/blob/main/"


def export(root, out, public):
    env = dict(os.environ, TOHONG_ROOT=str(root))
    cmd = [sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if public else [])
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        bad.append(f"export_dashboard.py thoát {r.returncode}: {(r.stderr.strip().splitlines() or ['?'])[-1][:200]}")
        return None
    return json.loads((out / "dashboard.json").read_text(encoding="utf-8"))


def w(base, rel, text):
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


LONG = "Rất " + "dài " * 80  # > 140 ký tự, không có ". "


def make_fake(tmp):
    f = tmp / "ledger"
    (f / "board").mkdir(parents=True); (f / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    shutil.copy(ROOT / "board" / "T-041.md", f / "board" / "T-041.md")
    I = "eval/invariants/"
    body = "echo SECRET_BODY_SENTINEL_92\n"
    w(f, I + "_shared/inv-001-khong-secret.sh", "#!/usr/bin/env bash\n# Nguồn: T-010 (spec x, T-011 sau)\n# Bất biến: Không có secret trong repo. Chi tiết dài.\n" + body)
    w(f, I + "planner/front/layout/inv-010-z-sau.sh", "#!/usr/bin/env bash\n# Nguồn: T-025 (spec)\n# Bất biến (planner/front/layout): Khung rộng đúng\n" + body)
    w(f, I + "planner/front/layout/inv-002-a-truoc.py", '#!/usr/bin/env python3\n"""Nguồn: T-020 (spec), eval/T-021/adv-01\nBất biến (planner/front/layout): Khung giữa. Phần sau bị cắt."""\n# ' + "SECRET_BODY_SENTINEL_92\n")
    w(f, I + "planner/vendor/matching/inv-004-nhan-cham-mu.py", '#!/usr/bin/env python3\n"""Nguồn: T-074 (spec v3)\nINV-004 · Nhãn chấm mù luôn toàn vẹn\n"""\nprint("SECRET_BODY_SENTINEL_92")\n')
    w(f, I + "hq/dashboard/inv-003-khong-co-mo-ta.sh", "#!/usr/bin/env bash\n" + body)
    w(f, I + "hq/inv-001-ten-dai.sh", f"#!/usr/bin/env bash\n# Bất biến: {LONG}\n" + body)
    w(f, I + "dashboard/model/inv-001-vung-cu.sh", "#!/usr/bin/env bash\n# Bất biến: Vùng cũ chưa có tiền tố\n" + body)
    w(f, I + "hq/ledger/inv-001-dang-nguon.py", '"""Bất biến hq/ledger · nguồn: T-083 (Spec Gate v2 2026-11-06; spec x).\nMô tả thật của bất biến này dài hơn năm mươi ký tự đủ để nhận. Phần sau\n"""\nprint("SECRET_BODY_SENTINEL_92")\n')
    w(f, I + "hq/ledger/inv-002-cong-ty.sh", '#!/usr/bin/env bash\n# Bất biến công ty (ADR-011, nguồn: CLAUDE.md "Ranh giới cứng"): repo không chứa khóa API, token.\n' + body)
    w(f, I + "hq/ledger/inv-003-nguon-thuong.py", '#!/usr/bin/env python3\n"""nguồn: T-063 eval đối kháng\nBất biến (hq/ledger): Số nguyên dương.\n"""\nprint("SECRET_BODY_SENTINEL_92")\n')
    # không tính:
    w(f, I + "planner/front/layout/lib/helper.cjs", "// not inv\n")
    w(f, I + "planner/front/layout/README.md", "# not inv\n")
    w(f, I + "hq/inv-999-thu-muc/ben-trong.sh", "echo no\n")
    w(f, "eval/T-901/adv-01-a.sh", "echo adv\n"); w(f, "eval/T-901/adv-02-b.py", "print(1)\n")
    w(f, "eval/T-901/lib/adv-03.cjs", "//\n"); w(f, "eval/T-901/bat-bien-cho-merge/adv-04.sh", "echo\n")
    w(f, "eval/T-902/gate-latest.json", "{}\n"); w(f, "eval/loose/adv-05.sh", "echo\n")
    for n in (".gitkeep", "README.md"): w(f, "eval/regression/" + n, "")
    w(f, "eval/regression/r1.sh", "echo\n"); w(f, "eval/regression/r2-dir/x.sh", "echo\n")
    w(f, "products/T-901-a.md", "# a\n"); w(f, "products/T-902-b.md", "# b\n"); w(f, "products/NOTES.md", "x\n")
    w(f, "insights/2026-10-25-weekly.md", "x\n"); w(f, "insights/2026-11-01-weekly.md", "x\n"); w(f, "insights/other.md", "x\n")
    return f


def check_fake(m, public):
    k = "public" if public else "thường"
    want_keys = {"invariants", "invariants_total", "invariant_list", "adversarial_evals", "regression_evals", "specs", "insight_reports", "last_insight"}
    if not isinstance(m, dict):
        bad.append(f"[{k}] thiếu khoá cấp gốc model"); return
    if not want_keys <= set(m):
        bad.append(f"[{k}] model thiếu khoá {sorted(want_keys - set(m))}")
    inv = m.get("invariants")
    want_inv = {"_shared": 1, "planner/front/layout": 2, "planner/vendor/matching": 1, "hq/dashboard": 1, "hq": 1, "dashboard/model": 1, "hq/ledger": 3}
    if inv != want_inv: bad.append(f"[{k}] invariants phải {want_inv}, thấy {inv}")
    if m.get("invariants_total") != 10: bad.append(f"[{k}] invariants_total phải 10, thấy {m.get('invariants_total')}")
    for key, v in (("adversarial_evals", 2), ("regression_evals", 2), ("specs", 2), ("insight_reports", 2), ("last_insight", "2026-11-01-weekly.md")):
        if m.get(key) != v: bad.append(f"[{k}] {key} phải {v!r}, thấy {m.get(key)!r}")
    lst = m.get("invariant_list") or []
    order = [(x.get("area"), x.get("id")) for x in lst]
    want_order = [("_shared", "INV-001"), ("dashboard/model", "INV-001"), ("hq", "INV-001"), ("hq/dashboard", "INV-003"), ("hq/ledger", "INV-001"), ("hq/ledger", "INV-002"), ("hq/ledger", "INV-003"), ("planner/front/layout", "INV-002"),
                  ("planner/front/layout", "INV-010"), ("planner/vendor/matching", "INV-004")]
    if order != want_order: bad.append(f"[{k}] thứ tự/id invariant_list phải {want_order}, thấy {order}")
    by = {(x.get("area"), x.get("id")): x for x in lst}
    want = {
        ("_shared", "INV-001"): ("khong-secret", "Không có secret trong repo", "T-010", "_shared/inv-001-khong-secret.sh"),
        ("planner/front/layout", "INV-002"): ("a-truoc", "Khung giữa", "T-020", "planner/front/layout/inv-002-a-truoc.py"),
        ("planner/front/layout", "INV-010"): ("z-sau", "Khung rộng đúng", "T-025", "planner/front/layout/inv-010-z-sau.sh"),
        ("planner/vendor/matching", "INV-004"): ("nhan-cham-mu", "Nhãn chấm mù luôn toàn vẹn", "T-074", "planner/vendor/matching/inv-004-nhan-cham-mu.py"),
        ("hq/dashboard", "INV-003"): ("khong-co-mo-ta", "khong co mo ta", "", "hq/dashboard/inv-003-khong-co-mo-ta.sh"),
        ("hq/ledger", "INV-001"): ("dang-nguon", "Mô tả thật của bất biến này dài hơn năm mươi ký tự đủ để nhận", "T-083", "hq/ledger/inv-001-dang-nguon.py"),
        ("hq/ledger", "INV-002"): ("cong-ty", "repo không chứa khóa API, token.", "", "hq/ledger/inv-002-cong-ty.sh"),
        ("hq/ledger", "INV-003"): ("nguon-thuong", "Số nguyên dương.", "T-063", "hq/ledger/inv-003-nguon-thuong.py"),
        ("dashboard/model", "INV-001"): ("vung-cu", "Vùng cũ chưa có tiền tố", "", "dashboard/model/inv-001-vung-cu.sh"),
    }
    for key, (slug, name, src, rel) in want.items():
        x = by.get(key)
        if not x: continue
        if x.get("slug") != slug: bad.append(f"[{k}] {key} slug phải {slug!r}, thấy {x.get('slug')!r}")
        if x.get("name") != name: bad.append(f"[{k}] {key} name phải {name!r}, thấy {x.get('name')!r}")
        if x.get("source") != src: bad.append(f"[{k}] {key} source phải {src!r}, thấy {x.get('source')!r}")
        if x.get("url") != GH + "eval/invariants/" + rel: bad.append(f"[{k}] {key} url phải {GH}eval/invariants/{rel}, thấy {x.get('url')!r}")
        if public:
            if "path" in x: bad.append(f"[{k}] {key} bản public không được có path")
        elif x.get("path") != "eval/invariants/" + rel: bad.append(f"[{k}] {key} path phải eval/invariants/{rel}, thấy {x.get('path')!r}")
    long = by.get(("hq", "INV-001"), {})
    n = long.get("name", "")
    want_long = LONG[:140].rstrip() + "…"   # quy tắc: giữ 140 ký tự đầu, bỏ khoảng trắng cuối, thêm …
    if n != want_long:
        bad.append(f"[{k}] name dài phải là 140 ký tự đầu bỏ khoảng trắng cuối + '…' ({len(want_long)} ký tự), thấy {len(n)} ký tự")
    for x in lst:
        for fld in ("area", "id", "slug", "name", "source", "url"):
            if not isinstance(x.get(fld), str): bad.append(f"[{k}] {x.get('id')} thiếu trường chuỗi {fld}")
        if "\n" in x.get("name", ""): bad.append(f"[{k}] name có xuống dòng")


def run_fake(public):
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        fake = make_fake(t)
        d = export(fake, t / "out", public)
        if d is None: return
        raw = (t / "out" / "dashboard.json").read_text(encoding="utf-8")
        if crit == "1":
            check_fake(d.get("model"), False)
        else:
            check_fake(d.get("model"), True)
            if "SECRET_BODY_SENTINEL_92" in raw: bad.append("bản public lộ thân eval (SECRET_BODY_SENTINEL_92)")
            for s in ("/home/", "/root/", "/tmp/", "C:\\\\", str(t)):
                if s in json.dumps(d.get("model", {}), ensure_ascii=False): bad.append(f"bản public có đường dẫn máy {s!r} trong model")
            if '"path"' in json.dumps(d.get("model", {})): bad.append("bản public có khoá path")
            # bản thường cũng không lộ thân eval
            d2 = export(fake, t / "out2", False)
            if d2 is not None and "SECRET_BODY_SENTINEL_92" in (t / "out2" / "dashboard.json").read_text(encoding="utf-8"):
                bad.append("bản thường lộ thân eval")
            if d2 is not None and not all("path" in x for x in (d2.get("model") or {}).get("invariant_list", [None]) if x is not None) or (d2 is not None and not (d2.get("model") or {}).get("invariant_list")): bad.append("bản thường phải có path")


def run_real():
    inv_root = ROOT / "eval" / "invariants"
    files = []
    for dp, dn, fn in os.walk(inv_root):
        for n in fn:
            p = Path(dp) / n
            if n.startswith("inv-") and p.is_file(): files.append(p)
    by_area = {}
    for p in files:
        a = str(p.parent.relative_to(inv_root)).replace(os.sep, "/")
        by_area[a] = by_area.get(a, 0) + 1
    adv = 0
    for d in (ROOT / "eval").iterdir():
        if re.fullmatch(r"T-\d+", d.name) and d.is_dir():
            adv += sum(1 for c in d.iterdir() if c.is_file() and c.name.startswith("adv-"))
    with tempfile.TemporaryDirectory() as t:
        for public in (False, True):
            d = export(ROOT, Path(t) / ("p" if public else "n"), public)
            if d is None: continue
            k = "public" if public else "thường"
            m = d.get("model")
            if not isinstance(m, dict): bad.append(f"[{k}] sổ cái thật: thiếu model"); continue
            if not files: bad.append("không đếm được file inv-* nào (bể rỗng?)")
            if m.get("invariants_total") != len(files): bad.append(f"[{k}] invariants_total {m.get('invariants_total')} != số file inv-* thật {len(files)}")
            if m.get("invariants") != by_area: bad.append(f"[{k}] invariants theo vùng khác đếm độc lập")
            if sum((m.get("invariants") or {}).values()) != m.get("invariants_total"): bad.append(f"[{k}] tổng invariants != invariants_total")
            lst = m.get("invariant_list") or []
            if len(lst) != len(files): bad.append(f"[{k}] len(invariant_list) {len(lst)} != {len(files)}")
            if m.get("adversarial_evals") != adv: bad.append(f"[{k}] adversarial_evals {m.get('adversarial_evals')} != đếm độc lập {adv}")
            for x in lst:
                rel = f"eval/invariants/{x.get('area')}/"
                if not x.get("url", "").startswith(GH + rel): bad.append(f"[{k}] url sai {x.get('url')!r}"); break
                if not public and not (ROOT / x.get("path", "?")).is_file(): bad.append(f"[{k}] path không tồn tại {x.get('path')!r}"); break
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            import namerule
            for x in lst:
                rel = x.get("url", "").split("/blob/main/")[-1]
                fp = ROOT / rel
                if not fp.is_file(): bad.append(f"[{k}] url không trỏ tới file có thật: {x.get('url')!r}"); continue
                text = fp.read_text(encoding="utf-8", errors="replace")
                want_n, want_s = namerule.name(text, x.get("slug", "")), namerule.source(text)
                nm = x.get("name", "")
                if nm != want_n: bad.append(f"[{k}] {rel}: name phải {want_n!r}, thấy {nm!r}")
                if x.get("source") != want_s: bad.append(f"[{k}] {rel}: source phải {want_s!r}, thấy {x.get('source')!r}")
                if (not nm.strip() or nm.lower().startswith("nguồn") or "\n" in nm or re.fullmatch(r"[\w./\\:*<>#-]+", nm) or re.match(r"^T-\d+\b", nm)):
                    bad.append(f"[{k}] {rel}: name vô nghĩa (rỗng, nguồn, hoặc chỉ là mã/đường dẫn): {nm!r}")
                if len(nm) > 141: bad.append(f"[{k}] {rel}: name dài {len(nm)} > 141")
            sh = [x for x in lst if x.get("area") == "_shared"]
            if len(sh) >= 2:
                for x in sh[:2]:
                    nm = x.get("name", "")
                    if len(nm) < 15 or "Ranh giới" in nm or "CLAUDE.md" in nm or nm.startswith(("ADR", "T-")):
                        bad.append(f"[{k}] _shared {x.get('id')}: name phải là phần mô tả thật, thấy {nm!r}")
            if "--table" in sys.argv and not public:
                tp = Path(sys.argv[sys.argv.index("--table") + 1])
                tp.write_text("| vùng | mã | nguồn | tên | file |\n| --- | --- | --- | --- | --- |\n" + "\n".join(
                    f"| {x['area']} | {x['id']} | {x['source'] or '-'} | {x['name'].replace('|', '/')} | {x.get('path','')} |" for x in lst) + "\n", encoding="utf-8")
            js = json.dumps(m, ensure_ascii=False)
            for s in ("/home/", "/root/"):
                if s in js: bad.append(f"[{k}] model chứa đường dẫn máy {s!r}")


if crit in ("1", "6"):
    run_fake(crit == "6")
elif crit == "7":
    run_real()
else:
    bad.append("--criterion phải là 1, 6 hoặc 7")
if bad:
    for b in bad[:14]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
