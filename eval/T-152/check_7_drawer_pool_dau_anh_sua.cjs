#!/usr/bin/env node
/* T-152 tiêu chí 7 và 8 (tohong-front; một file, hai nhóm kiểm, cùng dựng giả API): nội dung drawer.
 * Hợp đồng (spec products/T-152-drawer-phu-pool-dau-anh-admin-sua-pool.md, Hành vi 2, 3, 5):
 *  - Thứ tự mục (h4): "Kết quả trong pool" < "Lớp admin (R2)" < "Thuộc tính nguồn dùng để tạo vendor pool" < "Đầu vào ngoài vendors.json".
 *  - Ảnh (trong phần pool): mỗi ảnh có <img> (alt "Ảnh vendor <số>") và liên kết tên "Mở ảnh gốc" href = đúng URL ảnh, target=_blank, rel có noopener; ảnh Google có chữ "Ảnh: <attribution>"; ảnh hỏng thì chữ "Ảnh không tải được", liên kết còn, drawer vẫn chạy.
 *  - Drawer gọi thêm GET /api/admin/vendors/<id> (đọc: effective, override, version, edited_fields, source_changed, history, editable). Trường nằm trong edited_fields có nhãn "admin sửa"; trường khác không có.
 *  - Nút "Sửa dữ liệu pool" mở biểu mẫu: ô "Tên", "Mô tả", hộp chọn mỗi nhãn gu của editable.styles, ô "Ảnh (mỗi dòng một URL)", "Sức chứa tối thiểu"/"Sức chứa tối đa" (chỉ khi hạng mục venue); "Lưu" gửi PUT .../override chỉ các trường đã đổi + expected_version.
 *  - Lỗi 400 {error:code}: "Không lưu được: <code>"; 409: "Dữ liệu đã đổi, hãy tải lại" và tải lại; "Bỏ sửa <trường>" gửi trường null; "Lịch sử sửa" mỗi dòng "<by> · <at> · <trường>: <trước> → <sau>"; source_changed: "Pool nguồn đã đổi sau lần sửa: <trường> — lúc sửa: <base>, hiện: <now>".
 *  - GET /api/admin/vendors/<id> lỗi: drawer vẫn hiện phần pool từ API chi tiết và chữ "Không tải được lớp sửa". */
