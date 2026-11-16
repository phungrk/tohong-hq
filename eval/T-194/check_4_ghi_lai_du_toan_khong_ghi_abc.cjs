#!/usr/bin/env node
/* T-194 tiêu chí 4 (v2, H5 thu hẹp): dữ liệu ĐÃ LƯU không bị ép. Chỉ hạng mục người dùng vừa chỉnh gửi số mới (số JSON); mọi hạng mục khác ghi ĐÚNG như đã lưu
 * ("" -> "", "abc" -> "abc", "20" -> "20", 30 -> 30, bỏ khuyết -> vẫn bỏ khuyết), ở MỌI lối ghi. Dự toán giả = MIX của _b.cjs (photography "", venue "abc", jewelry 30, attire "20", reserve bỏ khuyết).
 *  a. chỉ xem (chưa chốt nhà hàng): 0 lần ghi (INV-003).
 *  b. chỉnh tay Nhẫn cưới & trang sức 30 -> 31: bản gửi có jewelry = 31 (kiểu số); các hạng mục khác nguyên như đã lưu.
 *  c. nhà hàng ĐÃ CHỐT + số khách đổi (khoản vendor_<id> có amt cũ) -> mở màn thì tự ghi (INV-003 cho phép đổi amt khoản vendor): phải có ít nhất 1 lần ghi (nếu không là kịch bản chưa kích hoạt),
 *     và trong bản gửi: venue.allocated_tr vẫn "abc", photography "", attire "20", jewelry 30 (kiểu số), reserve bỏ khuyết; chỉ amt khoản vendor đổi.
 *  d. ghi lại sau lỗi (INV-005): chỉnh jewelry 30 -> 31 lúc ghi lỗi (hiện "Chưa lưu được dự toán"); trong lúc đó một lần ghi khác (thẻ chat) đổi photography "" -> 50 trên server;
 *     bấm "Thử lại": bản ghi cuối giữ photography = 50 (không bị đè thành 0 hay ""), jewelry 31, venue "abc", attire "20".
 * Ngoài phạm vi, không đo: Infinity, items[].amt. Chỉ đo thân PUT và chữ nhìn thấy.
 * Trên main 6b9ad94: XANH (main ghi đúng như đã lưu); đây là chỉ số bảo vệ, ĐỎ với bản vá ép allocated_tr thành số ở lối ghi (đã thử: ca b, c, d đều đỏ). Đo ghi, không đo hiển thị.
 * Chạy: node eval/T-194/check_4_ghi_lai_du_toan_khong_ghi_abc.cjs [--repo <tohong-front>] */
