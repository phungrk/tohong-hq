#!/usr/bin/env python3
"""Áp dụng thay đổi eval cũ do T-211 (spec products/T-211-sua-tay-dia-chi-sdt-vendor.md, "Eval cũ bị đổi"), SAU khi Chief of Staff ghi ADR.
Sửa duy nhất eval/T-152/check_3_lich_su_va_etag.mjs dòng "sửa liên hệ": T-152 4.4 cấm số điện thoại vào lịch sử; T-211 mục 6 cho phép riêng SĐT.
Dòng mới: sửa contact.zalo (đòi changes.contact.changed === true, lịch sử không chứa giá trị zalo), giữ ý đồ gốc cho zalo/website.
Idempotent: chạy lần hai báo 'đã áp dụng'. Chạy: python3 -I eval/T-211/ap-dung-sua-check3-t152.py  (từ bất kỳ đâu trong tohong-hq; ADR-070 dò ngược)."""
import os, sys
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
p = os.path.join(d, "eval", "T-152", "check_3_lich_su_va_etag.mjs")
s = open(p, encoding="utf-8").read()
OLD1 = 'await up(venue.id, { contact: { phone: "0909000111" } }, A1);'
NEW1 = 'await up(venue.id, { contact: { zalo: "0909000111" } }, A1);'
OLD2 = 'R.check("sửa liên hệ: history có changes.contact = {changed:true}, không lộ số"'
NEW2 = 'R.check("sửa liên hệ (zalo): history có changes.contact = {changed:true}, không lộ giá trị zalo (T-211: riêng SĐT có changes.phone)"'
if NEW1 in s and NEW2 in s:
    print("PASS đã áp dụng (không đổi gì)"); sys.exit(0)
if OLD1 not in s or OLD2 not in s:
    print("FAIL không thấy dòng cần sửa trong " + p); sys.exit(1)
open(p, "w", encoding="utf-8").write(s.replace(OLD1, NEW1).replace(OLD2, NEW2))
print("PASS đã sửa " + os.path.relpath(p, d)); sys.exit(0)