const { setup } = require('./lib/front152.cjs');
const E = setup(process.argv.slice(2), 't152-7');
const { check, H, urls } = E;
const idx = (t, s) => t.indexOf(s);
E.run(async () => {
  /* ===== A. thứ tự, ảnh ===== */
  let S = await E.scenario();
  await S.openRow('Alpha Hall', 'Số 1 đường thử');
  let t = await H.text(S.dlg());
  const o = ['Kết quả trong pool', 'Lớp admin (R2)', 'Thuộc tính nguồn dùng để tạo vendor pool', 'Đầu vào ngoài vendors.json'].map((h) => idx(t, h));
  check('thứ tự mục: pool, lớp admin, rồi nguồn, rồi đầu vào ngoài', o.every((x) => x >= 0) && o[0] < o[1] && o[1] < o[2] && o[2] < o[3], o.join(','));
  const links = S.dlg().getByRole('link', { name: 'Mở ảnh gốc' });
  check('3 ảnh có 3 liên kết "Mở ảnh gốc"', (await links.count()) === 3, await links.count());
  const hrefs = await links.evaluateAll((as) => as.map((a) => ({ h: a.getAttribute('href'), t: a.getAttribute('target'), r: a.getAttribute('rel') || '' })));
  check('liên kết ảnh gốc: đúng URL ảnh trong pool, mở tab mới, rel có noopener', hrefs.map((x) => x.h).join('|') === [urls.MARRY_URL, urls.GOOGLE_URL, urls.BROKEN_URL].join('|') && hrefs.every((x) => x.t === '_blank' && /noopener/.test(x.r)), JSON.stringify(hrefs));
  check('mỗi ảnh có thumbnail <img> trỏ đúng URL', (await S.dlg().locator('img').evaluateAll((is) => is.map((i) => i.getAttribute('src')))).join('|') === [urls.MARRY_URL, urls.GOOGLE_URL, urls.BROKEN_URL].join('|'));
  await S.page.waitForTimeout(500);
  t = await H.text(S.dlg());
  check('ảnh Google ghi công "Ảnh: Tác giả Thử", ảnh marry không có dòng ghi công', t.includes('Ảnh: Tác giả Thử') && (t.match(/Ảnh: /g) || []).length === 1, t.slice(0, 300));
  check('ảnh hỏng: "Ảnh không tải được" đúng một lần, liên kết vẫn còn', (t.match(/Ảnh không tải được/g) || []).length === 1 && (await links.count()) === 3);
  check('ảnh hỏng không phá drawer: các mục còn, nút "Đóng" bấm được', t.includes('Đầu vào ngoài vendors.json') && (await S.dlg().getByRole('button', { name: 'Đóng', exact: true }).isEnabled()));
  check('drawer chỉ gọi API ảnh ở các URL của pool, không request nào khác ra ngoài', S.external.length === 0 && S.photoReqs.every((u) => [urls.MARRY_URL, urls.GOOGLE_URL, urls.BROKEN_URL].includes(u)), S.external.concat(S.photoReqs).join(' '));
  check('không có nhãn "admin sửa" khi chưa sửa gì', !t.includes('admin sửa'));
  check('chưa có lịch sử: không có dòng lịch sử, có thể có tiêu đề "Lịch sử sửa" nhưng ghi "Chưa có sửa"', !t.includes('→') || t.includes('Chưa có sửa'));
  await S.ctx.close();

  /* ===== B. đã có sửa: nhãn, lịch sử, nguồn đổi, bỏ sửa ===== */
  S = await E.scenario();
  S.info = (id) => { const b = E.vendorInfo(id); const eff = { ...b.vendor, name: 'Alpha Mới', styles: ['luxury', 'rustic'], tags: ['luxury', 'rustic'] };
    return { ...b, effective: eff, version: 7, override: { name: 'Alpha Mới', styles: ['luxury', 'rustic'], version: 7, updated_by: 'user_sua_1', updated_at: '2026-11-13T10:00:00.000Z' },
      edited_fields: ['name', 'styles'], source_changed: [{ field: 'name', base: 'Alpha Cũ ZZ', now: 'Alpha Hall' }],
      history: [{ seq: 7, at: '2026-11-13T10:00:00.000Z', by: 'user_sua_1', action: 'edit', changes: { name: { before: 'Alpha Hall', after: 'Alpha Mới' }, styles: { before: ['luxury'], after: ['luxury', 'rustic'] } } }] }; };
  await S.openRow('Alpha Hall', 'Số 1 đường thử');
  t = await H.text(S.dlg());
  check('gọi API đọc lớp sửa đúng một lần cho vendor đang mở', S.infos.length === 1 && S.infos[0] === 'vd1', S.infos.join(','));
  check('cột pool hiện giá trị sau sửa: tên "Alpha Mới" có mặt trong phần pool', /name:? Alpha Mới/.test(t), t.slice(0, 400));
  check('nhãn "admin sửa" đúng hai lần (name, styles), không ở trường khác', (t.match(/admin sửa/g) || []).length === 2 && /name:? Alpha Mới[^a-z]*admin sửa/.test(t), t.slice(0, 500));
  check('lịch sử: "user_sua_1", thời điểm, "name: Alpha Hall → Alpha Mới", "styles: luxury → luxury, rustic"', t.includes('Lịch sử sửa') && t.includes('user_sua_1') && t.includes('2026-11-13') && t.includes('name: Alpha Hall → Alpha Mới') && t.includes('styles: luxury → luxury, rustic'), t.slice(-500));
  check('nguồn đổi: "Pool nguồn đã đổi sau lần sửa: name — lúc sửa: Alpha Cũ ZZ, hiện: Alpha Hall"', t.includes('Pool nguồn đã đổi sau lần sửa: name — lúc sửa: Alpha Cũ ZZ, hiện: Alpha Hall'), t.slice(-600));
  await S.dlg().getByRole('button', { name: 'Bỏ sửa name', exact: true }).click();
  await S.page.waitForTimeout(300);
  check('"Bỏ sửa name" gửi PUT {expected_version:7, name:null} và tải lại lớp sửa', S.puts.length === 1 && JSON.stringify(S.puts[0].body) === JSON.stringify({ expected_version: 7, name: null }) && S.infos.length === 2, JSON.stringify(S.puts));
  await S.ctx.close();

  /* ===== C. biểu mẫu sửa ===== */
  S = await E.scenario();
  await S.openRow('Alpha Hall', 'Số 1 đường thử');
  await S.dlg().getByRole('button', { name: 'Sửa dữ liệu pool', exact: true }).click();
  const D = S.dlg();
  check('biểu mẫu có ô Tên, Mô tả, Ảnh, Sức chứa (venue) và 10 hộp chọn gu lấy từ API', (await D.getByRole('textbox', { name: 'Tên', exact: true }).count()) === 1 && (await D.getByRole('textbox', { name: 'Mô tả', exact: true }).count()) === 1 &&
    (await D.getByRole('textbox', { name: 'Ảnh (mỗi dòng một URL)', exact: true }).count()) === 1 && (await D.getByRole('spinbutton', { name: 'Sức chứa tối thiểu', exact: true }).count()) === 1 && (await D.getByRole('checkbox').count()) === 10);
  check('ô Tên điền sẵn giá trị hiện tại', (await D.getByRole('textbox', { name: 'Tên', exact: true }).inputValue()) === 'Alpha Hall');
  await D.getByRole('textbox', { name: 'Tên', exact: true }).fill('Alpha Sửa');
  await D.getByRole('checkbox', { name: 'rustic', exact: true }).check();
  await D.getByRole('button', { name: 'Lưu', exact: true }).click();
  await S.page.waitForTimeout(300);
  const b1 = S.puts[0]?.body || {};
  check('Lưu: PUT chỉ gồm expected_version + các trường đã đổi (name, styles)', S.puts.length === 1 && S.puts[0].method === 'PUT' && S.puts[0].id === 'vd1' && b1.expected_version === 0 && b1.name === 'Alpha Sửa' && JSON.stringify(b1.styles) === JSON.stringify(['luxury', 'rustic']) && Object.keys(b1).sort().join() === 'expected_version,name,styles', JSON.stringify(S.puts));
  check('lưu xong: biểu mẫu đóng và lớp sửa được tải lại', (await D.getByRole('textbox', { name: 'Tên', exact: true }).count()) === 0 && S.infos.length === 2, S.infos.length);
  // ảnh: thêm một dòng marry, giữ nguyên ba ảnh cũ (ảnh Google gửi lại đủ attribution)
  await D.getByRole('button', { name: 'Sửa dữ liệu pool', exact: true }).click();
  const ta = D.getByRole('textbox', { name: 'Ảnh (mỗi dòng một URL)', exact: true });
  const cur = await ta.inputValue();
  check('ô Ảnh điền sẵn đúng 3 URL, mỗi dòng một URL', cur.split('\n').filter(Boolean).join('|') === [urls.MARRY_URL, urls.GOOGLE_URL, urls.BROKEN_URL].join('|'), cur);
  await ta.fill(cur + '\nhttps://www.marry.vn/images/detailed/1/moi.jpg');
  await D.getByRole('button', { name: 'Lưu', exact: true }).click();
  await S.page.waitForTimeout(300);
  const ph = S.puts[1]?.body?.photos || [];
  check('Lưu ảnh: 4 phần tử, ảnh Google gửi lại nguyên attribution, ảnh mới chỉ có url', ph.length === 4 && ph[1].url === urls.GOOGLE_URL && ph[1].attribution === 'Tác giả Thử' && ph[3].url.endsWith('moi.jpg') && Object.keys(S.puts[1].body).sort().join() === 'expected_version,photos', JSON.stringify(S.puts[1]));
  // lỗi 400, 409
  S.onPut = () => ({ status: 400, body: { error: 'invalid_styles' } });
  await D.getByRole('button', { name: 'Sửa dữ liệu pool', exact: true }).click();
  await D.getByRole('textbox', { name: 'Tên', exact: true }).fill('Lỗi Thử');
  await D.getByRole('button', { name: 'Lưu', exact: true }).click();
  await D.getByText('Không lưu được: invalid_styles').waitFor();
  check('400: hiện "Không lưu được: invalid_styles", biểu mẫu còn để sửa tiếp', (await D.getByRole('textbox', { name: 'Tên', exact: true }).inputValue()) === 'Lỗi Thử');
  S.onPut = () => ({ status: 409, body: { error: 'version_conflict' } });
  const n0 = S.infos.length;
  await D.getByRole('button', { name: 'Lưu', exact: true }).click();
  await D.getByText('Dữ liệu đã đổi, hãy tải lại').waitFor();
  check('409: hiện "Dữ liệu đã đổi, hãy tải lại" và tải lại lớp sửa', S.infos.length > n0, S.infos.length - n0);
  await S.ctx.close();
  // hạng mục không phải venue: không có ô sức chứa
  S = await E.scenario();
  await S.openRow('Beta Studio', 'Số 2 đường thử');
  await S.dlg().getByRole('button', { name: 'Sửa dữ liệu pool', exact: true }).click();
  check('vendor không phải venue: không có ô sức chứa', (await S.dlg().getByRole('spinbutton').count()) === 0);
  await S.ctx.close();

  /* ===== D. API lớp sửa lỗi: drawer vẫn chạy ===== */
  S = await E.scenario();
  S.infoStatus = 500;
  await S.openRow('Gamma Garden', 'Số 3 đường thử');
  t = await H.text(S.dlg());
  check('API lớp sửa lỗi: hiện "Không tải được lớp sửa", vẫn có phần pool (từ API chi tiết) và nguồn', t.includes('Không tải được lớp sửa') && t.includes('Kết quả trong pool') && t.includes('Thuộc tính nguồn dùng để tạo vendor pool') && /name:? Gamma Garden/.test(t), t.slice(0, 300));
  check('API lớp sửa lỗi: không có nút "Sửa dữ liệu pool" (không đủ version để lưu)', (await S.dlg().getByRole('button', { name: 'Sửa dữ liệu pool', exact: true }).count()) === 0);
  await S.ctx.close();
});
