#!/usr/bin/env node
/* T-156 tiêu chí 5 (tohong-front, MỌI bề mặt app cặp đôi: danh sách, chi tiết, chọn so sánh, bảng so sánh, hàng đã lưu, tờ Ngân sách):
 *  (a) ảnh không phải Google (marry) KHÔNG hiện ghi công, kể cả khi bản ghi có trường attribution (N0 mang chuỗi thử cố định: chuỗi đó không được xuất hiện ở bất kỳ bề mặt nào);
 *  (b) ảnh Google thiếu tên tác giả (không có trường, hoặc chuỗi chỉ có khoảng trắng) KHÔNG được hiện: N1 chỉ có ảnh đó => ảnh mặc định; N2 ảnh đầu thiếu, ảnh sau đủ => chỉ ảnh sau hiện kèm tác giả của nó;
 *      N3 ảnh Google khoảng trắng rồi ảnh marry => ảnh marry hiện, không ghi công;
 *  (c) đối chứng: P1 (đủ tác giả) vẫn hiện tác giả trong cùng lần chạy, để phép đo "không thấy ghi công" không đỗ oan.
 * Chạy: node check_5_khong_phai_google_va_thieu_ghi_cong.cjs --repo <tohong-front> */
const L = require('./lib/f156.cjs'), F = require('./lib/flows156.cjs');
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const S = L.buildSets(L.loadPool());
  A = await L.startApp(REPO, chromium);
  const vendors = [S.P1, S.N0, S.N1, S.N2, S.N3];
  await F.chatFlow(A, { vendors, blocked: [], detail: [S.N2, S.N3, S.N1], anchor: S.P1, picks: [S.N0, S.N2], forbid: [L.SENT] }, R.bad);
  await F.savedFlow(A, { vendors, blocked: [], lookup: 'ok', budgetOf: [S.P1, S.N0, S.N1, S.N2, S.N3], forbid: [L.SENT] }, R.bad);
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
