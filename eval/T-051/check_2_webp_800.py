#!/usr/bin/env python3
"""T-051 tiêu chí 2: ảnh ra là WebP, rộng <= 800px, không phóng to, đúng hướng và đúng nội dung ảnh gốc, chất lượng 80, bỏ EXIF.
Chạy: python3 eval/T-051/check_2_webp_800.py --back /đường/dẫn/tohong-back. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, io, math, warnings
warnings.simplefilter("ignore")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *
from PIL import Image

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")
w = Work()
try:
    need_summary(w.mirror(back), "mirror")
    man = w.man()["entries"]
    def out_img(path):
        e = man.get(w.fm.url(path))
        if not e or e["status"] != "ok": fail(f"{path} phải mirror thành công")
        f = os.path.join(w.out, e["file"])
        if not os.path.isfile(f): fail(f"thiếu file {e['file']}")
        raw = open(f, "rb").read()
        if raw[:4] != b"RIFF" or raw[8:12] != b"WEBP": fail(f"{e['file']} không phải WebP (magic byte)")
        if not e["file"].endswith(".webp"): fail("đuôi file phải là .webp")
        return Image.open(io.BytesIO(raw)), raw
    def near(c, d, tol=45): return all(abs(x - y) <= tol for x, y in zip(c[:3], d))
    # kích thước
    im, raw = out_img("/ok/big.jpg")
    if im.size != (800, 400): fail(f"big 2000x1000 phải ra 800x400, thấy {im.size}")
    im, _ = out_img("/ok/small.png")
    if im.size != (300, 200): fail(f"ảnh 300x200 không được phóng to, thấy {im.size}")
    im, _ = out_img("/ok/tall.jpg")
    if im.size != (800, 2400): fail(f"900x2700 phải ra 800x2400, thấy {im.size}")
    # hướng EXIF: 600x400 gắn orientation 6 hiển thị 400x600; ra file không còn EXIF
    im, raw = out_img("/ok/rot.jpg")
    if im.size != (400, 600): fail(f"ảnh EXIF xoay 90 độ phải ra 400x600 (đã xoay đúng hướng), thấy {im.size}")
    if b"EXIF" in raw: fail("file ra còn EXIF")
    # nội dung: 4 góc đúng màu; ảnh xoay 90 độ CW: tl->tr, tr->br, bl->tl, br->bl
    rgb = im.convert("RGB"); W, H = rgb.size
    pts = {"tl": rgb.getpixel((W // 4, H // 4)), "tr": rgb.getpixel((3 * W // 4, H // 4)), "bl": rgb.getpixel((W // 4, 3 * H // 4)), "br": rgb.getpixel((3 * W // 4, 3 * H // 4))}
    exp = {"tr": QUAD["tl"], "br": QUAD["tr"], "tl": QUAD["bl"], "bl": QUAD["br"]}
    for k in pts:
        if not near(pts[k], exp[k]): fail(f"ảnh xoay: góc {k} sai màu {pts[k]} (cần ~{exp[k]})")
    im, _ = out_img("/ok/big.jpg"); rgb = im.convert("RGB"); W, H = rgb.size
    for k, (x, y) in {"tl": (W // 4, H // 4), "tr": (3 * W // 4, H // 4), "bl": (W // 4, 3 * H // 4), "br": (3 * W // 4, 3 * H // 4)}.items():
        if not near(rgb.getpixel((x, y)), QUAD[k], 30): fail(f"big: góc {k} sai màu {rgb.getpixel((x, y))}")
    # PNG trong suốt giữ độ trong suốt
    im, _ = out_img("/ok/small.png")
    if "A" not in im.getbands() or im.convert("RGBA").getpixel((0, 0))[3] > 40: fail("PNG có alpha phải giữ alpha")
    # GIF động: một khung (khung đầu: 4 góc màu, không phải khung đen)
    im, _ = out_img("/ok/anim.gif")
    if getattr(im, "n_frames", 1) != 1: fail("GIF động phải ra ảnh tĩnh 1 khung")
    if im.size != (100, 100) or not near(im.convert("RGB").getpixel((25, 25)), QUAD["tl"], 30): fail("GIF phải lấy khung đầu")
    # chất lượng 80: dung lượng của ảnh nhiễu nằm giữa q70 và q90 của Pillow cùng kích thước
    src = Image.open(io.BytesIO(IMAGES["/ok/big.jpg"][0])).convert("RGB").resize((800, 400), Image.LANCZOS)
    sz = {}
    for q in (70, 90):
        b = io.BytesIO(); src.save(b, "WEBP", quality=q, method=4); sz[q] = len(b.getvalue())
    got = len(out_img("/ok/big.jpg")[1])
    if not (sz[70] * 0.8 <= got <= sz[90] * 1.2): fail(f"dung lượng {got}B ngoài khoảng của chất lượng ~80 ({sz[70]}..{sz[90]}B)")
    # PSNR so với ảnh gốc thu về cùng cỡ >= 30 dB
    ref = src; out = out_img("/ok/big.jpg")[0].convert("RGB")
    mse = sum((x - y) ** 2 for p, q in zip(ref.getdata(), out.getdata()) for x, y in zip(p, q)) / (800 * 400 * 3)
    psnr = 99 if mse == 0 else 10 * math.log10(255 * 255 / mse)
    if psnr < 30: fail(f"ảnh ra lệch nội dung gốc (PSNR {psnr:.1f} dB < 30)")
    # URL có Unicode / khoảng trắng tải được
    for p in ("/ok/Logo-công-nghệ-cưới.jpg", "/ok/with space (1).jpg"):
        out_img(p)
    # mọi file trong out là .webp thuộc manifest (không rác), trừ _headers
    allf = set()
    for r, _, fs in os.walk(w.out):
        for f in fs: allf.add(os.path.relpath(os.path.join(r, f), w.out))
    known = {e["file"] for e in man.values() if e["status"] == "ok"}
    extra = {f for f in allf if f not in known and f != "_headers"}
    if extra: fail("file thừa trong thư mục ra: " + ", ".join(sorted(extra)[:3]))
    ok(f"WebP, <=800px, đúng hướng/nội dung, q~80 ({got}B), PSNR {psnr:.0f}dB")
finally:
    w.stop()
