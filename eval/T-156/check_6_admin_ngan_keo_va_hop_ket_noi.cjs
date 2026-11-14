#!/usr/bin/env node
/* T-156 tiêu chí 6 (tohong-front, trang admin; khung eval/T-152/lib/front152.cjs: vite build ra thư mục tạm, API giả, không Google thật):
 *  A. Ngăn kéo chi tiết vendor (bảng enrich): MỖI ảnh Google đang hiện (ở cột pool, và ở cột hiệu lực khi admin đã sửa ảnh) có tên tác giả nhìn thấy được cạnh CHÍNH ảnh đó;
 *     ảnh Google thiếu tác giả (không có trường / chỉ khoảng trắng) KHÔNG hiện ảnh, thay bằng dòng chữ "Thiếu ghi công tác giả"; ảnh marry không hiện ghi công kể cả khi bản ghi có trường attribution (chuỗi thử cố định).
 *  B. Hộp kết nối vendor (chi tiết yêu cầu): API admin hiện chỉ trả URL ảnh (vendor.photo), không có tên tác giả => ảnh Google-host KHÔNG được hiện; ảnh marry vẫn hiện.
 * Chạy: node check_6_admin_ngan_keo_va_hop_ket_noi.cjs --repo <tohong-front> [--dist <thư mục build sẵn>] */
