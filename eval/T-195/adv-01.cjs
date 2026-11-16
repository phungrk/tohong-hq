#!/usr/bin/env node
/* T-195 adv-01 (adversary, tầng 3): input biên spec T-194 v3 mà 5 eval tầng 1 chưa chạm. Chỉ đo thân PUT, chữ nhìn thấy, aria thanh trượt.
 *  A. GIẢM Tuần trăng mật 5 -> 4 với Dự phòng "abc": Dự phòng gửi 1 (số JSON; H0 "abc"=0, 0-(-1)=1); hạng mục khác nguyên.
 *  B. Tuần trăng mật đã lưu "5" (chuỗi), Dự phòng "20": giảm 1 -> honeymoon 4, reserve 21 (số).
 *  C. Tuần trăng mật đã lưu "abc", Dự phòng 50: tăng 1 -> honeymoon 1, reserve 49.
 *  D. Chỉnh trực tiếp hạng mục "abc" (Tiệc & nhà hàng, mốc 40, bước 1): gửi venue 1 (số); photography "", attire "20", jewelry 30, reserve bỏ khuyết nguyên.
 *  E. Cách đọc số thêm "1e3", "0x10", "   " (khoảng trắng), " 7 ": hàng tổng quan == thẻ chat == Number(x)||0; "Đã phân bổ" = tổng.
 *  F. Trang hạng mục " 7 ": "DỰ TOÁN 7tr", aria-valuenow 7; vendor đã lưu 10tr -> "Vượt 3tr so với dự toán"; trang "20,5": aria-valuenow 0, không NaN/"tr" trơ.
 * Chạy: node eval/T-195/adv-01.cjs [--repo <tohong-front>] */
