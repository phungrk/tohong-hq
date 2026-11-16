'use strict';
/* Bất biến INV-011 và INV-012 (planner/front/budget, front) · Nguồn: T-194 (spec products/T-194-man-ngan-sach-so-phan-bo-rong.md v3, qua Spec Gate 2026-11-16, spec-critic; D1, D2).
 * --which show  (INV-011): khi số phân bổ của hạng mục từ API là rỗng, null, chuỗi lạ hoặc chuỗi số, màn Ngân sách và thẻ ngân sách chat đọc
 *               CÙNG một số cho mỗi hạng mục; "Đã phân bổ" là tổng CỘNG các số đó (không nối chuỗi); màn không có "tr" đứng riêng, "abc", "NaN", "undefined", "null".
 * --which write (INV-012): ghi dự toán không ép dữ liệu đã lưu của hạng mục người dùng KHÔNG chỉnh ("", "abc", "20", bỏ khuyết giữ nguyên),
 *               ở ba lối ghi: chỉnh tay một hạng mục khác; ghi tự động khi nhà hàng đã chốt và số khách đổi; ghi lại sau lỗi (giá trị server do lần ghi khác đặt được giữ).
 * Chỉ đo chữ nhìn thấy và thân PUT; không đọc mã nguồn. Khung: eval/T-187/_lib.cjs + eval/T-192/_mini.cjs (dò gốc HQ ngược tới scripts/gate.py).
 * Biến: TOHONG_FRONT_REPO (hoặc --repo), PLAYWRIGHT_PATH. Thoát 0 = đạt, 1 = vi phạm, 2 = thiếu môi trường. */
const fs = require('fs'), path = require('path');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const HQ = (() => { let d = __dirname; for (;;) { if (fs.existsSync(path.join(d, 'scripts', 'gate.py'))) return d; const u = path.dirname(d); if (u === d) return null; d = u; } })();
if (!HQ) { console.log('FAIL không tìm thấy gốc tohong-hq (scripts/gate.py)'); process.exit(2); }
const E = require(path.join(HQ, 'eval', 'T-187', '_lib.cjs'));
const { rows, waitCard } = require(path.join(HQ, 'eval', 'T-192', '_mini.cjs'));
const S = E.setup();
const WHICH = arg('--which') || 'show';
const BARE_TR = /(?<![\p{L}\p{N}])tr(?![\p{L}\p{N}])/u;
const BAD_WORD = /undefined|NaN|\bnull\b|abc/;
const waitText = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re, { timeout: 15000 });
const listRow = (pg, name) => pg.evaluate((name) => {
  const b = [...document.querySelectorAll('button')].filter((e) => (e.innerText || '').split('\n')[0].trim() === name)[0];
  if (!b) return null;
  const t = b.innerText.replace(/\s+/g, ' ').trim();
  const m = t.slice(name.length).trim().match(/^(\S*?)tr(?![\p{L}\p{N}])/u);
  return { text: t, amt: m ? m[1] + 'tr' : null };
}, name);
const num = (x) => Number(x) || 0; /* chỉ dùng để tính tổng mong đợi từ chính số thẻ chat đọc ra, không khoá cách đọc */
const parseTr = (s) => (s && /^-?\d+(,\d)?tr$/.test(s) ? Number(s.replace('tr', '').replace(',', '.')) : null);
const MIXES = [
  [['photography', 'Chụp ảnh', ''], ['venue', 'Tiệc & nhà hàng', 'abc'], ['jewelry', 'Nhẫn cưới & trang sức', 30], ['attire', 'Trang phục', '20'], ['reserve', 'Dự phòng', null]],
  [['photography', 'Chụp ảnh', '20,5'], ['venue', 'Tiệc & nhà hàng', ' 7 '], ['jewelry', 'Nhẫn cưới & trang sức', '20tr'], ['attire', 'Trang phục', '3.4'], ['reserve', 'Dự phòng', '']],
];

