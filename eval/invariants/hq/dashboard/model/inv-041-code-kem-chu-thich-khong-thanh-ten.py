#!/usr/bin/env python3
"""Bất biến hq/dashboard/model · nguồn: T-097 (eval đối kháng eval/T-097/adv-01-code-kem-chu-thich-tieng-viet.py, adversary rút vào bể sau ADR-039; spec T-094 mục A).
Dòng code Python/JS có chú thích cuối dòng (kể cả chú thích tiếng Việt) không bao giờ thành tên bất biến trong dashboard.json, ở cả bản thường và bản công khai
Dạng có thật trong repo: eval/T-072/lib/run_py.py (`sys.path.insert(...)  # profile.py che stdlib ...`), eval/T-063/eval-mirror.py (`env.pop(...)   # sổ cái giả ...`).
Chú thích tiếng Việt làm dòng không còn toàn ASCII nên luật "gọi hàm" (A.7) và A.9 dễ trượt; bước 1b có thể nhặt dòng code làm tên.
Dựng sổ cái tạm với 4 file: dòng 1 là tiêu đề, dòng 2 là code kèm chú thích cuối dòng, dòng 3 là mô tả sạch; chạy scripts/export_dashboard.py THẬT
(có và không --public): name của mọi phần tử model.invariant_list phải đúng bằng dòng mô tả sạch.
Chạy: python3 -I eval/invariants/hq/dashboard/model/inv-041-code-kem-chu-thich-khong-thanh-ten.py   Mã thoát 0 = đạt. In PASS hoặc FAIL <lý do>."""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT") or Path(__file__).resolve().parent)
while not (ROOT / "scripts" / "export_dashboard.py").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent

H = "# Bất biến hq/x · nguồn: T-999.\n"
DESC = "# mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code\n"
WANT = "mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code"
CODE = {
    "inv-801-sys-path.py": 'sys.path.insert(0, os.path.join(repo, "matcher"))  # profile.py che stdlib `profile`: chủ ý, giống thật',
    "inv-802-env-pop.py": 'env.pop("TOHONG_LIVE_URL", None)   # sổ cái giả không đẩy lên dashboard thật, chỉ chạy cục bộ',
    "inv-803-subprocess.py": 'subprocess.run(["bash", "build.sh"], check=True)  # dựng bản thật trước khi so sánh tên',
    "inv-804-js-call.cjs": 'await page.goto(url, { waitUntil: "load" }); // chờ trang tải xong rồi mới đo vị trí',
}
FILES = {"hq/x/" + k: H + v + "\n" + DESC for k, v in CODE.items()}

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
            bad.append(f"[{k}] exporter thoát {r.returncode}: {r.stderr[-300:]}"); continue
        lst = (json.loads((out / "dashboard.json").read_text(encoding="utf-8")).get("model") or {}).get("invariant_list") or []
        if len(lst) != len(FILES): bad.append(f"[{k}] đếm {len(lst)} != {len(FILES)} file")
        for x in lst:
            tag = (x.get("url") or "").rsplit("/", 1)[-1] or "?"
            if x.get("name") != WANT:
                bad.append(f"[{k}] {tag}: name = {x.get('name')!r}, mong đợi dòng mô tả sạch")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
