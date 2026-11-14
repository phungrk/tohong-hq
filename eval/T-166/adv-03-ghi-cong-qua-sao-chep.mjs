// T-166 adv-03 (adversary, tầng 3): photoCredits không liệt kê (non-enumerable) => mất khi JSON/spread/structuredClone.
// Kỳ vọng (spec T-156 quy tắc 5, 6): sau MỌI đường sao chép, photoEntriesOf không bao giờ trả URL Google (host googleusercontent, kể cả hoa/tên miền con)
// mà không có tên tác giả, và không bao giờ trả tên tác giả của ảnh khác (lệch chỉ số). Host giả mạo "googleusercontent.com.evil" không phải Google.
// Chạy: node adv-03-ghi-cong-qua-sao-chep.mjs --repo <tohong-front>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const a = process.argv; const repo = a.includes('--repo') ? path.resolve(a[a.indexOf('--repo') + 1]) : null;
if (!repo) { console.log('FAIL thiếu --repo'); process.exit(2); }
const M = await import(pathToFileURL(path.join(repo, 'src', 'vendorImageUrls.js')).href);
if (typeof M.photoEntriesOf !== 'function' || typeof M.usablePhotos !== 'function') { console.log('FAIL thiếu photoEntriesOf/usablePhotos'); process.exit(1); }
const fails = []; const bad = (m) => fails.push(m);
const photos = [
  { url: 'https://lh3.googleusercontent.com/p/a=s800', source: 'google', attribution: 'Tac Gia A' },
  { url: 'https://www.marry.vn/x/m1.jpg', source: 'marry', attribution: 'SAI_MARRY' },
  { url: 'https://LH5.GoogleUserContent.COM/p/b', source: 'google', attribution: 'Tac Gia B' },
  { url: 'https://lh3.googleusercontent.com/p/c', source: 'google', attribution: '   ' },
  { url: 'https://googleusercontent.com.evil.example/p/d', source: 'marry' },
];
const usable = M.usablePhotos(photos);
const credits = new Map(photos.filter((p) => M.isGooglePhoto(p) && M.authorOf(p)).map((p) => [p.url, M.authorOf(p)]));
const v = { id: 'x', gallery: usable.map((p) => M.cssBg(p.url)), grad: M.cssBg(usable[0].url) };
Object.defineProperty(v, 'photoCredits', { value: usable.map((p) => p.credit), enumerable: false });
const isG = (u) => M.isGoogleHostUrl(u);
const copies = { goc: v, json: JSON.parse(JSON.stringify(v)), spread: { ...v }, structuredClone: structuredClone(v), assign: Object.assign({}, v), note: { ...v, note: 'x' } };
for (const [k, c] of Object.entries(copies)) {
  const es = M.photoEntriesOf(c);
  for (const e of es) {
    if (isG(e.url) && !e.credit) bad(`${k}: URL Google ${e.url} trả về không có tên tác giả`);
    if (e.credit && credits.get(e.url) !== e.credit) bad(`${k}: ${e.url} mang tên "${e.credit}" không phải của chính ảnh`);
    if (e.credit === 'SAI_MARRY') bad(`${k}: ảnh marry mang ghi công`);
  }
  if (!es.some((e) => e.url.includes('marry.vn'))) bad(`${k}: ảnh marry bị mất`);
  if (!es.some((e) => e.url.includes('evil.example'))) bad(`${k}: host giả mạo bị coi là Google (bị ẩn)`);
  if (k === 'goc' && es.filter((e) => e.credit).length !== 2) bad(`goc: phải giữ 2 ảnh Google có tên, có ${es.filter((e) => e.credit).length}`);
}
if (usable.some((p) => p.url.endsWith('/p/c'))) bad('usablePhotos giữ ảnh Google tên chỉ có khoảng trắng');
if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T156_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
console.log('PASS');
