#!/usr/bin/env node
// T-199 adv-02 (tầng 3, adversary): nhãn "Status" của ô lọc phải THẬT SỰ được vẽ ra màn hình (spec T-197 mục 1: "nhìn thấy được ... không trong suốt, không bị cắt hay che").
// check_1 đo hình học + elementFromPoint, nên ba cách giấu vẫn lọt (Spec critic ghi trong note accept T-197): clip-path: inset(50%), chữ cùng màu nền, lớp phủ pointer-events:none.
// Eval này đo bằng PIXEL: chụp đúng hộp chữ "Status", rồi tô chữ đó trong suốt và chụp lại. Chữ được vẽ thật thì hai ảnh khác nhau ở >= 20 điểm ảnh;
// bị cắt, bị che hay cùng màu nền thì hai ảnh như nhau. Đo ở khung 1280x900 và 1024x768.
// Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-199/adv-02-nhan-status-ve-ra-pixel.mjs --repo . --case 1   (TOHONG_BACK_REPO)
import zlib from "node:zlib";
import { scenario, closeAll } from "../T-197/lib/ui.mjs";
import { reporter } from "../T-197/lib/common.mjs";

const R = reporter();
// Giải mã PNG 8-bit RGB/RGBA không xen kẽ (ảnh chụp của Chromium).
function decode(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (type === "IDAT") idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}
const diffPx = (A, B) => { let n = 0; for (let i = 0; i < A.w * A.h; i++) for (let k = 0; k < 3; k++) if (Math.abs(A.px[i * A.bpp + k] - B.px[i * B.bpp + k]) > 24) { n++; break; } return n; };

try {
  for (const vp of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }]) {
    const S = await scenario("small", vp);
    await S.select.scrollIntoViewIfNeeded();
    // Đánh dấu đúng đoạn chữ "Status" trong <label> gắn với ô (bọc tạm vào <span> không đổi kiểu chữ), trả hộp bao của nó.
    const box = await S.select.evaluate((el) => {
      for (const l of el.labels) {
        const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const k = n.data.indexOf("Status"); if (k < 0) continue;
          const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 6);
          const b = r.getBoundingClientRect();
          return { x: b.left, y: b.top, width: b.width, height: b.height };
        }
      }
      return null;
    });
    R.check(`[${vp.width}] có chữ "Status" trong <label> gắn với ô`, !!box && box.width > 0 && box.height > 0, box);
    if (!box) { await S.ctx.close(); continue; }
    const clip = { x: Math.max(0, Math.floor(box.x) - 1), y: Math.max(0, Math.floor(box.y) - 1), width: Math.ceil(box.width) + 2, height: Math.ceil(box.height) + 2 };
    await S.page.mouse.move(0, 0);
    const shot1 = decode(await S.page.screenshot({ clip, animations: "disabled", caret: "hide" }));
    // tô trong suốt riêng các nút chữ chứa "Status" (bọc span), giữ nguyên bố cục
    await S.select.evaluate((el) => {
      for (const l of el.labels) {
        const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT); const hits = [];
        for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.includes("Status")) hits.push(n);
        for (const n of hits) { const s = document.createElement("span"); s.setAttribute("data-adv", "1"); s.style.cssText = "color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important"; n.replaceWith(s); s.appendChild(n); }
      }
    });
    const shot2 = decode(await S.page.screenshot({ clip, animations: "disabled", caret: "hide" }));
    const n = diffPx(shot1, shot2);
    R.check(`[${vp.width}] chữ "Status" được VẼ thật: ẩn chữ đi thì ảnh vùng nhãn đổi ở >= 20 điểm ảnh (đổi ${n}) — không bị clip-path, lớp phủ hay cùng màu nền giấu`, n >= 20, n);
    await S.ctx.close();
  }
} catch (e) {
  R.check("thao tác không thực hiện được", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
