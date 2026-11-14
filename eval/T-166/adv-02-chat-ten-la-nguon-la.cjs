#!/usr/bin/env node
/* T-166 adv-02 (adversary, tầng 3): input lạ ở bốn bề mặt chat (danh sách, chi tiết từng ảnh, chọn so sánh, bảng so sánh) và hai bề mặt đã lưu (tra pool được).
 *  A: source " GOOGLE " (hoa, khoảng trắng), host lh3.ggpht.com (không phải googleusercontent) => vẫn là ảnh Google theo source; tên RTL + emoji, có khoảng trắng đầu/cuối => hiện đã trim.
 *  B: ảnh Google có attribution không phải chuỗi (mảng) => thiếu tên => không hiện, rồi ảnh marry => marry hiện, chữ "ZZARR156" không xuất hiện.
 *  C: tên 120 ký tự (trần của INV-045), có token dài không dấu cách và emoji => nhìn thấy, không cắt, không tràn ngang 390px.
 *  D: source "marry" nhưng host lh5.googleusercontent.com, không attribution => ảnh Google thiếu tên => không hiện (vendor về ảnh mặc định).
 *  E: source "google" ở host CDN lạ, có tên => là ảnh Google theo source => phải có ghi công.
 * Chạy: node adv-02-chat-ten-la-nguon-la.cjs --repo <tohong-front> */
const path = require('path');
const L = require(path.join(__dirname, '..', 'T-156', 'lib', 'f156.cjs'));
const F = require(path.join(__dirname, '..', 'T-156', 'lib', 'flows156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
// mọi host ảnh lạ trả PNG giả (không mạng ngoài)
const wrapped = { launch: async (...a) => { const br = await chromium.launch(...a); const nc = br.newContext.bind(br);
  br.newContext = async (o) => { const ctx = await nc(o); await ctx.route(/^https:\/\/(lh3\.ggpht\.com|lh5\.googleusercontent\.com|cdn\.anh-la\.example)\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: L.PNG })); return ctx; };
  return br; } };
let A;
(async () => {
  const pool = L.loadPool();
  const base = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1)).find((v) => v.category === 'photography');
  const marry = pool.flatMap((v) => v.photos).find((p) => !L.isG(p));
  const mk = (id, name, photos) => ({ ...base, id, name, photos });
  const LONG = ('Studio' + 'X'.repeat(70) + ' 📸👰🏻‍♀️ & Nguyễn Văn Ánh Sáng Đêm Trăng Rằm ').slice(0, 118).trim();
  const V = {
    A: mk('adv_a', 'Alpha Rtl Studio', [{ url: 'https://lh3.ggpht.com/adv/a1=s800', source: ' GOOGLE ', attribution: '  محمد المصور 📸  ' }]),
    B: mk('adv_b', 'Beta Mang Studio', [{ url: 'https://lh3.googleusercontent.com/adv/b1=s800', source: 'google', attribution: ['ZZARR156'] }, { url: marry.url, source: 'marry' }]),
    C: mk('adv_c', 'Gamma Dai Studio', [{ url: 'https://lh3.googleusercontent.com/adv/c1=s800', source: 'google', attribution: LONG }]),
    D: mk('adv_d', 'Delta Nhan Sai', [{ url: 'https://lh5.googleusercontent.com/adv/d1=s800', source: 'marry' }]),
    E: mk('adv_e', 'Epsilon Cdn Studio', [{ url: 'https://cdn.anh-la.example/adv/e1.jpg', source: 'google', attribution: 'Tac Gia Cdn ZZ166' }]),
  };
  const vendors = Object.values(V);
  A = await L.startApp(REPO, wrapped);
  await F.chatFlow(A, { vendors, blocked: [], detail: [V.A, V.B, V.C, V.E], anchor: V.A, picks: [V.C, V.E], forbid: ['ZZARR156'] }, R.bad);
  await F.savedFlow(A, { vendors, blocked: [], lookup: 'ok', budgetOf: [V.A, V.C, V.E], forbid: ['ZZARR156'] }, (m) => R.bad('[đã lưu] ' + m));
  // tràn ngang ở danh sách chat với tên dài
  const pg = await A.open('__t156c.html', '', { vendors });
  try { await pg.waitForFunction((n) => document.body.innerText.includes(n), V.C.name, { timeout: 20000 }); await pg.waitForTimeout(1500);
    const w = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.querySelector('#cards').scrollWidth));
    if (w > 391) R.bad(`danh sách chat: tràn ngang ${w}px > 390 với tên tác giả dài`);
  } catch (e) { R.bad('tràn ngang: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
