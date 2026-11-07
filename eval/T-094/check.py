#!/usr/bin/env python3
"""Eval tầng 1 của T-094 (spec products/T-094-ten-bat-bien-khong-lo-code.md). Chạy exporter THẬT, cả có và không --public.
  --criterion 1: fixture tên (bảng F1..F12 trong spec mục B): tên đúng từng ký tự, không bao giờ là dòng code / đường dẫn máy / "handoffs/".
  --criterion 2: file bất biến ở gốc eval/invariants: area hợp lệ (không "."), url không chứa "/./" hay "//" sau eval/invariants/, path đúng.
  --criterion 3: tên của toàn bể thật không đổi so với eval/T-094/ten-hien-tai.json (trừ file đã sửa 12 dòng đầu sau khi chụp, hoặc ca ghi trong
                 "sua_co_chu_y"); mọi tên đều không là code/đường dẫn máy; trùng quy tắc độc lập eval/T-094/namerule2.py.
Tiêu chí 4 (INV-009, INV-017 xanh) chạy thẳng hai bất biến, xem spec. Chạy: cd /home/user/tohong-hq && python3 eval/T-094/check.py --criterion N
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import namerule2 as nr  # noqa: E402

URL = "https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/"
LONG = "Đây là mô tả hợp lệ của bất biến này, dài hơn năm mươi ký tự"

# tên file -> (nội dung, tên mong đợi viết tay, KHÔNG sinh từ namerule2)
FIX = {
 "inv-101-bo-qua-dong-code.py": ('#!/usr/bin/env python3\n"""Bất biến hq/x · nguồn: T-001 (spec abc).\nr = subprocess.run(["bash", "build.sh", "--all"], capture_output=True, text=True)\n' + LONG + '. Câu hai.\n"""\n', LONG),
 "inv-102-het-dong-code.py": ('# Bất biến hq/x · nguồn: T-002.\nROOT = Path(__file__).resolve().parent.parent.parent.parent\n# INV-102 · Mô tả ở bước hai\n', "Mô tả ở bước hai"),
 "inv-103-mot-a-la-code.py": ('# Bất biến (hq/x): r = subprocess.run(["bash"], check=True)\n# Dòng văn xuôi dài hơn năm mươi ký tự nhưng không được nhặt ở đây.\n# INV-103 · Mô tả bước hai ba\n', "Mô tả bước hai ba"),
 "inv-104-co-duong-dan-may.sh": ('#!/usr/bin/env bash\n# Bất biến: chạy trong /home/user/tohong-hq/eval và so kết quả với bản cũ\nexit 0\n', "co duong dan may"),
 "inv-105-handoffs-trong-ten.sh": ('#!/usr/bin/env bash\n# Bất biến: đọc handoffs/T-001-v1.md rồi đối chiếu số liệu\nexit 0\n', "handoffs trong ten"),
 "inv-106-tmp-root-roi-xuong.sh": ('#!/usr/bin/env bash\n# Bất biến hq/x · nguồn: T-003.\n# Ghi tạm ở /tmp/out và /root/.cache để so sánh, dài hơn năm mươi ký tự đấy.\n# Mô tả đúng của bất biến này nằm ở dòng thứ tư, đủ dài để được chọn\nexit 0\n', "Mô tả đúng của bất biến này nằm ở dòng thứ tư, đủ dài để được chọn"),
 "inv-107-lenh-shell.sh": ('#!/usr/bin/env bash\n# Bất biến hq/x · nguồn: T-004.\nsource "$HERE/lib/common.sh" && run_all_checks --verbose --strict\nif [ -f "$ROOT/scripts/export_dashboard.py" ]; then echo ok; fi\nset -u\n# ' + LONG + ' (sau lệnh)\n', LONG + " (sau lệnh)"),
 "inv-108-doi-chung-ngoac-bang.sh": ('#!/usr/bin/env bash\n# Bất biến: số lưu (amt) = số ở dòng khoản; tổng khớp\nexit 0\n', "số lưu (amt) = số ở dòng khoản; tổng khớp"),
 "inv-109-doi-chung-backtick.sh": ('#!/usr/bin/env bash\n# Bất biến: `capu_queue` không phụ thuộc thư mục con\nexit 0\n', "`capu_queue` không phụ thuộc thư mục con"),
 "inv-110-dong-inv-la-code.sh": ('#!/usr/bin/env bash\n# INV-110 · x = f(y)\nexit 0\n', "dong inv la code"),
 "inv-111.sh": ('#!/usr/bin/env bash\n# Bất biến: cd /root/work && python3 run.py\nexit 0\n', "inv-111.sh"),
 "inv-112-doi-chung-mo-ta-co-slash.sh": ('#!/usr/bin/env bash\n# Bất biến: scripts/export_dashboard.py không sập khi area sửa tay\nexit 0\n', "scripts/export_dashboard.py không sập khi area sửa tay"),
}
# Dạng dòng code bể thật hay có (D1 của spec-critic): mỗi dòng đặt giữa dòng nguồn và một dòng mô tả sạch; tên mong đợi = dòng mô tả sạch.
CODE = [
 'exec node "$HERE/lib/loc_inv.cjs" --repo "$REPO" --check kr-sum',
 'back, front = os.path.abspath(a.back), os.path.abspath(a.front)',
 'T, G, X = (load("a"), load("b"), load("c"), load("d"), load("e"))',
 'count: int = len([x for x in range(100) if x % 3 == 0 and x > 10])',
 'L.task("new", "--title", "x", "--to", "engineering", "--tier", "B",',
 'result = run_checks(first_argument, second_argument, third_argument,',
 'cat "$ROOT/board/T-001.md" | sed -n 1,12p | grep -c area',
 'sed -n 1,12p "$ROOT/board/T-001.md" | awk \'{print $1}\' | jq -r .x',
 'mkdir -p "$TMP/ledger/board" && printf "%s\\n" "$X" > "$TMP/x"',
 'rm -rf "$TMP/ledger" "$TMP/out" "$TMP/err" "$TMP/more-files-here"',
 'npx playwright test --project=chromium --reporter=line eval/T-094',
 'local out; out=$(run_one_check "$1" 2>&1) || return 1; echo "$out"',
 'test -f "$ROOT/scripts/export_dashboard.py" || { echo skip; exit 0; }',
 'case "$1" in --public) MODE=public;; *) MODE=normal;; esac; shift',
 'f = lambda path, mode="r", enc="utf-8": open(path, mode, encoding=enc)',
 'command -v node >/dev/null 2>&1 || { echo "thiếu node"; exit 1; }',
 'đọc tại /Users/capu/work/tohong-hq/eval/x.py rồi so sánh với bản cũ ở máy khác',
 'sys.path.insert(0, os.path.join(repo, "matcher"))  # profile.py che stdlib `profile`: chủ ý, giống thật',
 'env.pop("TOHONG_LIVE_URL", None)   # sổ cái giả không đẩy lên dashboard thật, chỉ chạy cục bộ',
 'subprocess.run(["bash", "build.sh"], check=True)  # dựng bản thật trước khi so sánh tên',
 'await page.goto(url, { waitUntil: "load" }); // chờ trang tải xong rồi mới đo vị trí',
 'xem nhật ký ở /var/log/tohong/export.log để biết lần chạy trước đã xong chưa',
 'cài ở /opt/tohong/bin/export_dashboard rồi chạy thử bản xuất công khai đó',
]
for _i, _c in enumerate(CODE):
    FIX[f"inv-{130 + _i}-dong-code-{_i}.sh"] = ("#!/usr/bin/env bash\n# Bất biến hq/x · nguồn: T-00%d.\n# %s\n# Mô tả sạch số %d của bất biến này, đủ dài hơn năm mươi ký tự để chọn\n" % (_i, _c, _i), "Mô tả sạch số %d của bất biến này, đủ dài hơn năm mươi ký tự để chọn" % _i)
# Đối chứng (không được bị loại): văn xuôi tiếng Việt mở đầu bằng từ trùng từ khoá, trích pipe/mũi tên trong ngoặc
KEEP = [
 'do lỗi mạng nên trang không tải được, bản xuất vẫn phải đủ số liệu của bể',
 'test thử khi chọn sản phẩm thì mọi con số trên màn hình đổi theo bộ chọn',
 'case khác xảy ra khi bể trống: khối vẫn hiện 0 và không báo lỗi gì cả',
 'Không eval nào dừng tiến trình theo TÊN (' + 'p' + 'kill, `p' + 'grep x | xargs ' + 'kill`) vì giết nhầm',   # ghép lúc chạy để INV-010 planner/vendor/images không quét trúng
 'số lượng (a = 1, b = 2) phải khớp tổng trong khối, kể cả khi có mô tả dài thêm',
 'ngôn ngữ C# và mục #3 phải hiện đúng trong tên, không bị cắt ở dấu thăng',   # T-099: # không có khoảng trắng hai bên thì không tách
 'hàm f(x) # ghi chú dài thêm cho đủ dòng mô tả của bất biến này, phần trước không là code',   # T-099: tách ra nhưng phần trước không thỏa mục A -> giữ nguyên cả dòng
]
for _i, _c in enumerate(KEEP):
    FIX[f"inv-{160 + _i}-doi-chung-van-xuoi-{_i}.sh"] = ("#!/usr/bin/env bash\n# Bất biến: %s\nexit 0\n" % _c, _c)
# Hệ quả đã biết của điều 4: văn xuôi có mũi tên ASCII "->" bị loại, tên rơi xuống slug
FIX["inv-170-mui-ten-trong-van-xuoi.sh"] = ("#!/usr/bin/env bash\n# Bất biến: đỏ -> rework, xanh -> merge theo bậc của việc\nexit 0\n", "mui ten trong van xuoi")


def export(f, out, pub):
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                       capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(f)))
    if r.returncode:
        return None, f"exporter thoát {r.returncode}: {r.stderr.strip()[-200:]}"
    return (json.loads((out / "dashboard.json").read_text(encoding="utf-8")).get("model") or {}), ""


def ledger(t, files):
    f = t / "ledger"; (f / "board").mkdir(parents=True); (f / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
    shutil.copy(ROOT / "board" / "T-041.md", f / "board" / "T-041.md")
    for rel, txt in files.items():
        p = f / "eval" / "invariants" / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(txt, encoding="utf-8")
    return f


def c1():
    bad = []
    with tempfile.TemporaryDirectory() as t:
        t = Path(t); f = ledger(t, {"hq/dashboard/" + k: v[0] for k, v in FIX.items()})
        for pub in (False, True):
            k = "public" if pub else "thường"
            m, err = export(f, t / ("o" + k), pub)
            if m is None: bad.append(f"[{k}] {err}"); continue
            got = {x["url"].rsplit("/", 1)[-1]: x["name"] for x in m.get("invariant_list", [])}
            for fn, (_, want) in FIX.items():
                if got.get(fn) != want: bad.append(f"[{k}] {fn}: name {got.get(fn)!r}, mong {want!r}")
            for fn, n in got.items():
                if fn not in FIX: continue
                if any(p in n for p in ("/home/", "/root/", "/tmp/", "handoffs/")): bad.append(f"[{k}] {fn}: name chứa đường dẫn máy/handoffs/: {n!r}")
    return bad


def c2():
    bad = []
    with tempfile.TemporaryDirectory() as t:
        t = Path(t); f = ledger(t, {"inv-201-o-goc.sh": "#!/usr/bin/env bash\n# Bất biến: file ở gốc bể vẫn có vùng hợp lệ\nexit 0\n",
                                    "_shared/inv-202-chung.sh": "#!/usr/bin/env bash\n# Bất biến: file chung\nexit 0\n",
                                    "hq/dashboard/inv-203-vung.sh": "#!/usr/bin/env bash\n# Bất biến: file vùng\nexit 0\n"})
        for pub in (False, True):
            k = "public" if pub else "thường"
            m, err = export(f, t / ("o" + k), pub)
            if m is None: bad.append(f"[{k}] {err}"); continue
            lst = m.get("invariant_list", [])
            if m.get("invariants_total") != 3 or len(lst) != 3: bad.append(f"[{k}] phải đếm 3 file, thấy total={m.get('invariants_total')} len={len(lst)}")
            by = {x["url"].rsplit("/", 1)[-1]: x for x in lst}
            r = by.get("inv-201-o-goc.sh")
            if not r: bad.append(f"[{k}] thiếu inv-201-o-goc.sh"); continue
            if r.get("area") != "_root": bad.append(f"[{k}] area của file ở gốc phải là '_root', thấy {r.get('area')!r}")
            if r.get("url") != URL + "inv-201-o-goc.sh": bad.append(f"[{k}] url phải là {URL}inv-201-o-goc.sh, thấy {r.get('url')!r}")
            for x in lst:
                if not re.fullmatch(r"_shared|_root|[a-z0-9_-]+(?:/[a-z0-9_-]+)*", x.get("area", "")): bad.append(f"[{k}] area không hợp lệ {x.get('area')!r}")
                u = x.get("url", "")
                if not u.startswith(URL) or "/./" in u or "//" in u[len("https://"):] or "/../" in u: bad.append(f"[{k}] url không hợp lệ {u!r}")
            if m.get("invariants") != {"_root": 1, "_shared": 1, "hq/dashboard": 1}: bad.append(f"[{k}] invariants theo vùng sai: {m.get('invariants')}")
            if [x["area"] for x in lst] != ["_shared", "_root", "hq/dashboard"]: bad.append(f"[{k}] thứ tự phải _shared, _root, hq/dashboard; thấy {[x['area'] for x in lst]}")
            if pub and any("path" in x for x in lst): bad.append("[public] có khoá path")
            if not pub and r.get("path") != "eval/invariants/inv-201-o-goc.sh": bad.append(f"[thường] path phải eval/invariants/inv-201-o-goc.sh, thấy {r.get('path')!r}")
    return bad


def head12(text):
    return hashlib.sha1("\n".join(text.split("\n")[:12]).encode("utf-8")).hexdigest()


def c3():
    bad = []
    snap = json.loads((HERE / "ten-hien-tai.json").read_text(encoding="utf-8"))
    ok = snap.get("sua_co_chu_y", {})
    ents = snap["ten"]
    for pub in (False, True):
        k = "public" if pub else "thường"
        with tempfile.TemporaryDirectory() as t:
            out = Path(t) / "o"
            r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if pub else []),
                               capture_output=True, text=True, env={kk: v for kk, v in os.environ.items() if kk != "TOHONG_ROOT"})
            if r.returncode: bad.append(f"[{k}] exporter thoát {r.returncode}"); continue
            lst = json.loads((out / "dashboard.json").read_text(encoding="utf-8"))["model"]["invariant_list"]
        n_cmp = 0
        for x in lst:
            rel = x["url"][len(URL):]
            p = ROOT / "eval" / "invariants" / rel
            n = x["name"]
            if any(s in n for s in ("/home/", "/root/", "/tmp/", "handoffs/")): bad.append(f"[{k}] {rel}: name chứa đường dẫn máy/handoffs/: {n!r}")
            if nr.looks_like_code(n): bad.append(f"[{k}] {rel}: name là dòng code {n!r}")
            if not p.is_file(): continue
            txt = p.read_text(encoding="utf-8", errors="replace")
            slug = x["slug"]
            want2 = nr.name(txt, slug, p.name)
            if n != want2: bad.append(f"[{k}] {rel}: name {n!r} khác quy tắc độc lập {want2!r}")
            e = ents.get(rel)
            if e and e["sha12"] == head12(txt):
                n_cmp += 1
                if n != e["name"] and rel not in ok: bad.append(f"[{k}] {rel}: name đổi {e['name']!r} -> {n!r} (không nằm trong sua_co_chu_y)")
        if n_cmp < 20: bad.append(f"[{k}] chỉ so được {n_cmp} file với ảnh chụp (cần >= 20): ảnh chụp lỗi thời?")
    return bad


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--criterion", type=int, required=True); a = ap.parse_args()
    bad = {1: c1, 2: c2, 3: c3}[a.criterion]()
    print("FAIL " + "; ".join(bad[:10]) if bad else "PASS")
    sys.exit(1 if bad else 0)