const { setup } = require('../T-152/lib/front152.cjs');
const L = require('./lib/f156.cjs');
const E = setup(process.argv.slice(2), 't156-6');
const { check } = E;
const SENT = L.SENT;
const G1 = 'https://lh3.googleusercontent.com/t156/admin-mot=s800-w800', G2 = 'https://lh3.googleusercontent.com/t156/admin-hai=s800-w800', G3 = 'https://lh3.googleusercontent.com/t156/admin-ba=s800-w800';
const M1 = 'https://www.marry.vn/images/detailed/9/admin-marry-1.jpg', M2 = 'https://www.marry.vn/images/detailed/9/admin-marry-2.jpg';
const A1 = 'Tác Giả Một & Co ZZ156';
const ALL = [{ url: G1, source: 'google', attribution: A1 }, { url: G2, source: 'google' }, { url: M1, source: 'marry', attribution: SENT }, { url: G3, source: 'google', attribution: '   ' }, { url: M2, source: 'marry' }];
const stemOf = (u) => u.replace(/=[A-Za-z0-9-]+$/, '');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
E.run(async () => {
  /* ===== A. ngăn kéo: ảnh hiện từ lớp hiệu lực (GET /api/admin/vendors/<id>) khi tải được, nếu không thì từ API chi tiết enrich ===== */
  const withPhotos = (v, photos) => ({ ...v, photos });
  const dlg = '[role=dialog][aria-label^="Chi tiết vendor"]';
  for (const mode of ['lớp hiệu lực tải được', 'lớp hiệu lực lỗi (rơi về pool)']) {
    const S = await E.scenario();
    if (mode.startsWith('lớp hiệu lực tải')) S.info = (id) => { const b = E.vendorInfo(id); return { ...b, vendor: withPhotos(b.vendor, ALL), effective: withPhotos(b.vendor, ALL), override: { photos: ALL, version: 3, updated_by: 'user_sua_1', updated_at: '2026-11-14T10:00:00.000Z' }, version: 3, edited_fields: ['photos'] }; };
    else S.infoStatus = 500;
    await S.page.route(/\/api\/admin\/vendor-enrich\/vd1\/detail$/, async (r) => {
      const rows = E.ROWS.find((x) => x.id === 'vd1');
      r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data_as_of: '2026-11-11T13:08:22', id: 'vd1', name: rows.name, catalog: [{ file: 'vendors.json', key: 'name', label: 'Tên vendor', stages: ['gen'], pool: ['name'] }], extra_inputs: [],
        source: { available: true, record: { name: rows.name }, audit: null, truncated: {} }, pool: { in_pool: true, visible: true, vendor: withPhotos(E.POOL_V('vd1', rows.name), ALL), reasons: [], field_notes: [] }, overlay: null }) });
    });
    await S.openRow('Alpha Hall', 'Số 1 đường thử');
    await S.page.waitForTimeout(900);
    const imgs = (stem) => S.page.evaluate(([d, st]) => [...document.querySelector(d).querySelectorAll('img')].filter((i) => (i.getAttribute('src') || '').includes(st)).length, [dlg, stem]);
    const probe = (needle, stem, k) => S.page.evaluate(L.probeFn, { scopeSel: dlg, needle, thumbStem: stem, onlyThumb: k });
    const tag = `[${mode}] `;
    const n1 = await imgs(stemOf(G1));
    check(tag + 'ảnh Google có tác giả hiện (ít nhất một thẻ ảnh)', n1 >= 1, n1);
    for (let k = 0; k < n1; k++) { const r = await probe(A1, stemOf(G1), k); check(tag + `ảnh Google #${k + 1}: tên tác giả "${A1}" nhìn thấy được cạnh chính ảnh đó`, r.found && r.visible && r.near, r.why); }
    check(tag + 'ảnh Google thiếu tác giả (không có trường) KHÔNG hiện ảnh', (await imgs(stemOf(G2))) === 0);
    check(tag + 'ảnh Google có attribution chỉ khoảng trắng KHÔNG hiện ảnh', (await imgs(stemOf(G3))) === 0);
    const t = await S.dlg().innerText();
    check(tag + 'mỗi ảnh Google thiếu tác giả có đúng một dòng "Thiếu ghi công tác giả" (hai ảnh => hai dòng)', (t.match(/Thiếu ghi công tác giả/g) || []).length === 2, (t.match(/Thiếu ghi công tác giả/g) || []).length);
    check(tag + 'ảnh marry mang trường attribution: KHÔNG hiện chuỗi đó', !t.includes(SENT));
    check(tag + 'hai ảnh marry vẫn hiện (thẻ <img>)', (await imgs('admin-marry-1')) >= 1 && (await imgs('admin-marry-2')) >= 1);
    await S.ctx.close();
  }

  /* ===== B. hộp kết nối ===== */
  const S2 = await E.scenario();
  const REQ = (id, photo, att) => ({ id, status: 'new', source: 'chat', note: '', contact: { phone: '0900000000' }, created_at: '2026-11-14T01:00:00Z', waiting_hours: 1, vendor_hidden: false, couple: { id: 'c1', name: 'Cặp ' + id, email: 'x@y.z' },
    vendor: { id: 'vd1', name: 'Vendor ' + id, category: 'photography', catLabel: 'Chụp ảnh', photo, ...(att ? { photo_attribution: att } : {}), exists: true }, history: [] });
  const R = { rq_g: REQ('rq_g', G1), rq_m: REQ('rq_m', M1, SENT) };
  await S2.page.route('http://api.test/api/admin/connect-requests**', async (r) => {
    const u = new URL(r.request().url()); const m = u.pathname.match(/connect-requests\/([^/]+)$/);
    const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (m) return j({ request: R[m[1]] });
    return j({ requests: Object.values(R) });
  });
  await S2.page.getByRole('button', { name: 'Hộp kết nối' }).first().click();
  for (const [id, label] of [['rq_g', 'Cặp rq_g'], ['rq_m', 'Cặp rq_m']]) {
    await S2.page.getByText(label, { exact: false }).first().click(); await S2.page.waitForTimeout(900);
    const imgsNow = await S2.page.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')));
    const txt = await S2.page.evaluate(() => document.body.innerText);
    if (id === 'rq_g') check('hộp kết nối: ảnh Google (API không có tên tác giả) KHÔNG hiện', !imgsNow.some((s) => s && s.includes(stemOf(G1))), imgsNow.join(' '));
    else { check('hộp kết nối: ảnh marry vẫn hiện', imgsNow.some((s) => s && s.includes('admin-marry-1')), imgsNow.join(' ')); check('hộp kết nối: ảnh marry không hiện ghi công, kể cả khi API có trường tên tác giả', !txt.includes(SENT)); }
  }
  await S2.ctx.close();
});
