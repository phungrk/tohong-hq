#!/usr/bin/env node
/* T-166 adv-01 (adversary, tầng 3): màn Vendors đã lưu, NHIỀU vendor ở HAI hạng mục (6 ở Chụp ảnh, 2 ở Trang điểm), tra pool được.
 * Đo như người dùng: cuộn tới từng hàng (scrollIntoView) rồi mới đo ghi công (nhìn thấy, không cắt, cạnh ảnh <= 32px).
 * Kỳ vọng: mọi hàng có ảnh Google đang hiện đều có ghi công đọc được SAU KHI cuộn tới, không phụ thuộc vị trí cuộn lúc mở màn.
 * In thêm (chẩn đoán, không chấm): số hàng mà cách đo không cuộn của eval T-156 số 4 coi là "bị cắt" ở vị trí mở màn.
 * Chạy: node adv-01-da-luu-cuon-toi-hang.cjs --repo <tohong-front> */
const path = require('path');
const L = require(path.join(__dirname, '..', 'T-156', 'lib', 'f156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const pool = L.loadPool();
  const used = new Set(); const lc = (s) => String(s).toLowerCase();
  const ok = (v) => { const p = v.photos && v.photos[0]; if (!p || !L.isG(p) || !L.hasAttr(p)) return false; const a = p.attribution.trim();
    return !used.has(a) && !lc(v.name).includes(lc(a)) && !lc(a).includes(lc(v.name)) && v.photos.filter(L.isG).every((q) => !used.has((q.attribution || '').trim())); };
  const picked = [];
  for (const v of [...pool].sort((a, b) => (a.id < b.id ? -1 : 1))) { if (picked.length >= 8) break; if (ok(v)) { v.photos.filter(L.isG).forEach((q) => used.add((q.attribution || '').trim())); picked.push(v); } }
  if (picked.length < 8) { console.log('FAIL pool không đủ vendor để dựng ca thử'); process.exit(2); }
  const byId = Object.fromEntries(picked.map((v) => [v.id, v]));
  const doc = { photography: { shortlisted: picked.slice(0, 6).map((v) => L.mkSaved(v)), confirmed: null }, makeup: { shortlisted: picked.slice(6).map((v) => L.mkSaved(v, 'makeup')), confirmed: null } };
  A = await L.startApp(REPO, chromium);
  const pg = await A.open('__t156s.html', '', { vendors: [], byId, saved: doc });
  try {
    await pg.waitForFunction((n) => n.every((x) => document.body.innerText.includes(x)), picked.map((v) => v.name), { timeout: 20000 });
    await pg.waitForTimeout(2500);
    let clippedAtOpen = 0;
    for (const v of picked) {
      const author = v.photos[0].attribution.trim(), st = L.stem(v.photos[0].url);
      const r0 = await A.probe(pg, { scopeSel: '#root', needle: author, thumbStem: st });
      if (r0.found && !r0.visible) clippedAtOpen++;
    }
    console.log(`  chẩn đoán: ${clippedAtOpen}/${picked.length} hàng bị cách đo không cuộn coi là "cắt" ở vị trí mở màn`);
    for (const v of picked) {
      const author = v.photos[0].attribution.trim(), st = L.stem(v.photos[0].url);
      await pg.evaluate((n) => { const all = [...document.querySelectorAll('#root *')].filter((e) => (e.innerText || '').replace(/\s+/g, ' ').includes(n));
        const leaf = all.filter((e) => ![...e.children].some((c) => (c.innerText || '').replace(/\s+/g, ' ').includes(n)))[0]; if (leaf) leaf.scrollIntoView({ block: 'center' }); }, author);
      await pg.waitForTimeout(150);
      const r = await A.probe(pg, { scopeSel: '#root', needle: author, thumbStem: st });
      if (!r.found) R.bad(`${v.name}: không thấy ghi công "${author}"`);
      else if (!r.visible) R.bad(`${v.name}: sau khi cuộn tới, ghi công "${author}" vẫn không nhìn thấy (${r.why})`);
      else if (!r.near) R.bad(`${v.name}: ghi công không cạnh ảnh (${r.why})`);
    }
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth);
    if (ov > 391) R.bad(`tràn ngang: scrollWidth ${ov} > 390`);
  } catch (e) { R.bad('lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
