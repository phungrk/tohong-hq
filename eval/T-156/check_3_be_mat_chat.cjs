#!/usr/bin/env node
/* T-156 tiêu chí 3 (tohong-front, app cặp đôi, bốn bề mặt trong chat): danh sách vendor, gallery chi tiết (TỪNG ảnh), chọn vendor để so sánh, bảng so sánh.
 * Dữ liệu: vendor thật của pool tohong-back (ảnh Google thật, tác giả thật; ảnh trả bằng PNG giả). Đo chữ nhìn thấy + hình học (xem lib/f156.cjs), không đọc tên class/hàm.
 * Ca: P1 hai ảnh Google hai tác giả; P2 ảnh đầu hỏng => ảnh thứ hai hiện và tác giả của NÓ; P3 tên tác giả dài nhất pool (có "&"), không bị cắt; P4 ảnh marry rồi ảnh Google (marry không ghi công, ảnh Google ghi công);
 * P5 ảnh gắn nguồn sai nhưng host Google, tác giả có ký tự HTML (hiện đúng chữ thuần).
 * Chạy: node check_3_be_mat_chat.cjs --repo <tohong-front> */
const path = require('path');
const L = require('./lib/f156.cjs'), F = require('./lib/flows156.cjs');
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const S = L.buildSets(L.loadPool());
  A = await L.startApp(REPO, chromium);
  const blocked = [L.stem(S.P2.photos[0].url)];
  await F.chatFlow(A, { vendors: [S.P1, S.P2, S.P3, S.P4, S.P5], blocked, detail: [S.P1, S.P2, S.P4], anchor: S.P1, picks: [S.P3, S.P5], forbid: [] }, R.bad);
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
