#!/usr/bin/env node
/* T-189 adv-02 (adversary): bề mặt chat ở các nhánh inv-006 chưa chạm.
 *  (a) chi tiết vendor mà GET /api/vendors/<id> trả 2xx KHÔNG có match ("Chưa có điểm"): anchor so sánh đi qua nhánh noScore (bản sao vendor) -> chọn so sánh + bảng so sánh;
 *  (b) bảng so sánh mà /api/vendors/match?ids trả một vendor KHÔNG có match (nhánh l.none, bản sao vendor) và một vendor có match;
 *  (c) luồng chat đầy đủ với vendor THẬT tên dài nhất pool (ảnh Google có tác giả).
 * Mong đợi (T-156 tiêu chí 3 / inv-006): ảnh Google hiện kèm tên tác giả cạnh ảnh (<= 32px), chi tiết đủ chấm chuyển ảnh, ở 390px.
 * Chạy: node adv-02-chat-khong-diem-ten-dai.cjs --repo <tohong-front> */
const path = require('path');
const HQ = path.resolve(__dirname, '..', '..');
const L = require(path.join(HQ, 'eval/T-156/lib/f156.cjs')), F = require(path.join(HQ, 'eval/T-156/lib/flows156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
const CORS = L.CORS;
(async () => {
  const S = L.buildSets(L.loadPool());
  const pool = L.loadPool();
  const okG = (v) => v.photos && v.photos[0] && L.isG(v.photos[0]) && L.hasAttr(v.photos[0]) && !v.name.toLowerCase().includes(v.photos[0].attribution.trim().toLowerCase());
  const longest = pool.filter(okG).sort((a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1)).slice(0, 2);
  A = await L.startApp(REPO, chromium);
  const vendors = [S.P1, S.P3, S.P5, S.P4];
  const exp = (v) => F.expectOf(v, []);
  const noMatchIds = new Set([S.P3.id]);
  const open = async () => {
    const pg = await A.open('__t156c.html', '', { vendors });
    // route đăng ký sau chạy trước: chi tiết P1 trả 2xx không có match; ?ids= trả P3 không match
    await pg.route(/^http:\/\/localhost:8787\/api\/vendors\/.*/, async (r) => {
      const u = new URL(r.request().url()), m = r.request().method();
      if (m === 'OPTIONS') return r.fallback();
      const j = (o) => r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/api/vendors/' + S.P1.id && m === 'GET') return j({ vendor: S.P1 });
      if (u.pathname === '/api/vendors/match' && u.searchParams.get('ids')) {
        const ids = u.searchParams.get('ids').split(',');
        return j({ vendors: vendors.filter((v) => ids.includes(v.id)).map((v) => (noMatchIds.has(v.id) ? { ...v } : L.withMatch(v))), total: ids.length });
      }
      return r.fallback();
    });
    return pg;
  };
  const pg = await open();
  try {
    await pg.waitForFunction((n) => n.every((x) => document.body.innerText.includes(x)), vendors.map((v) => v.name), { timeout: 20000 }); await pg.waitForTimeout(800);
    await pg.locator('[data-card="0"]').getByText(S.P1.name, { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(1500);
    const t1 = await L.textIn(pg, '[data-card="1"]');
    if (!/Chưa có điểm/i.test(t1)) R.bad('ca (a) không dựng được: chi tiết không vào nhánh "Chưa có điểm" (eval cần sửa)');
    await F.assertSurface(A, pg, '[data-card="1"]', [exp(S.P1)], 'chi tiết không điểm', R.bad, {});
    await pg.getByRole('button', { name: /So sánh/ }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="2"]', { timeout: 5000 });
    await pg.waitForFunction((n) => n.every((x) => document.querySelector('[data-card="2"]').innerText.includes(x)), [S.P3.name, S.P5.name], { timeout: 15000 }); await pg.waitForTimeout(1500);
    await F.assertSurface(A, pg, '[data-card="2"]', vendors.map(exp), 'chọn so sánh, anchor không điểm', R.bad, {});
    for (const v of [S.P3, S.P5]) await pg.locator('[data-card="2"]').getByText(v.name, { exact: false }).first().click({ timeout: 5000 });
    await pg.getByRole('button', { name: /So sánh 3 vendor/ }).click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(2000);
    await F.assertSurface(A, pg, '[data-card="3"]', [S.P1, S.P3, S.P5].map(exp), 'bảng so sánh, vendor không điểm', R.bad, {});
  } catch (e) { R.bad('ca (a)(b): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  // (c) vendor thật tên dài nhất pool qua đủ bốn bề mặt chat
  await F.chatFlow(A, { vendors: [...longest, S.P5], blocked: [], detail: longest, anchor: longest[0], picks: [longest[1]], forbid: [] }, (m) => R.bad('(c) tên dài: ' + m));
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
