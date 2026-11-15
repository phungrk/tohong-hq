// T-174 adversary 11 (tohong-front, spec T-171 v3.1 H5 "KHÔNG BAO GIỜ xoá hay thay khoản do lần ghi khác đã lưu và người dùng không đụng tới"): mức hàm, chạy đúng chuỗi
// mà useBudget làm (tải lại lúc lỗi: hiện = mergeBudget(server, nền, đang hiện); nền = extendBase(nền, server); Thử lại: ghi mergeBudget(serverMới, nền, đang hiện)).
// Ca: lưu lỗi 40; trong lúc còn câu báo, server (lần ghi khác) đổi CÙNG một khoản vendor_a nhiều lần: thêm (78) -> màn tải lại; đổi 117 -> màn tải lại; đổi 150 (có hoặc không tải lại); Thử lại.
// Người dùng không đụng vendor_a. Mong đợi: bản ghi cuối có vendor_a = 150 (giá trị server mới nhất), allocated venue 40.
// Ca phụ: (b) khoản mới rồi server xoá, không tải lại, Thử lại -> không hồi sinh; (c) người dùng sửa tên khoản vừa xuất hiện -> giữ tên người dùng.
// Chạy từ gốc tohong-hq: node eval/T-174/adv-11-nen-ghep-khoan-server-doi-nhieu-lan.mjs [--repo <tohong-front>]
import path from 'path'; import fs from 'fs'; import { pathToFileURL, fileURLToPath } from 'url';
const A = process.argv.slice(2); const i = A.indexOf('--repo');
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(i >= 0 ? A[i + 1] : process.env.TOHONG_FRONT_REPO || path.join(here, '..', '..', '..', 'tohong-front'));
const f = path.join(REPO, 'src/budget/mergeBudget.js');
if (!fs.existsSync(f)) { console.log('FAIL thiếu src/budget/mergeBudget.js trong ' + REPO); process.exit(1); }
const { mergeBudget, extendBase } = await import(pathToFileURL(f).href);
if (typeof extendBase !== 'function') { console.log('FAIL thiếu extendBase'); process.exit(1); }
const fails = []; const bad = (m) => fails.push(m);
const doc = (alloc, items) => ({ total_tr: 200, guests: 200, mung_tr: 0, categories: [{ id: 'venue', name: 'Nhà hàng', allocated_tr: alloc, items }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110, items: [] }] });
const it = (amt, name = 'Alpha Hall') => ({ id: 'vendor_a', name, amt, status: 'confirmed', vendor: true });
const venue = (d) => d.categories.find((c) => c.id === 'venue');
const reload = (st, server) => { st.shown = mergeBudget(server, st.base, st.shown); st.base = extendBase(st.base, server); };
const fresh = () => ({ base: doc(90, []), shown: doc(40, []) }); // lưu 90 -> 40 lỗi
for (const reloadLast of [true, false]) {
  const st = fresh();
  reload(st, doc(90, [it(78)])); reload(st, doc(90, [it(117)]));
  const S3 = doc(90, [it(150)]); if (reloadLast) reload(st, S3);
  const out = mergeBudget(S3, st.base, st.shown); const a = venue(out).items.find((x) => x.id === 'vendor_a');
  if (venue(out).allocated_tr !== 40) bad(`(a${reloadLast ? ' tải lại' : ''}) allocated phải 40, thấy ${venue(out).allocated_tr}`);
  if (!a || a.amt !== 150) bad(`(a${reloadLast ? ', có tải lại lần 3' : ', không tải lại lần 3'}) khoản vendor_a người dùng không đụng phải theo server mới nhất 150, bản ghi có ${a && a.amt} (đè giá trị server bằng giá trị server cũ hơn)`);
}
{ const st = fresh(); reload(st, doc(90, [it(78)])); const out = mergeBudget(doc(90, []), st.base, st.shown);
  if (venue(out).items.some((x) => x.id === 'vendor_a')) bad('(b) khoản server đã xoá (người dùng không đụng) bị hồi sinh khi Thử lại'); }
{ const st = fresh(); reload(st, doc(90, [it(78)])); venue(st.shown).items = venue(st.shown).items.map((x) => (x.id === 'vendor_a' ? { ...x, name: 'Alpha (đã đặt cọc)' } : x));
  const out = mergeBudget(doc(90, [it(78)]), st.base, st.shown); const a = venue(out).items.find((x) => x.id === 'vendor_a');
  if (!a || a.name !== 'Alpha (đã đặt cọc)') bad(`(c) người dùng sửa tên khoản vừa xuất hiện phải giữ, thấy ${a && a.name}`); }
{ const st = fresh(); reload(st, doc(90, [it(78)])); venue(st.shown).items = []; // người dùng xoá (adv-06 ở mức hàm)
  reload(st, doc(90, [it(78)])); const out = mergeBudget(doc(90, [it(78)]), st.base, st.shown);
  if (venue(out).items.some((x) => x.id === 'vendor_a')) bad('(d) người dùng xoá khoản rồi màn tải lại lần nữa: khoản hồi sinh'); }
if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T171_ALL) console.log(fails.map((x) => '  - ' + x).join('\n')); process.exit(1); }
console.log('PASS');