const { E, waitText, MIX } = require('./_b.cjs'); const S = E.setup();
const same = (v, w) => (w === undefined ? v === undefined : (typeof v === typeof w && v === w));
const show = (v) => (v === undefined ? 'bỏ khuyết' : JSON.stringify(v));
/* so bản gửi với kỳ vọng {id: giá trị}; trả về lỗi đầu tiên hoặc null */
const checkCats = (put, want, tag) => {
  const cats = (put && put.categories) || [];
  for (const [id, w] of Object.entries(want)) {
    const c = cats.find((x) => x.id === id);
    if (!c) { S.bad(`${tag}: thiếu hạng mục "${id}" trong bản gửi lên`); continue; }
    if (!same(c.allocated_tr, w)) S.bad(`${tag}: hạng mục "${id}" gửi allocated_tr = ${show(c.allocated_tr)} (mong ${show(w)} đúng như đã lưu / số mới)`);
  }
};
const VEN = { id: 'inv_a', name: 'Alpha Hall', category: 'venue', priceMin: 3.9, priceMax: 3.9, price: 3.9, priceTotal: 6, priceSource: 'estimated', spec: '10 người/bàn' };
const baseDoc = () => {
  const doc = E.budgetDoc(MIX, { total_tr: 100, mung_tr: 0 });
  doc.categories = doc.categories.filter((c) => c.id !== 'reserve'); doc.categories.push({ id: 'reserve', name: 'Dự phòng', pct: 10, items: [] }); // bỏ khuyết allocated_tr
  return doc;
};
const watch = (pg, puts) => pg.on('request', (r) => { if (r.method() === 'PUT' && /\/budget$/.test(r.url())) { try { puts.push(JSON.parse(r.postData() || '{}')); } catch (e) { puts.push(null); } } });
const lastOf = (a) => a[a.length - 1];
S.run(async () => {
  const STORED = { photography: '', venue: 'abc', attire: '20', reserve: undefined };
  /* a. chỉ xem: không PUT */
  let puts = [], pg = await S.page('__t187b.html', '?v=budget', { budget: baseDoc() }); watch(pg, puts);
  try { await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(2500); if (puts.length) S.bad(`a. chỉ xem: mong 0 lần ghi, thấy ${puts.length}`); } catch (e) { S.bad('a. chỉ xem: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* b. chỉnh tay jewelry 30 -> 31 */
  puts = []; pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: baseDoc() }); watch(pg, puts);
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(2500);
    if (!puts.length) S.bad('b. chỉnh tay: không thấy lần ghi nào sau khi kéo thanh trượt');
    else checkCats(lastOf(puts), { ...STORED, jewelry: 31 }, 'b. chỉnh tay');
  } catch (e) { S.bad('b. chỉnh tay: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* c. nhà hàng đã chốt + số khách đổi: lần ghi tự động khi mở màn */
  puts = [];
  const docC = baseDoc(); docC.guests = 100;
  const venue = docC.categories.find((x) => x.id === 'venue'); venue.items = [{ id: 'vendor_inv_a', name: 'Alpha Hall', amt: 1, status: 'confirmed', vendor: true }];
  pg = await S.page('__t187b.html', '?v=budget&cat=venue', { budget: docC, seed: JSON.stringify({ venue: { shortlisted: [VEN], confirmed: VEN } }) }); watch(pg, puts);
  try {
    await waitText(pg, 'Dự toán'); await pg.waitForTimeout(3500);
    if (!puts.length) S.bad('c. nhà hàng đã chốt + số khách đổi: không thấy lần ghi tự động nào (kịch bản chưa kích hoạt, phải có ít nhất 1 lần ghi)');
    else {
      const last = lastOf(puts); checkCats(last, { ...STORED, jewelry: 30 }, 'c. ghi tự động');
      const v = ((last.categories || []).find((x) => x.id === 'venue') || {}).items || [];
      if (!v.length || v[0].id !== 'vendor_inv_a') S.bad('c. ghi tự động: khoản vendor_inv_a không còn trong bản gửi');
    }
  } catch (e) { S.bad('c. ghi tự động: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* d. ghi lại sau lỗi */
  puts = [];
  const D = baseDoc(); let failPut = true;
  pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: D });
  await pg.route('http://localhost:8787/api/couples/t187/budget', async (r) => {
    const m = r.request().method(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (m === 'GET') return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify(D) });
    if (m === 'PUT') {
      const b = JSON.parse(r.request().postData() || '{}'); puts.push({ ok: !failPut, b });
      if (failPut) return r.fulfill({ status: 500, headers: h, contentType: 'application/json', body: '{"error":"boom"}' });
      Object.assign(D, JSON.parse(JSON.stringify({ total_tr: b.total_tr, guests: b.guests, mung_tr: b.mung_tr, categories: b.categories }))); return r.fulfill({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify(D) });
    }
    return r.fallback();
  });
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press('ArrowRight'); await waitText(pg, 'Chưa lưu được dự toán');
    D.categories.find((x) => x.id === 'photography').allocated_tr = 50; /* lần ghi khác (thẻ chat) đã lưu trên server */
    failPut = false; const n0 = puts.length;
    await pg.getByRole('button', { name: 'Thử lại' }).first().click(); await pg.waitForTimeout(2500);
    const ok = puts.slice(n0).filter((p) => p.ok);
    if (!ok.length) S.bad('d. ghi lại sau lỗi: bấm "Thử lại" không dẫn tới lần ghi thành công nào');
    else checkCats(lastOf(ok).b, { photography: 50, venue: 'abc', attire: '20', jewelry: 31 }, 'd. ghi lại sau lỗi');
  } catch (e) { S.bad('d. ghi lại sau lỗi: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