const { E, rows, waitCard, waitText, listRow, val, BARE_TR, BAD_WORD } = require('../T-194/_b.cjs'); const S = E.setup();
const same = (v, w) => (w === undefined ? v === undefined : (typeof v === typeof w && v === w));
const show = (v) => (v === undefined ? 'bỏ khuyết' : JSON.stringify(v));
const watch = (pg, puts) => pg.on('request', (r) => { if (r.method() === 'PUT' && /\/budget$/.test(r.url())) { try { puts.push(JSON.parse(r.postData() || '{}')); } catch (e) { puts.push(null); } } });
const checkCats = (put, want, tag) => {
  const cats = (put && put.categories) || [];
  for (const [id, w] of Object.entries(want)) {
    const c = cats.find((x) => x.id === id);
    if (!c) { S.bad(`${tag}: thiếu "${id}"`); continue; }
    if (!same(c.allocated_tr, w)) S.bad(`${tag}: "${id}" gửi ${show(c.allocated_tr)} (mong ${show(w)})`);
  }
};
const MIXW = [['photography', 'Chụp ảnh', ''], ['venue', 'Tiệc & nhà hàng', 'abc'], ['jewelry', 'Nhẫn cưới & trang sức', 30], ['attire', 'Trang phục', '20']];
const docWith = (extra) => { const d = E.budgetDoc(MIXW, { total_tr: 100, mung_tr: 0 }); d.categories.push(...extra); return d; };
const slide = async (cat, doc, key, want, tag) => {
  const puts = []; const pg = await S.page('__t187b.html', `?v=budget&cat=${cat}`, { budget: doc }); watch(pg, puts);
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press(key); await pg.waitForTimeout(2500);
    if (!puts.length) S.bad(`${tag}: không thấy lần ghi`); else checkCats(puts[puts.length - 1], want, tag);
  } catch (e) { S.bad(tag + ': lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
};
const KEEP = { photography: '', venue: 'abc', jewelry: 30, attire: '20' };
S.run(async () => {
  const hm = (h, r) => [{ id: 'honeymoon', name: 'Tuần trăng mật', pct: 0, allocated_tr: h, items: [] }, { id: 'reserve', name: 'Dự phòng', pct: 10, allocated_tr: r, items: [] }];
  await slide('honeymoon', docWith(hm(5, 'abc')), 'ArrowLeft', { ...KEEP, honeymoon: 4, reserve: 1 }, 'A. giảm Tuần trăng mật, Dự phòng "abc"');
  await slide('honeymoon', docWith(hm('5', '20')), 'ArrowLeft', { ...KEEP, honeymoon: 4, reserve: 21 }, 'B. Tuần trăng mật "5", Dự phòng "20"');
  await slide('honeymoon', docWith(hm('abc', 50)), 'ArrowRight', { ...KEEP, honeymoon: 1, reserve: 49 }, 'C. Tuần trăng mật "abc", Dự phòng 50');
  const dD = docWith([{ id: 'reserve', name: 'Dự phòng', pct: 10, items: [] }]);
  await slide('venue', dD, 'ArrowRight', { ...KEEP, venue: 1, reserve: undefined }, 'D. chỉnh trực tiếp hạng mục "abc"');
  /* E */
  const MIXE = [['photography', 'Chụp ảnh', '1e3'], ['venue', 'Tiệc & nhà hàng', '0x10'], ['jewelry', 'Nhẫn cưới & trang sức', '   '], ['attire', 'Trang phục', ' 7 ']];
  const docE = E.budgetDoc(MIXE, { total_tr: 2000, mung_tr: 0 }); const names = MIXE.map((c) => c[1]);
  const chat = {}, scr = {}; let header = '';
  let pg = await S.page('__t187c.html', '', { budget: docE });
  try { await waitCard(pg); await pg.waitForTimeout(800); const r = await rows(pg, names); for (const n of names) chat[n] = r[n] ? r[n].btn : null; } catch (e) { S.bad('E thẻ chat: ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget', { budget: docE });
  try { await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200); for (const n of names) { const r = await listRow(pg, n); scr[n] = r ? r.amt : null; } header = E.dash(await S.bodyText(pg)); } catch (e) { S.bad('E màn: ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  for (const [, n, x] of MIXE) { const w = E.tr(val(x)); if (scr[n] !== w || chat[n] !== w) S.bad(`E hàng "${n}" (${JSON.stringify(x)}): mong ${w}, màn "${scr[n]}", thẻ chat "${chat[n]}"`); }
  const sum = MIXE.reduce((s, c) => s + val(c[2]), 0);
  if (!header.toLowerCase().includes(`đã phân bổ ${E.tr(sum)} / `)) S.bad(`E "Đã phân bổ" mong ${E.tr(sum)}, thấy "${header.slice(0, 160)}"`);
  /* F */
  const V = { id: 'ph_x', name: 'Studio X', category: 'photography', priceMin: 10, price: 10 };
  const docF = E.budgetDoc([['photography', 'Chụp ảnh', ' 7 '], ['attire', 'Trang phục', '20,5']], { total_tr: 100, mung_tr: 0 });
  pg = await S.page('__t187b.html', '?v=budget&cat=photography', { budget: docF, seed: JSON.stringify({ photography: { shortlisted: [E.mkSaved(V, 10)], confirmed: null } }) });
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(1200);
    const b = E.dash(await S.bodyText(pg));
    S.has('F trang " 7 "', b, ['DỰ TOÁN 7tr', 'Vượt 3tr so với dự toán']);
    if (Number(await sl.getAttribute('aria-valuenow')) !== 7) S.bad(`F trang " 7 ": aria-valuenow "${await sl.getAttribute('aria-valuenow')}" (mong 7)`);
    const w = b.match(BAD_WORD); if (w) S.bad(`F trang " 7 ": lộ "${w[0]}"`);
  } catch (e) { S.bad('F trang " 7 ": ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget&cat=attire', { budget: docF });
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(1000);
    const b = E.dash(await S.bodyText(pg)); const txt = (await sl.getAttribute('aria-valuetext')) || '';
    S.has('F trang "20,5"', b, ['DỰ TOÁN 0tr']);
    if (Number(await sl.getAttribute('aria-valuenow')) !== 0) S.bad('F trang "20,5": aria-valuenow khác 0');
    if (BARE_TR.test(b) || BAD_WORD.test(b) || BARE_TR.test(txt) || BAD_WORD.test(txt)) S.bad(`F trang "20,5": "tr" trơ/chữ lỗi: "${b.slice(0, 200)}" / aria "${txt}"`);
  } catch (e) { S.bad('F trang "20,5": ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
