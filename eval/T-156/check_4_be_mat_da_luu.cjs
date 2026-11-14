#!/usr/bin/env node
/* T-156 tiêu chí 4 (tohong-front, app cặp đôi, hai bề mặt vendor ĐÃ LƯU): hàng vendor ở danh sách Vendors và tờ chi tiết ở màn Ngân sách.
 * Ghi công lấy từ pool HIỆN HÀNH (tra theo id, như ảnh), không từ bản đã lưu trong máy (bản lưu chỉ có URL ảnh, không có tác giả). Dữ liệu đã lưu không bị sửa.
 *  - tra pool được: ảnh đầu tiên tải được hiện kèm tác giả của CHÍNH ảnh đó (P2: ảnh đầu hỏng => tác giả ảnh thứ hai);
 *  - tra pool lỗi (HTTP 500): chỉ còn URL trong bản lưu => ảnh Google không biết tác giả KHÔNG được hiện (hiện ảnh mặc định); ảnh không phải Google vẫn hiện.
 * Chạy: node check_4_be_mat_da_luu.cjs --repo <tohong-front> */
const L = require('./lib/f156.cjs'), F = require('./lib/flows156.cjs');
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const S = L.buildSets(L.loadPool());
  A = await L.startApp(REPO, chromium);
  const blocked = [L.stem(S.P2.photos[0].url)];
  await F.savedFlow(A, { vendors: [S.P1, S.P2, S.P3, S.P4, S.P5], blocked, lookup: 'ok', budgetOf: [S.P1, S.P2, S.P5], forbid: [] }, R.bad);
  await F.savedFlow(A, { vendors: [S.P1, S.P4], blocked: [], lookup: '500', budgetOf: [S.P1], forbid: [] }, (m) => R.bad('[tra pool lỗi] ' + m));
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
