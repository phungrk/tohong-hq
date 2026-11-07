#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục A', T-099): loại ký tự trắng đứng trước/sau dấu chú thích cuối dòng.
Mục A': chỉ [ \\t] tạo điểm tách; NBSP (U+00A0), U+3000, \\r, U+2003 KHÔNG bao giờ tạo điểm tách.
Mong đợi viết tay (cả có và không --public, chạy exporter THẬT):
  - tab trước '#', tab sau '#', tab trước '//': dòng gọi hàm bị loại -> name = dòng mô tả sạch kế tiếp;
  - NBSP/U+3000/U+2003 trước '#' hoặc NBSP sau '#': không tách -> dòng (không toàn ASCII, ngoặc cân) giữ làm name nguyên văn
    (hệ quả spec chọn có chủ ý, đo để exporter không 'rộng tay' hơn namerule2);
  - và looks_like_code của exporter == namerule2 trên từng chuỗi, kể cả \\r giữa dòng (đơn vị, vì read_text đổi \\r lẻ thành xuống dòng).
Chạy: python3 eval/T-097/adv-04-khoang-trang-truoc-chu-thich.py   Mã thoát 0 = đạt."""
import importlib.util, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import run, ROOT  # noqa: E402

H = "# Bất biến hq/x · nguồn: T-999.\n"
D = "mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code"
C = 'env.pop("TOHONG_LIVE_URL", None)'
T = "sổ cái giả không đẩy lên dashboard thật, chỉ chạy cục bộ"
CASES = {  # tên file: (dòng code, name mong đợi)
    "inv-901-tab-truoc.py": (C + "\t# " + T, D),
    "inv-902-tab-sau.py": (C + " #\t" + T, D),
    "inv-903-tab-js.cjs": ('await page.goto(url, { waitUntil: "load" });\t// ' + T, D),
    "inv-904-nbsp-truoc.py": (C + " # " + T, C + " # " + T),
    "inv-905-u3000-truoc.py": (C + "　# " + T, C + "　# " + T),
    "inv-906-emsp-truoc.py": (C + " # " + T, C + " # " + T),
    "inv-907-nbsp-sau.py": (C + " # " + T, C + " # " + T),
}
FILES = {"hq/x/" + k: H + v[0] + "\n# " + D + "\n" for k, v in CASES.items()}
bad = []
for k, (m, _) in run(FILES).items():
    got = {x.get("url", "").rsplit("/", 1)[-1]: x.get("name") for x in m.get("invariant_list") or []}
    for f, (_, want) in CASES.items():
        if got.get(f) != want: bad.append(f"[{k}] {f}: name = {got.get(f)!r}, mong đợi {want!r}")

sys.path.insert(0, str(ROOT / "eval" / "T-094"))
import namerule2 as nr  # noqa: E402
sp = importlib.util.spec_from_file_location("exp", ROOT / "scripts" / "export_dashboard.py")
ex = importlib.util.module_from_spec(sp); sp.loader.exec_module(ex)
for w in (" ", "\t", " ", "\r", "　", " ", "​", "\x0b", "\x0c"):
    for s in (C + w + "# " + T, C + " #" + w + T, C + w + "// " + T, C + " //" + w + T, w + C + " # " + T + w):
        if ex.looks_like_code(s) != nr.looks_like_code(s): bad.append(f"looks_like_code lệch namerule2: {s!r}")
if bad:
    for b in bad[:10]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
