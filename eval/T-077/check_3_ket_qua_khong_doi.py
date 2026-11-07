#!/usr/bin/env python3
"""T-077 tiêu chí 3: PASS/FAIL trên code hiện tại không đổi. (a) Chạy riêng từng cái: small_tile_tooltip trên front gốc PASS; C10 trên bản sao PASS (baseline đo 2026-11-07).
(b) Không nới ngưỡng: đột biến trên bản sao front -> M1 ảnh hỏng không ra ảnh mặc định: C10 FAIL (lý do chứa 'ảnh'... xem MUT); M2 ô minh hoạ mất thuộc tính title (hết tooltip): small_tile_tooltip FAIL vì tooltip.
Chạy: python3 eval/T-077/check_3_ket_qua_khong_doi.py [--evalroot DIR] [--front DIR]. In PASS/FAIL; thoát 0/1."""
import sys, os, re, shutil
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import c, h
errs = []
def sub_(dst, f, fn):
    p = os.path.join(dst, f); s = open(p, encoding="utf-8").read(); n = fn(s)
    if n == s: raise RuntimeError(f"không phá được bản sao: {f} đã đổi dạng, cập nhật đột biến")
    open(p, "w", encoding="utf-8").write(n)
M1 = r"return \{ isGood: \(url\) => results\.get\(url\) === true, isBad: \(url\) => results\.get\(url\) === false \};"
def m1(d): sub_(d, "src/vendorImages.js", lambda s: re.sub(M1, "return { isGood: () => true, isBad: () => false };", s))
def m2(d): sub_(d, "src/vendorIllustrations.jsx", lambda s: s.replace("title={chip ? undefined : label}", "title={undefined}"))
tmp = c.private_tmp()
try:
    cp = c.front_copy(tmp, "front-ok")
    l, _, _ = c.run_stt(c.FRONT, tmp)
    if not l.startswith("PASS"): errs.append("small_tile_tooltip trên code hiện tại đáng ra PASS, thấy: " + l[:100])
    l, _, _ = c.run_c10(cp, tmp)
    if not l.startswith("PASS"): errs.append("C10 trên code hiện tại đáng ra PASS, thấy: " + l[:100])
    d = c.front_copy(tmp, "front-m1", m1); l, _, o = c.run_c10(d, tmp)
    if not l.startswith("FAIL"): errs.append("C10 trên đột biến M1 (ảnh hỏng không ra mặc định) đáng ra FAIL, thấy: " + l[:100])
    elif "lỗi chạy eval" in o: errs.append("C10 trên M1 FAIL nhưng vì lỗi chạy eval, không vì hành vi ảnh: " + l[:100])
    h.kill_pids(h.marked())
    d = c.front_copy(tmp, "front-m2", m2); l, _, o = c.run_stt(d, tmp)
    if not l.startswith("FAIL"): errs.append("small_tile_tooltip trên đột biến M2 (mất title) đáng ra FAIL, thấy: " + l[:100])
    elif "tooltip" not in o or "lỗi chạy eval" in o: errs.append("small_tile_tooltip trên M2 FAIL nhưng không vì tooltip (sai lý do): " + l[:100])
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(c.FRONT); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS code hiện tại: small_tile_tooltip PASS, C10 PASS; đột biến M1 -> C10 FAIL, M2 -> small_tile_tooltip FAIL đúng lý do")
