#!/usr/bin/env python3
"""T-152 (quyết định của Capu 2026-11-13: drawer luôn PHỦ, bỏ chế độ ĐẨY của T-147 B4; tiền lệ ADR-074: product sửa eval cũ trong đúng phạm vi quyết định).
Sửa eval/T-147/check_6_ui_drawer.cjs: các khẳng định ép chế độ ĐẨY đổi thành PHỦ; hộp thoại Approve/Rút lại/Sửa thủ công khi drawer mở dùng dispatchEvent('click') (nút nằm dưới drawer thì chuột không tới, đúng ý PHỦ).
CHẠY SAU KHI T-151 (front #71) merge: T-151 còn đang qua Code Gate với đúng file này, sửa trước làm đỏ gate của T-151. Dùng: python3 -I eval/T-152/ap-dung-check6-t147.py [--file đường-dẫn]  (mặc định sửa file thật; chạy lại lần hai in 'đã áp dụng'). Không dùng git."""
import os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
f = sys.argv[sys.argv.index("--file") + 1] if "--file" in sys.argv else os.path.join(HQ, "eval", "T-147", "check_6_ui_drawer.cjs")
t = open(f, encoding="utf-8").read()
if "T-152: PHỦ" in t:
    print("đã áp dụng"); sys.exit(0)
R = [
 ("check('1280 mặc định (còn 720 >= 640): chế độ ĐẨY, bảng không dưới drawer', wb.x + wb.width <= gg.left + 1, JSON.stringify([wb.x + wb.width, gg.left]));",
  "check('1280 mặc định: chế độ PHỦ (T-152), bảng nằm dưới drawer, không bị đẩy', wb.x + wb.width > gg.left + 20, JSON.stringify([wb.x + wb.width, gg.left]));"),
 ("check('chế độ ĐẨY: trang không cuộn ngang'", "check('T-152: PHỦ: trang không cuộn ngang'"),
 ("check('biên: drawer 632 (còn 648 >= 640) vẫn ĐẨY', near(w632.w, 632, 2) && wbA.x + wbA.width <= w632.left + 1,",
  "check('biên: drawer 632 vẫn PHỦ (T-152: không còn ngưỡng đẩy)', near(w632.w, 632, 2) && wbA.x + wbA.width > w632.left + 20,"),
 ("check('biên: drawer 656 (còn 624 < 640) chuyển sang PHỦ: bảng nằm dưới drawer, không bị đẩy'", "check('biên: drawer 656 PHỦ: bảng nằm dưới drawer, không bị đẩy'"),
 ("await S.row('Gamma Garden').getByRole('button', { name: 'Approve', exact: true }).click();\n    await page.waitForFunction(() => /Chờ áp dụng/.test(document.body.innerText));\n    check('drawer mở: Approve",
  "await S.row('Gamma Garden').getByRole('button', { name: 'Approve', exact: true }).dispatchEvent('click');\n    await page.waitForFunction(() => /Chờ áp dụng/.test(document.body.innerText));\n    check('drawer mở: Approve"),
 ("await S.row('Gamma Garden').getByRole('button', { name: 'Rút lại', exact: true }).click();", "await S.row('Gamma Garden').getByRole('button', { name: 'Rút lại', exact: true }).dispatchEvent('click');"),
 ("await S.row('Delta Palace').getByRole('button', { name: 'Sửa thủ công', exact: true }).click();\n    const md =", "await S.row('Delta Palace').getByRole('button', { name: 'Sửa thủ công', exact: true }).dispatchEvent('click');\n    const md ="),
 ("/* ----- bảng vẫn dùng được khi drawer mở (chế độ ĐẨY) ----- */", "/* ----- T-152: PHỦ: bảng vẫn xử lý được sự kiện khi drawer mở (nút dưới drawer chỉ bấm bằng chuột sau khi đóng) ----- */"),
]
for a, b in R:
    if t.count(a) != 1:
        print("FAIL không tìm đúng một chỗ để thay: " + a[:70]); sys.exit(1)
    t = t.replace(a, b)
t = t.replace("const fs = require('fs');", "// T-152: PHỦ (đã sửa bởi eval/T-152/ap-dung-check6-t147.py)\nconst fs = require('fs');", 1)
open(f, "w", encoding="utf-8").write(t)
print("đã áp dụng")
