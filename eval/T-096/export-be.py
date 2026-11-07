#!/usr/bin/env python3
"""Eval tầng 1 của T-096 (spec products/T-096-drawer-tab-keo-rong.md), tiêu chí 1-2: danh sách eval đối kháng và hồi quy trong khối `model`.
  cd /home/user/tohong-hq && python3 eval/T-096/export-be.py --criterion 1|2
1: sổ cái tạm nhiều biến thể (cả thường và --public): khoá, số, id, file, name, source, url, path, thứ tự, mốc thân eval không lọt
2: sổ cái thật (cả hai chế độ): số = độ dài danh sách = đếm độc lập; name không rỗng/không là code/đường dẫn máy; mọi path tồn tại; INV-009
Dùng exporter THẬT (TOHONG_ROOT trỏ sổ cái tạm). Không đọc mã exporter. Phụ thuộc T-094 (quy tắc "dòng code" mục A): chạy sau khi T-094 merge.
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
crit = sys.argv[sys.argv.index("--criterion") + 1] if "--criterion" in sys.argv else "1"
bad = []
GH = "https://github.com/phungrk/tohong-hq/"
SENT = "SECRET_BODY_SENTINEL_96"


def export(root, out, public):
    env = dict(os.environ, TOHONG_ROOT=str(root))
    cmd = [sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if public else [])
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        bad.append(f"export_dashboard.py thoát {r.returncode}: {(r.stderr.strip().splitlines() or ['?'])[-1][:200]}")
        return None
    return json.loads((out / "dashboard.json").read_text(encoding="utf-8")), (out / "dashboard.json").read_text(encoding="utf-8")


def w(base, rel, text):
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


LONG = "Dòng mô tả rất dài " + "lặp lại nhiều lần " * 12   # > 140 ký tự, không có ". "


def make_fake(tmp):
    f = tmp / "ledger"
    (f / "board").mkdir(parents=True); (f / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
    shutil.copy(ROOT / "board" / "T-041.md", f / "board" / "T-041.md")
    body = f"echo {SENT}\n"
    w(f, "eval/invariants/_shared/inv-001-x.sh", "#!/usr/bin/env bash\n# Bất biến: Không có secret.\n" + body)
    E = "eval/"
    w(f, E + "T-901/adv-01-co-mo-ta.sh", "#!/usr/bin/env bash\n# Eval đối kháng T-901 (adversary). Chạy trong repo dashboard.\nset -u\n" + body)
    w(f, E + "T-901/adv-02-docstring.py", '#!/usr/bin/env python3\n"""T-901 adv-02 (adversary, tầng 3). Spec T-899 mục 4 + INV-001.\nDòng hai."""\nprint("' + SENT + '")\n')
    w(f, E + "T-901/adv-03.cjs", "#!/usr/bin/env node\n/*\n * Eval đối kháng (tầng 3) của T-901: input phá.\n */\nconsole.log('" + SENT + "')\n")
    w(f, E + "T-901/adv-10-muoi.sh", "# Kiểm tra số thứ tự tự nhiên của tên file\n" + body)
    w(f, E + "T-902/adv-01-chi-code.sh", '#!/usr/bin/env bash\nset -u\nROOT="$(pwd)"\nexec node x.cjs\n' + body)
    w(f, E + "T-902/adv-02.sh", "#!/usr/bin/env bash\nset -u\n" + body)
    w(f, E + "T-902/adv-03-duong-dan.sh", "# Chạy trong /home/user/tohong-hq/eval và đọc handoffs/T-1-v1.md rồi ghi lại\n# Kiểm tra số liệu hiển thị đúng sau khi đổi bộ chọn sản phẩm\n" + body)
    w(f, E + "T-903/adv-01-ten-dai.sh", "# " + LONG + "\n" + body)
    w(f, E + "T-903/adv-02-chi-the.sh", "# T-903 adv-02 (adversary)\n# Kiểm tra mục hai đủ dài ở dòng sau\n" + body)
    w(f, E + "T-100/adv-01.py", '"""Tầng 3 T-100 · input: tên trùng khoá.\n"""\n' + f"print('{SENT}')\n")
    w(f, E + "T-99/adv-01.sh", "# Số T nhỏ hơn đứng sau\n" + body)
    # không tính:
    w(f, E + "T-901/lib/adv-x.cjs", "//\n"); w(f, E + "T-901/bat-bien-cho-merge/adv-y.sh", "echo\n"); w(f, E + "T-901/adv-dir/z.sh", "echo\n")
    w(f, E + "T-901/gate-latest.json", "{}\n"); w(f, E + "loose/adv-05.sh", "echo\n"); w(f, E + "invariants/_shared/adv-77.sh", "echo\n")
    # hồi quy
    for n in (".gitkeep", "README.md"): w(f, E + "regression/" + n, "")
    w(f, E + "regression/reg-T-050-so-dem.sh", "# Hồi quy T-050: số đếm không lệch sau khi đổi bộ chọn\n" + body)
    w(f, E + "regression/T-060-kanban/run.sh", "# trong thư mục\n" + body)
    w(f, E + "regression/doi_chung.py", '"""Kiểm tra bản vá cũ không quay lại"""\n' + f"print('{SENT}')\n")
    return f


def want_adv():
    # (task, file, name, id) theo thứ tự: số T giảm dần, trong một T tên file theo số tự nhiên tăng dần
    return [
        ("T-903", "adv-01-ten-dai.sh", None, "adv-01-ten-dai"),
        ("T-903", "adv-02-chi-the.sh", "Kiểm tra mục hai đủ dài ở dòng sau", "adv-02-chi-the"),
        ("T-902", "adv-01-chi-code.sh", "chi code", "adv-01-chi-code"),
        ("T-902", "adv-02.sh", "adv-02.sh", "adv-02"),
        ("T-902", "adv-03-duong-dan.sh", "Kiểm tra số liệu hiển thị đúng sau khi đổi bộ chọn sản phẩm", "adv-03-duong-dan"),
        ("T-901", "adv-01-co-mo-ta.sh", "Chạy trong repo dashboard", "adv-01-co-mo-ta"),
        ("T-901", "adv-02-docstring.py", "Spec T-899 mục 4 + INV-001", "adv-02-docstring"),
        ("T-901", "adv-03.cjs", "của T-901: input phá", "adv-03"),
        ("T-901", "adv-10-muoi.sh", "Kiểm tra số thứ tự tự nhiên của tên file", "adv-10-muoi"),
        ("T-100", "adv-01.py", "input: tên trùng khoá", "adv-01"),
        ("T-99", "adv-01.sh", "Số T nhỏ hơn đứng sau", "adv-01"),
    ]


def want_reg():
    # (file, name, source, id, loại) theo tên (không phân biệt hoa thường), bỏ .gitkeep, README.md
    return [
        ("doi_chung.py", "Kiểm tra bản vá cũ không quay lại", "", "doi_chung", "blob"),
        ("reg-T-050-so-dem.sh", "Hồi quy T-050: số đếm không lệch sau khi đổi bộ chọn", "T-050", "reg-T-050-so-dem", "blob"),
        ("T-060-kanban", "T 060 kanban", "T-060", "T-060-kanban", "tree"),
    ]


def check_fake(m, public):
    k = "public" if public else "thường"
    for key in ("adversarial_list", "regression_list"):
        if not isinstance(m.get(key), list):
            bad.append(f"[{k}] model thiếu mảng {key}"); return
    A, R = m["adversarial_list"], m["regression_list"]
    if m.get("adversarial_evals") != 11 or len(A) != 11:
        bad.append(f"[{k}] adversarial_evals/len(adversarial_list) phải 11/11, thấy {m.get('adversarial_evals')}/{len(A)}")
    if m.get("regression_evals") != 3 or len(R) != 3:
        bad.append(f"[{k}] regression_evals/len(regression_list) phải 3/3, thấy {m.get('regression_evals')}/{len(R)}")
    want_keys = {"id", "file", "name", "source", "url"} | (set() if public else {"path"})
    for it in A + R:
        if set(it) != want_keys:
            bad.append(f"[{k}] khoá phần tử phải đúng {sorted(want_keys)}, thấy {sorted(it)}")
            break
    for got, (task, file, name, id_) in zip(A, want_adv()):
        loc = f"[{k}] {task}/{file}"
        if got.get("file") != file or got.get("source") != task:
            bad.append(f"{loc}: thứ tự/nguồn sai, thấy file={got.get('file')} source={got.get('source')}"); continue
        if got.get("id") != id_: bad.append(f"{loc}: id phải {id_!r}, thấy {got.get('id')!r}")
        if name is None:
            n = got.get("name", "")
            if not (n.startswith("Dòng mô tả rất dài") and n.endswith("…") and len(n) <= 141 and "\n" not in n):
                bad.append(f"{loc}: tên dài phải cắt 140 ký tự + …, thấy {len(n)} ký tự {n[-10:]!r}")
        elif got.get("name") != name:
            bad.append(f"{loc}: name phải {name!r}, thấy {got.get('name')!r}")
        if got.get("url") != f"{GH}blob/main/eval/{task}/{file}": bad.append(f"{loc}: url sai: {got.get('url')}")
        if not public and got.get("path") != f"eval/{task}/{file}": bad.append(f"{loc}: path phải eval/{task}/{file}, thấy {got.get('path')}")
    for got, (file, name, src, id_, kind) in zip(R, want_reg()):
        loc = f"[{k}] regression/{file}"
        if got.get("file") != file: bad.append(f"{loc}: thứ tự sai, thấy {got.get('file')}"); continue
        if got.get("name") != name: bad.append(f"{loc}: name phải {name!r}, thấy {got.get('name')!r}")
        if got.get("source") != src: bad.append(f"{loc}: source phải {src!r}, thấy {got.get('source')!r}")
        if got.get("id") != id_: bad.append(f"{loc}: id phải {id_!r}, thấy {got.get('id')!r}")
        if got.get("url") != f"{GH}{kind}/main/eval/regression/{file}": bad.append(f"{loc}: url phải {GH}{kind}/main/eval/regression/{file}, thấy {got.get('url')}")
        if not public and got.get("path") != f"eval/regression/{file}": bad.append(f"{loc}: path sai: {got.get('path')}")


def check_leak(raw, tmp, public):
    if SENT in raw: bad.append(f"[{'public' if public else 'thường'}] dashboard.json chứa thân eval ({SENT})")
    if public:
        for s in ("/home/", "/root/", "/tmp/", "handoffs/", str(tmp)):
            if s in raw: bad.append(f"[public] dashboard.json chứa {s!r}")
        if '"path"' in json.dumps({k: v for k, v in json.loads(raw)["model"].items() if k in ("adversarial_list", "regression_list")}):
            bad.append("[public] adversarial_list/regression_list còn khoá path")


def real():
    sys.path.insert(0, str(ROOT / "eval" / "T-094"))
    try:
        import namerule2 as nr
    except Exception as e:  # noqa
        bad.append(f"không nạp được eval/T-094/namerule2.py (T-094 chưa vào?): {e}"); return
    advs = sorted(p for d in (ROOT / "eval").iterdir() if d.is_dir() and re.fullmatch(r"T-\d+", d.name) for p in d.iterdir() if p.is_file() and p.name.startswith("adv-"))
    reg_dir = ROOT / "eval" / "regression"
    regs = [p for p in reg_dir.iterdir() if not p.name.startswith(".") and p.name != "README.md"] if reg_dir.is_dir() else []
    with tempfile.TemporaryDirectory() as t:
        for public in (False, True):
            k = "public" if public else "thường"
            r = export(ROOT, Path(t) / ("p" if public else "n"), public)
            if not r: continue
            d, raw = r; m = d.get("model", {})
            A, R = m.get("adversarial_list"), m.get("regression_list")
            if not isinstance(A, list) or not isinstance(R, list): bad.append(f"[{k}] thiếu adversarial_list/regression_list"); continue
            if not (len(A) == m.get("adversarial_evals") == len(advs) > 0): bad.append(f"[{k}] adversarial: list {len(A)}, số {m.get('adversarial_evals')}, đếm độc lập {len(advs)}")
            if not (len(R) == m.get("regression_evals") == len(regs)): bad.append(f"[{k}] regression: list {len(R)}, số {m.get('regression_evals')}, đếm độc lập {len(regs)}")
            if m.get("regression_evals") != d.get("regression_evals"): bad.append(f"[{k}] khoá gốc regression_evals phải bằng model.regression_evals")
            if sorted((x["source"], x["file"]) for x in A) != sorted((p.parent.name, p.name) for p in advs): bad.append(f"[{k}] tập (việc, file) của adversarial_list khác đếm độc lập")
            for x in A + R:
                n = x.get("name", "")
                if not n or "\n" in n or len(n) > 141: bad.append(f"[{k}] {x.get('file')}: name rỗng/nhiều dòng/quá dài"); continue
                if nr.looks_like_code(n) or n.startswith("#!"): bad.append(f"[{k}] {x.get('file')}: name là dòng code/đường dẫn máy: {n[:60]!r}")
                if not x.get("url", "").startswith(GH): bad.append(f"[{k}] {x.get('file')}: url sai")
                if not public and not (ROOT / x.get("path", "?")).exists(): bad.append(f"[{k}] path không tồn tại: {x.get('path')}")
            if public:
                for s in ("/home/", "/root/", "/tmp/", "handoffs/", str(ROOT)):
                    if s in raw: bad.append(f"[public] dashboard.json chứa {s!r}")
                if any("path" in x for x in A + R): bad.append("[public] còn khoá path")
            # thứ tự adv: số T giảm dần
            tn = [int(x["source"][2:]) for x in A]
            if tn != sorted(tn, reverse=True): bad.append(f"[{k}] adversarial_list phải sắp theo số việc giảm dần")


if crit == "1":
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t); f = make_fake(tmp)
        for public in (False, True):
            r = export(f, tmp / ("p" if public else "n"), public)
            if r:
                check_fake(r[0].get("model", {}), public); check_leak(r[1], tmp, public)
elif crit == "2":
    real()
else:
    bad.append("--criterion phải là 1 hoặc 2")
if bad:
    print("FAIL " + "; ".join(bad[:8]) + (f" (+{len(bad) - 8} lỗi nữa)" if len(bad) > 8 else "")); sys.exit(1)
print("PASS")
