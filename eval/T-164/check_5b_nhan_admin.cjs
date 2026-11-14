#!/usr/bin/env node
/* T-164 tiêu chí 5, phần B (tohong-front, trang admin; dùng khung eval/T-152/lib/front152.cjs: vite build ra thư mục tạm, API giả, không Google):
 *  - Danh sách vendor ("Danh sách vendor"): cột Nhãn hiện price_label NGUYÊN VĂN của API cho từng hàng (thay chữ "Giá ước tính"/"Giá đã xác minh" cố định); ô chọn "Nhãn" có hai mục mới
 *    "Ước tính theo hạng mục" (gửi label=estimate_category) và "Giá marry.vn" (gửi label=legacy_marry); mục cũ vẫn gửi label=estimated / label=verified.
 *  - Drawer chi tiết (bảng enrich): trong "Kết quả trong pool" có dòng "Nhãn giá: <price_label>" lấy từ effective.price_label của GET /api/admin/vendors/<id> khi tải được,
 *    ngược lại từ pool.vendor.price_label của API chi tiết (lớp sửa lỗi vẫn có nhãn). Nhãn hiệu lực (sau overlay) thắng nhãn pool. */
const { setup } = require('../T-152/lib/front152.cjs');
const E = setup(process.argv.slice(2), 't164-5b');
const { check, H } = E;
const L_LEG = 'Giá marry.vn · 06/2026', L_EST = 'Ước tính theo hạng mục', L_VER = 'Giá đã xác minh';
const PRICE = (label, basis) => ({ priceMin: 3.9, priceMax: 4.7, price_basis: basis, price_as_of: '2026-06', price_label: label });
const detailWith = (id, name, label, basis) => { const r = E.ROWS.find((x) => x.id === id);
  return { data_as_of: '2026-11-11T13:08:22', id, name: r.name, catalog: [{ file: 'vendors.json', key: 'name', label: 'Tên vendor', stages: ['gen'], pool: ['name'] }], extra_inputs: [{ id: 'pool_base', label: 'Pool nền', note: 'ghi chú' }],
    source: { available: true, record: { name: r.name }, audit: null, truncated: {} }, pool: { in_pool: true, visible: true, vendor: { ...E.POOL_V(id, r.name), ...PRICE(label, basis) }, reasons: [], field_notes: [] }, overlay: null }; };
E.run(async () => {
  /* A. danh sách vendor */
  let S = await E.scenario();
  const calls = [];
  const ROWS = [
    { id: 'vl1', name: 'Hàng Legacy', category: 'venue', catLabel: 'Tiệc & nhà hàng', city: 'HCMC', ...PRICE(L_LEG, 'legacy_marry'), price_source: 'estimated', base_price: { min: 3.9, max: 4.7 }, has_contact: false, hidden: false, overridden: false, orphan: false, version: 0 },
    { id: 'vl2', name: 'Hàng Estimate', category: 'venue', catLabel: 'Tiệc & nhà hàng', city: 'HCMC', ...PRICE(L_EST, 'estimate_category'), price_source: 'estimated', base_price: { min: 3.9, max: 4.7 }, has_contact: false, hidden: false, overridden: false, orphan: false, version: 0 },
    { id: 'vl3', name: 'Hàng Verified', category: 'photography', catLabel: 'Chụp ảnh', city: 'HCMC', ...PRICE(L_VER, 'admin_verified'), price_source: 'verified', base_price: { min: 3.9, max: 4.7 }, has_contact: true, hidden: false, overridden: true, orphan: false, version: 1 },
  ];
  await S.page.route('http://api.test/api/admin/vendors?*', async (route) => {
    const u = new URL(route.request().url()); calls.push(u.searchParams.get('label') || '');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ vendors: ROWS, total: ROWS.length, offset: 0, limit: 50 }) });
  });
  await S.page.getByRole('button', { name: 'Danh sách vendor' }).click();
  await S.page.getByRole('table').last().waitFor();
  const tbl = H.norm(await S.page.getByRole('table').last().innerText());
  for (const [n, l] of [['Hàng Legacy', L_LEG], ['Hàng Estimate', L_EST], ['Hàng Verified', L_VER]]) {
    const row = S.page.getByRole('row').filter({ hasText: n }).first(); const t = H.norm(await row.innerText());
    check(`danh sách: hàng "${n}" hiện nhãn "${l}"`, t.includes(l), t);
    check(`danh sách: hàng "${n}" không còn nhãn cố định kiểu cũ "Giá ước tính"`, !/Giá ước tính/.test(t), t);
  }
  const sel = S.page.getByRole('combobox', { name: 'Nhãn' });
  const opts = await sel.locator('option').allInnerTexts();
  check('ô chọn "Nhãn" có mục "Ước tính theo hạng mục" và "Giá marry.vn"', opts.includes(L_EST) && opts.some((o) => o.startsWith('Giá marry.vn')), opts.join('|'));
  await sel.selectOption({ label: L_EST }).catch(() => {}); await S.page.waitForTimeout(300);
  check('chọn "Ước tính theo hạng mục" gửi label=estimate_category', calls.includes('estimate_category'), calls.join(','));
  const lg = opts.find((o) => o.startsWith('Giá marry.vn')); if (lg) { await sel.selectOption({ label: lg }).catch(() => {}); await S.page.waitForTimeout(300); }
  check('chọn "Giá marry.vn" gửi label=legacy_marry', calls.includes('legacy_marry'), calls.join(','));
  await S.ctx.close();

  /* B. drawer: nhãn từ effective; overlay đè nhãn pool */
  S = await E.scenario();
  await S.page.route('http://api.test/api/admin/vendor-enrich/*/detail', (route) => { const id = new URL(route.request().url()).pathname.split('/')[4]; return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(detailWith(id, '', L_LEG, 'legacy_marry')) }); });
  S.info = (id) => { const b = E.vendorInfo(id); return { ...b, effective: { ...b.vendor, ...PRICE(L_VER, 'admin_verified') } }; };
  await S.openRow('Alpha Hall', 'Số 1 đường thử');
  let t = await H.text(S.dlg());
  check('drawer: có dòng "Nhãn giá: Giá đã xác minh" (nhãn hiệu lực sau overlay)', t.includes(`Nhãn giá: ${L_VER}`), t.slice(0, 400));
  check('drawer: không hiện nhãn pool khi nhãn hiệu lực khác ("Giá marry.vn · 06/2026")', !t.includes(L_LEG), t.slice(0, 400));
  await S.ctx.close();
  /* C. lớp sửa lỗi: vẫn có nhãn từ pool */
  S = await E.scenario(); S.infoStatus = 500;
  await S.page.route('http://api.test/api/admin/vendor-enrich/*/detail', (route) => { const id = new URL(route.request().url()).pathname.split('/')[4]; return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(detailWith(id, '', L_EST, 'estimate_category')) }); });
  await S.openRow('Alpha Hall', 'Số 1 đường thử');
  t = await H.text(S.dlg());
  check('drawer khi lớp sửa lỗi: vẫn có "Nhãn giá: Ước tính theo hạng mục" từ pool', t.includes(`Nhãn giá: ${L_EST}`) && t.includes('Không tải được lớp sửa'), t.slice(0, 400));
  await S.ctx.close();
});
