#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục A/B): file CRLF, thụt bằng tab, BOM ở đầu; dòng code đứng trước dòng mô tả.
Mong đợi: name là dòng mô tả sạch (không \\r, không tab, không BOM), cả hai chế độ.
Chạy: python3 eval/T-097/adv-03-crlf-va-tab.py   Mã thoát 0 = đạt."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import run  # noqa: E402

D = "mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code"
FILES = {
    "hq/x/inv-701-crlf.py": "# Bất biến hq/x · nguồn: T-999.\r\nr = subprocess.run([\"bash\", \"x.sh\", \"--all\"], capture_output=True)\r\n# " + D + "\r\n",
    "hq/x/inv-702-tab.sh": "#\tBất biến hq/x · nguồn: T-999.\n\texec node \"$HERE/lib/loc_inv.cjs\" --repo \"$REPO\" --check kr-sum\n#\t" + D + "\n",
    "hq/x/inv-703-bom.sh": "\ufeff# Bất biến: cd /root/work && python3 run.py --home /home/user/x\n# INV-703 · " + D + "\n",
}
bad = []
for k, (m, _) in run(FILES).items():
    for x in m.get("invariant_list") or []:
        if x.get("name") != D: bad.append(f"[{k}] {x.get('url','').rsplit('/',1)[-1]}: name = {x.get('name')!r}")
if bad:
    for b in bad[:8]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
