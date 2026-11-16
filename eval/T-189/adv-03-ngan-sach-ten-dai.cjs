#!/usr/bin/env node
/* T-189 adv-03 (adversary): tờ chi tiết vendor ở màn Ngân sách (bề mặt 6) với vendor THẬT tên dài nhất pool, ảnh Google có tác giả.
 * Mong đợi (T-156 tiêu chí 4 / inv-006): tên tác giả hiện cạnh ảnh (<= 32px) ở 390px. inv-006 chỉ thử tên ngắn.
 * Chạy: node adv-03-ngan-sach-ten-dai.cjs --repo <tohong-front> */
const path = require('path');
const HQ = path.resolve(__dirname, '..', '..');
const L = require(path.join(HQ, 'eval/T-156/lib/f156.cjs')), F = require(path.join(HQ, 'eval/T-156/lib/flows156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const pool = L.loadPool();
  const okG = (v) => v.photos && v.photos[0] && L.isG(v.photos[0]) && L.hasAttr(v.photos[0]) && !v.name.toLowerCase().includes(v.photos[0].attribution.trim().toLowerCase());
  const longest = pool.filter(okG).sort((a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1)).slice(0, 2);
  A = await L.startApp(REPO, chromium);
  await F.savedFlow(A, { vendors: longest, blocked: [], lookup: 'ok', budgetOf: longest, forbid: [] }, (m) => { if (!/hàng Vendors/.test(m)) R.bad(m); }); // hàng Vendors đo ở adv-01
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
