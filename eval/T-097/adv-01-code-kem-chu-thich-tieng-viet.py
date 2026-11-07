#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục A): dòng code Python/JS có chú thích cuối dòng bằng tiếng Việt không được thành tên bất biến.
Dạng này có thật trong 12 dòng đầu của file eval trong repo: eval/T-072/lib/run_py.py
(`sys.path.insert(0, os.path.join(repo, "matcher"))  # profile.py che stdlib ...`) và eval/T-063/eval-mirror.py (`env.pop("TOHONG_LIVE_URL", None)   # sổ cái giả ...`).
Chú thích tiếng Việt làm dòng không còn toàn ASCII và ngoặc cân bằng, nên A.7 (gọi hàm) và A.9 không bắt; bước 1b nhặt dòng code làm tên.
Mong đợi: name của mọi file là dòng mô tả sạch (dòng thứ hai >= 50 ký tự), cả có và không --public.
Chạy: python3 eval/T-097/adv-01-code-kem-chu-thich-tieng-viet.py   Mã thoát 0 = đạt."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import run  # noqa: E402

H = "# Bất biến hq/x · nguồn: T-999.\n"
DESC = "# mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code\n"
CODE = {
    "inv-801-sys-path.py": 'sys.path.insert(0, os.path.join(repo, "matcher"))  # profile.py che stdlib `profile`: chủ ý, giống thật',
    "inv-802-env-pop.py": 'env.pop("TOHONG_LIVE_URL", None)   # sổ cái giả không đẩy lên dashboard thật, chỉ chạy cục bộ',
    "inv-803-subprocess.py": 'subprocess.run(["bash", "build.sh"], check=True)  # dựng bản thật trước khi so sánh tên',
    "inv-804-js-call.cjs": 'await page.goto(url, { waitUntil: "load" }); // chờ trang tải xong rồi mới đo vị trí',
}
FILES = {"hq/x/" + k: H + v + "\n" + DESC for k, v in CODE.items()}
want = "mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code"
bad = []
for k, (m, _) in run(FILES).items():
    for x in m.get("invariant_list") or []:
        tag = x.get("url", "").rsplit("/", 1)[-1]
        if x.get("name") != want:
            bad.append(f"[{k}] {tag}: name = {x.get('name')!r}, mong đợi dòng mô tả sạch")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
