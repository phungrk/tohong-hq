#!/usr/bin/env python3
"""INV-043 hq/dashboard/model · nguồn: T-100 (eval đối kháng eval/T-100/adv-01-xuat-danh-sach-bien-file.py, adversary rút vào bể sau khi exporter
phungrk/tohong-hq#32 và dashboard #22 merge, 2026-11-08). Spec: products/T-096-drawer-tab-keo-rong.md mục A.
Bất biến: hợp đồng biên của exporter cho adversarial_list/regression_list giữ ở cả bản thường và --public:
  1. dòng CRLF và byte không phải UTF-8 trong comment đầu file: exporter không sập, ký tự thay thế U+FFFD, name không còn \\r;
  2. thư mục con tên adv-* trong eval/T-xxx/ không phải file thường: không đếm, không liệt kê;
  3. thứ tự trong một việc theo cụm chữ không phân biệt hoa thường (adv-02-a-c trước adv-02-B-c) và cụm số (adv-2 trước adv-10);
  4. file adv-* không đuôi: id = tên file; file rỗng: name = tên file;
  5. thư mục eval/X-1, eval/T-abc không phải việc: bỏ qua;
  6. hồi quy: README.md, .gitkeep bỏ; thư mục là một mục (url tree/, id nguyên văn, name thay - và _ bằng dấu cách, source T-8);
     mã t- viết thường không là source; thứ tự cụm số (reg-2 trước reg-10); adversarial_evals/regression_evals = độ dài danh sách;
  7. hai chế độ chỉ khác khoá path; --public không /tmp/, /home/, /root/, không đường dẫn sổ cái tạm.
Cách đo: dựng sổ cái tạm (org/roster.json và một file board chép từ sổ cái thật, eval/T-905 với 7 file adv-* biên, eval/regression/ biên),
chạy scripts/export_dashboard.py THẬT với TOHONG_ROOT trỏ sổ cái tạm, có và không --public, so từng khoá.
Chưa có adversarial_list/regression_list trong model (trước T-096) thì in "PASS chưa áp dụng".
Chạy: python3 -I eval/invariants/hq/dashboard/model/inv-043-xuat-danh-sach-bien-file.py   In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent
GH = "https://github.com/phungrk/tohong-hq/"
bad = []


def export(root, out, public):
    env = dict(os.environ, TOHONG_ROOT=str(root))
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if public else []),
                       capture_output=True, text=True, env=env)
    if r.returncode != 0:
        bad.append(f"exporter thoát {r.returncode}: {(r.stderr.strip().splitlines() or ['?'])[-1][:200]}")
        return None, ""
    raw = (out / "dashboard.json").read_text(encoding="utf-8")
    return json.loads(raw), raw


if not (ROOT / "scripts" / "export_dashboard.py").exists():
    print("FAIL không thấy scripts/export_dashboard.py (đặt TOHONG_ROOT)"); sys.exit(1)

with tempfile.TemporaryDirectory() as t:
    tmp = Path(t); f = tmp / "ledger"
    (f / "board").mkdir(parents=True); (f / "org").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", f / "org" / "roster.json")
    boards = sorted((ROOT / "board").glob("T-*.md"))
    one = ROOT / "board" / "T-041.md"
    if not one.exists() and boards:
        one = boards[0]
    if one.exists():
        shutil.copy(one, f / "board" / one.name)
    E = f / "eval" / "T-905"; E.mkdir(parents=True)
    (E / "adv-01.py").write_bytes("#!/usr/bin/env python3\r\n# Kiểm tra dòng hỏng ".encode() + b"\xff" + " có ký tự lạ ở giữa\r\nprint(1)\r\n".encode())
    (E / "adv-02-B-c.sh").write_text("# x\n", encoding="utf-8")
    (E / "adv-02-a-c.sh").write_text("# x\n", encoding="utf-8")
    (E / "adv-10-muoi-x.sh").write_text("# x\n", encoding="utf-8")
    (E / "adv-2-hai-x.sh").write_text("# x\n", encoding="utf-8")
    (E / "adv-03").write_text("# Kiểm tra file không có đuôi mở rộng\n", encoding="utf-8")
    (E / "adv-04.sh").write_text("", encoding="utf-8")
    (E / "adv-thu-muc").mkdir(); (E / "adv-thu-muc" / "x.sh").write_text("# x\n", encoding="utf-8")
    for junk in ("X-1", "T-abc"):
        (f / "eval" / junk).mkdir(); (f / "eval" / junk / "adv-01-khong-tinh.sh").write_text("# x\n", encoding="utf-8")
    R = f / "eval" / "regression"; R.mkdir()
    (R / "README.md").write_text("# readme\n", encoding="utf-8"); (R / ".gitkeep").write_text("", encoding="utf-8")
    (R / "reg-10-T-12-sau.sh").write_text("# x\n", encoding="utf-8")
    (R / "reg-2-t-5-truoc.sh").write_text("# x\n", encoding="utf-8")
    (R / "T-8_ca-thu-muc").mkdir(); (R / "T-8_ca-thu-muc" / "a.sh").write_text("# x\n", encoding="utf-8")

    res = {}
    for public in (False, True):
        d, raw = export(f, tmp / ("p" if public else "n"), public)
        if not d: continue
        k = "public" if public else "thường"; m = d.get("model", {})
        if "adversarial_list" not in m and "regression_list" not in m:
            print("PASS chưa áp dụng: model chưa có adversarial_list/regression_list (trước T-096)"); sys.exit(0)
        res[public] = m
        A, Rl = m.get("adversarial_list") or [], m.get("regression_list") or []
        files = [x["file"] for x in A]
        want = ["adv-01.py", "adv-02-a-c.sh", "adv-02-B-c.sh", "adv-2-hai-x.sh", "adv-03", "adv-04.sh", "adv-10-muoi-x.sh"]
        if files != want: bad.append(f"[{k}] adversarial_list file/thứ tự phải {want}, thấy {files}")
        if m.get("adversarial_evals") != len(A) or len(A) != 7: bad.append(f"[{k}] adversarial_evals {m.get('adversarial_evals')} / len {len(A)} phải 7 (thư mục adv-*, X-1, T-abc không đếm)")
        by = {x["file"]: x for x in A}
        a1 = by.get("adv-01.py", {})
        if "\r" in a1.get("name", "") or not a1.get("name", "").startswith("adv-01 · Kiểm tra dòng hỏng �"): bad.append(f"[{k}] adv-01.py (CRLF, byte hỏng) name sai: {a1.get('name')!r}")
        a3 = by.get("adv-03", {})
        if a3.get("id") != "adv-03" or a3.get("name") != "adv-03 · Kiểm tra file không có đuôi mở rộng": bad.append(f"[{k}] adv-03 không đuôi: id/name sai {a3}")
        a4 = by.get("adv-04.sh", {})
        if a4.get("name") != "adv-04.sh": bad.append(f"[{k}] adv-04.sh rỗng phải name = tên file, thấy {a4.get('name')!r}")
        if any(x["source"] != "T-905" for x in A): bad.append(f"[{k}] source phải T-905")
        rf = [x["file"] for x in Rl]
        if rf != ["reg-2-t-5-truoc.sh", "reg-10-T-12-sau.sh", "T-8_ca-thu-muc"]: bad.append(f"[{k}] regression_list thứ tự/tập sai: {rf}")
        if m.get("regression_evals") != len(Rl): bad.append(f"[{k}] regression_evals {m.get('regression_evals')} khác len {len(Rl)}")
        rb = {x["file"]: x for x in Rl}
        if rb.get("reg-2-t-5-truoc.sh", {}).get("source") != "": bad.append(f"[{k}] reg-2-t-5: 't-5' thường không phải mã, source phải ''")
        if rb.get("reg-10-T-12-sau.sh", {}).get("source") != "T-12": bad.append(f"[{k}] reg-10-T-12: source phải T-12")
        dd = rb.get("T-8_ca-thu-muc", {})
        if dd.get("id") != "T-8_ca-thu-muc" or dd.get("name") != "T 8 ca thu muc" or dd.get("url") != GH + "tree/main/eval/regression/T-8_ca-thu-muc" or dd.get("source") != "T-8":
            bad.append(f"[{k}] thư mục hồi quy sai: {dd}")
        for x in A + Rl:
            keys = set(x)
            wantk = {"id", "file", "name", "source", "url"} | (set() if public else {"path"})
            if keys != wantk: bad.append(f"[{k}] {x.get('file')}: khoá {sorted(keys)} phải {sorted(wantk)}")
        if public:
            for s in ("/tmp/", str(tmp), "/home/", "/root/"):
                if s in raw: bad.append(f"[public] dashboard.json chứa {s!r}")
    if len(res) == 2:
        strip = lambda L: [{k: v for k, v in x.items() if k != "path"} for x in L]
        for key in ("adversarial_list", "regression_list"):
            if strip(res[False].get(key) or []) != strip(res[True].get(key) or []): bad.append(f"{key}: bản thường và public khác nhau ngoài path")

if bad:
    print("FAIL " + "; ".join(bad[:8]) + (f" (+{len(bad) - 8} lỗi nữa)" if len(bad) > 8 else "")); sys.exit(1)
print("PASS")
