#!/usr/bin/env python3
"""Đối kháng T-097 (spec T-094 mục A', T-099): nháy lồng nhau, nháy chưa đóng, dấu '\\', nháy nằm trong phần chú thích.
Mong đợi viết tay theo mục A' (cả có và không --public, exporter THẬT):
  - "it's" lồng trong nháy kép; 'a "b' lồng trong nháy đơn; nháy trong phần chú thích: vẫn tách -> dòng code bị loại -> mô tả sạch;
  - dấu chú thích nằm trong chuỗi ("a # b") rồi mới có chú thích thật: tách ở chú thích thật -> bị loại;
  - nháy kép chưa đóng: không tách -> dòng giữ nguyên làm name;
  - '\\"' không phải dấu thoát: chuỗi đóng ở '\\"', mở lại ở '"' sau, nên ' # ' sau đó nằm trong chuỗi -> không tách -> giữ nguyên;
  - văn xuôi 'hàm f(x) # ghi chú có "nháy': head không phải code -> giữ nguyên.
Chạy: python3 eval/T-097/adv-05-nhay-va-dau-thoat.py   Mã thoát 0 = đạt."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _adv_lib import run  # noqa: E402

H = "# Bất biến hq/x · nguồn: T-999.\n"
D = "mô tả sạch: tên bất biến luôn là câu văn xuôi đọc được, không phải dòng code"
L = {
    "inv-911-nhay-don-trong-kep.py": ('print("it\'s ok", total)  # in ra chuỗi có nháy đơn lồng bên trong nháy kép', D),
    "inv-912-nhay-kep-trong-don.py": ("env.pop('KEY \"x', None)  # nháy kép lồng trong nháy đơn, vẫn phải tách được", D),
    "inv-913-nhay-trong-chu-thich.py": ("sys.exit(main())  # đừng đổi 'main' thành \"run\" khi sửa lại chỗ này nhé", D),
    "inv-914-dau-trong-chuoi.py": ('log.info("a # b", x)  # dấu thăng trong chuỗi không tách, chú thích này mới tách', D),
    "inv-915-chua-dong.py": ('env.pop("TOHONG_X, None)  # chuỗi chưa đóng nên không có điểm tách nào cả', None),
    "inv-916-dau-thoat.py": ('fmt("a\\"b", c)  # dấu thoát không được xét nên phần này vẫn ở trong chuỗi', None),
    "inv-917-van-xuoi.py": ('hàm f(x) # ghi chú có "nháy chưa đóng ở phần chú thích của câu văn', None),
}
FILES = {"hq/x/" + k: H + v[0] + "\n# " + D + "\n" for k, v in L.items()}
bad = []
for k, (m, _) in run(FILES).items():
    got = {x.get("url", "").rsplit("/", 1)[-1]: x.get("name") for x in m.get("invariant_list") or []}
    for f, (line, want) in L.items():
        want = want or line
        if got.get(f) != want: bad.append(f"[{k}] {f}: name = {got.get(f)!r}, mong đợi {want!r}")
if bad:
    for b in bad[:10]: print("FAIL " + b)
    sys.exit(1)
print("PASS")