async function show() {
  for (const [i, MIX] of MIXES.entries()) {
    const tag = `[ca ${i + 1}]`, doc = E.budgetDoc(MIX, { total_tr: 100, mung_tr: 0 }), names = MIX.map((c) => c[1]);
    const chat = {}, screen = {}; let body = '';
    let pg = await S.page('__t187c.html', '', { budget: doc });
    try { await waitCard(pg); await pg.waitForTimeout(800); const r = await rows(pg, names); for (const n of names) chat[n] = r[n] ? r[n].btn : null; } catch (e) { S.bad(`${tag} thẻ chat: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
    pg = await S.page('__t187b.html', '?v=budget', { budget: doc });
    try {
      await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
      for (const n of names) { const r = await listRow(pg, n); screen[n] = r ? r.amt : null; }
      body = E.dash(await S.bodyText(pg));
    } catch (e) { S.bad(`${tag} màn Ngân sách: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
    let sum = 0, ok = true;
    for (const n of names) {
      const c = parseTr(chat[n]);
      if (c === null) { S.bad(`${tag} thẻ chat: hàng "${n}" không phải số tiền, thấy "${chat[n]}"`); ok = false; continue; }
      if (screen[n] !== chat[n]) S.bad(`${tag} hàng "${n}": màn Ngân sách "${screen[n]}" khác thẻ chat "${chat[n]}"`);
      sum += num(MIX.find((x) => x[1] === n)[2]);
    }
    if (ok && !body.toLowerCase().includes(`đã phân bổ ${E.tr(sum)} / `)) S.bad(`${tag} "Đã phân bổ" phải là tổng cộng ${E.tr(sum)}, thấy "${body.slice(0, 200)}"`);
    if (BARE_TR.test(body)) S.bad(`${tag} màn Ngân sách còn "tr" đứng riêng: "${body.slice(0, 200)}"`);
    const w = body.match(BAD_WORD); if (w) S.bad(`${tag} màn Ngân sách lộ "${w[0]}"`);
  }
}

const same = (v, w) => (w === undefined ? v === undefined : (typeof v === typeof w && v === w));
const show_ = (v) => (v === undefined ? 'bỏ khuyết' : JSON.stringify(v));
const checkCats = (put, want, tag) => {
  const cats = (put && put.categories) || [];
  for (const [id, w] of Object.entries(want)) {
    const c = cats.find((x) => x.id === id);
    if (!c) { S.bad(`${tag}: thiếu hạng mục "${id}" trong bản gửi`); continue; }
    if (!same(c.allocated_tr, w)) S.bad(`${tag}: hạng mục không chỉnh "${id}" gửi ${show_(c.allocated_tr)}, đã lưu ${show_(w)}`);
  }
};
const baseDoc = () => {
  const doc = E.budgetDoc(MIXES[0], { total_tr: 100, mung_tr: 0 });
  doc.categories = doc.categories.filter((c) => c.id !== 'reserve'); doc.categories.push({ id: 'reserve', name: 'Dự phòng', pct: 10, items: [] });
  return doc;
};
const watch = (pg, puts) => pg.on('request', (r) => { if (r.method() === 'PUT' && /\/budget$/.test(r.url())) { try { puts.push(JSON.parse(r.postData() || '{}')); } catch (e) { puts.push(null); } } });
const last = (a) => a[a.length - 1];
const VEN = { id: 'inv_a', name: 'Alpha Hall', category: 'venue', priceMin: 3.9, priceMax: 3.9, price: 3.9, priceTotal: 6, priceSource: 'estimated', spec: '10 người/bàn' };

async function write() {
  const STORED = { photography: '', venue: 'abc', attire: '20', reserve: undefined };
  /* 1. chỉnh tay hạng mục khác (Nhẫn) */
  let puts = [], pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: baseDoc() }); watch(pg, puts);
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(2500);
    if (!puts.length) S.bad('chỉnh tay: không thấy lần ghi nào'); else checkCats(last(puts), STORED, 'chỉnh tay');
  } catch (e) { S.bad('chỉnh tay: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* 2. ghi tự động khi nhà hàng đã chốt + số khách đổi */
  puts = []; const docC = baseDoc(); docC.guests = 100;
  docC.categories.find((x) => x.id === 'venue').items = [{ id: 'vendor_inv_a', name: 'Alpha Hall', amt: 1, status: 'confirmed', vendor: true }];
  pg = await S.page('__t187b.html', '?v=budget&cat=venue', { budget: docC, seed: JSON.stringify({ venue: { shortlisted: [VEN], confirmed: VEN } }) }); watch(pg, puts);
  try {
    await waitText(pg, 'Dự toán'); await pg.waitForTimeout(3500);
    if (!puts.length) S.bad('ghi tự động: kịch bản chưa kích hoạt (không có lần ghi nào)'); else checkCats(last(puts), { ...STORED, jewelry: 30 }, 'ghi tự động');
  } catch (e) { S.bad('ghi tự động: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* 3. ghi lại sau lỗi: giá trị server do lần ghi khác đặt được giữ */
  puts = []; const D = baseDoc(); let fail = true;
  pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: D });
  await pg.route('http://localhost:8787/api/couples/t187/budget', async (r) => {
    const m = r.request().method(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (m === 'GET') return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify(D) });
    if (m === 'PUT') {
      const b = JSON.parse(r.request().postData() || '{}'); puts.push({ ok: !fail, b });
      if (fail) return r.fulfill({ status: 500, headers: h, contentType: 'application/json', body: '{"error":"boom"}' });
      Object.assign(D, JSON.parse(JSON.stringify({ total_tr: b.total_tr, guests: b.guests, mung_tr: b.mung_tr, categories: b.categories }))); return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify(D) });
    }
    return r.fallback();
  });
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press('ArrowRight'); await waitText(pg, 'Chưa lưu được dự toán');
    D.categories.find((x) => x.id === 'photography').allocated_tr = 50;
    fail = false; const n0 = puts.length;
    await pg.getByRole('button', { name: 'Thử lại' }).first().click(); await pg.waitForTimeout(2500);
    const ok = puts.slice(n0).filter((p) => p.ok);
    if (!ok.length) S.bad('ghi lại sau lỗi: không có lần ghi thành công'); else checkCats(last(ok).b, { photography: 50, venue: 'abc', attire: '20' }, 'ghi lại sau lỗi');
  } catch (e) { S.bad('ghi lại sau lỗi: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
}

S.run(WHICH === 'write' ? write : show);
