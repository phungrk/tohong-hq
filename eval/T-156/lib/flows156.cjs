'use strict';
/* T-156: các luồng đo dùng chung cho check_3/4/5. Mỗi luồng trả về qua `bad(msg)`; không tự thoát. */
const L = require('./f156.cjs');
const { stem, isG, hasAttr } = L;

/* Kỳ vọng của một vendor: ảnh đầu tiên TẢI ĐƯỢC mà được phép hiện. Được phép hiện = không phải Google, hoặc là Google có attribution khác rỗng sau trim.
 * author: tên tác giả phải thấy kèm ảnh đó (null nếu ảnh hiện không phải Google). hide: stem của ảnh Google bị cấm hiện. */
function expectOf(v, blocked = []) {
  const ok = (p) => !blocked.some((b) => p.url.includes(b));
  const allowed = (v.photos || []).filter((p) => ok(p) && (!isG(p) || hasAttr(p)));
  const first = allowed[0] || null;
  return {
    v, first, stem: first ? stem(first.url) : null, author: first && isG(first) ? first.attribution.trim() : null,
    all: allowed.map((p) => ({ stem: stem(p.url), author: isG(p) ? p.attribution.trim() : null })),
    hide: (v.photos || []).filter((p) => isG(p) && !hasAttr(p)).map((p) => stem(p.url)),
    // tác giả của ảnh Google KHÔNG được hiện lúc này (ảnh sau, ảnh hỏng, ảnh bị cấm): không được xuất hiện ở bề mặt đó
    notShownAuthors: (v.photos || []).filter((p) => isG(p) && hasAttr(p) && !(first && p === first) && !(allowed.slice(0, 1).includes(p))).map((p) => p.attribution.trim()),
  };
}

/* Kiểm một bề mặt: scopeSel là vùng; exps là danh sách expectOf của các vendor đang hiện ở đó. forbid: chuỗi không được xuất hiện trong vùng. */
async function assertSurface(A, pg, scopeSel, exps, label, bad, { forbid = [], noOthers = true, thumbIndex = 0 } = {}) {
  for (const e of exps) {
    const nm = e.v.name;
    if (e.author) {
      const r = await A.probe(pg, { scopeSel, needle: e.author, thumbStem: e.stem });
      if (!r.found) bad(`${label}: ${nm}: ảnh Google đang hiện mà không thấy tên tác giả "${e.author}" (chữ hiển thị)`);
      else if (!r.visible) bad(`${label}: ${nm}: tên tác giả "${e.author}" có nhưng không nhìn thấy được (${r.why})`);
      else if (!r.near) bad(`${label}: ${nm}: tên tác giả "${e.author}" không đứng cạnh ảnh (${r.why})`);
    }
    for (const h of e.hide) if (await A.inDom(pg, { scopeSel, thumbStem: h })) bad(`${label}: ${nm}: ảnh Google thiếu tên tác giả vẫn bị hiện (${h.slice(-40)})`);
    if (noOthers) for (const a of e.notShownAuthors) if (a !== e.author && !exps.some((x) => x.author === a) && (await L.textIn(pg, scopeSel)).includes(a)) bad(`${label}: ${nm}: hiện tên tác giả "${a}" của ảnh KHÔNG đang hiện`);
  }
  const t = await L.textIn(pg, scopeSel);
  for (const f of forbid) if (t.includes(f)) bad(`${label}: hiện chữ không được phép "${f}" (ảnh không phải Google không có ghi công)`);
}
const dotEls = (pg, scopeSel) => pg.evaluate((s) => [...document.querySelector(s).querySelectorAll('button')].filter((b) => !(b.innerText || '').trim() && b.getBoundingClientRect().height <= 10 && b.getBoundingClientRect().height > 0).length, scopeSel);
/* bấm chấm thứ i (theo thứ tự trái sang phải); cuộn tới trước khi bấm */
const clickDot = (pg, scopeSel, i) => pg.evaluate(([s, k]) => { const ds = [...document.querySelector(s).querySelectorAll('button')].filter((b) => !(b.innerText || '').trim() && b.getBoundingClientRect().height <= 10 && b.getBoundingClientRect().height > 0).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left); ds[k].scrollIntoView({ block: 'center' }); ds[k].click(); }, [scopeSel, i]);

/* Luồng chat: danh sách -> chi tiết (từng ảnh) -> chọn so sánh -> bảng so sánh.
 * cfg: { vendors, blocked:[stem], detail:[vendor,...], anchor, picks:[vendor,...], forbid:[...] } */
async function chatFlow(A, cfg, bad) {
  const exp = (v) => expectOf(v, cfg.blocked || []);
  const names = (vs) => vs.map((v) => v.name);
  const open = (extra) => A.open('__t156c.html', '', { vendors: cfg.vendors, blockStems: cfg.blocked || [], ...extra });
  const waitList = (pg) => pg.waitForFunction((n) => n.every((x) => document.body.innerText.includes(x)), names(cfg.vendors), { timeout: 20000 });
  /* 1. danh sách */
  { const pg = await open();
    try { await waitList(pg); await pg.waitForTimeout(1500); await assertSurface(A, pg, '[data-card="0"]', cfg.vendors.map(exp), 'danh sách chat', bad, { forbid: cfg.forbid }); }
    catch (e) { bad('danh sách chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close(); }
  /* 2. chi tiết, từng ảnh một */
  for (const v of cfg.detail || []) {
    const pg = await open();
    try {
      await waitList(pg); await pg.waitForTimeout(800);
      await pg.locator('[data-card="0"]').getByText(v.name, { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(1200);
      const e = exp(v);
      const gal = e.all;
      const nDots = await dotEls(pg, '[data-card="1"]');
      if (gal.length > 1 && nDots !== gal.length) { bad(`chi tiết ${v.name}: ${gal.length} ảnh dùng được mà có ${nDots} chấm chuyển ảnh (eval không đo được từng ảnh)`); }
      for (let i = 0; i < gal.length; i++) {
        if (i > 0 && nDots === gal.length) { await clickDot(pg, '[data-card="1"]', i); await pg.waitForTimeout(900); }
        if (process.env.T156_DEBUG) console.log('DBG', v.name, i, (await L.textIn(pg, '[data-card="1"]')).slice(0, 80));
        const g = gal[i];
        const one = { v, stem: g.stem, author: g.author, hide: i === 0 ? e.hide : [], notShownAuthors: gal.filter((_, k) => k !== i && gal[k].author && gal[k].author !== g.author).map((x) => x.author) };
        await assertSurface(A, pg, '[data-card="1"]', [one], `chi tiết ${v.name} ảnh ${i + 1}/${gal.length}`, bad, { forbid: i === 0 ? cfg.forbid : [] });
      }
    } catch (e) { bad(`chi tiết ${v.name}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* 3. chọn vendor để so sánh + 4. bảng so sánh */
  if (cfg.anchor) {
    const pg = await open();
    try {
      await waitList(pg); await pg.waitForTimeout(800);
      await pg.locator('[data-card="0"]').getByText(cfg.anchor.name, { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 });
      await pg.getByRole('button', { name: /So sánh/ }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="2"]', { timeout: 5000 });
      await pg.waitForFunction((n) => n.every((x) => document.querySelector('[data-card="2"]').innerText.includes(x)), names(cfg.vendors.filter((v) => v.id !== cfg.anchor.id)), { timeout: 15000 });
      await pg.waitForTimeout(1500);
      await assertSurface(A, pg, '[data-card="2"]', cfg.vendors.map(exp), 'chọn vendor so sánh', bad, { forbid: cfg.forbid });
      for (const v of cfg.picks) await pg.locator('[data-card="2"]').getByText(v.name, { exact: false }).first().click({ timeout: 5000 });
      await pg.getByRole('button', { name: new RegExp('So sánh ' + (cfg.picks.length + 1) + ' vendor') }).click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(1200);
      await assertSurface(A, pg, '[data-card="3"]', [cfg.anchor, ...cfg.picks].map(exp), 'bảng so sánh', bad, { forbid: cfg.forbid });
    } catch (e) { bad('luồng so sánh: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
}

/* Luồng vendor đã lưu: hàng ở danh sách Vendors + tờ chi tiết ở màn Ngân sách.
 * cfg: { vendors, blocked, lookup: 'ok' | '500' (tra pool lỗi: chỉ còn ảnh trong bản lưu), budgetOf:[vendor], forbid } */
async function savedFlow(A, cfg, bad) {
  const byId = {};
  for (const v of cfg.vendors) byId[v.id] = cfg.lookup === '500' ? '500' : v;
  const snap = (v) => ({ ...v, photos: v.photos }); // bản lưu: cùng danh sách ảnh nhưng KHÔNG có attribution (bản lưu chỉ giữ URL)
  const expLive = (v) => expectOf(v, cfg.blocked || []);
  const expOf = (v) => {
    if (cfg.lookup !== '500') return expLive(v);
    // tra lỗi: chỉ còn URL của bản lưu; ảnh Google không biết tác giả => không được hiện; ảnh không phải Google vẫn hiện
    const bare = { ...v, photos: v.photos.map((p) => (isG(p) ? { url: p.url, source: p.source } : { url: p.url, source: p.source })) };
    return expectOf(bare, cfg.blocked || []);
  };
  const doc = L.savedDoc(cfg.vendors.map((v) => L.mkSaved(snap(v))));
  const names = cfg.vendors.map((v) => v.name);
  { const pg = await A.open('__t156s.html', '', { vendors: [], byId, blockStems: cfg.blocked || [], saved: doc });
    try {
      await pg.waitForFunction((n) => n.every((x) => document.body.innerText.includes(x)), names, { timeout: 20000 }); await pg.waitForTimeout(2000);
      await assertSurface(A, pg, '#root', cfg.vendors.map(expOf), 'danh sách đã lưu (hàng Vendors)', bad, { forbid: cfg.forbid });
      const after = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('th_vendors_t156')); } catch (e) { return null; } });
      const keep = (d) => JSON.stringify(((d && d.photography && d.photography.shortlisted) || []).map((x) => [x.id, x.gallery, x.grad]));
      if (keep(after) !== keep(doc)) bad('danh sách đã lưu: dữ liệu đã lưu trong máy (gallery/grad của vendor) bị sửa khi hiển thị ghi công (spec: không sửa dữ liệu đã lưu)');
    } catch (e) { bad('danh sách đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close(); }
  for (const v of cfg.budgetOf || []) {
    const pg = await A.open('__t156s.html', '?v=budget', { vendors: [], byId, blockStems: cfg.blocked || [], saved: doc });
    try {
      await pg.waitForFunction((n) => document.body.innerText.includes(n), v.name, { timeout: 20000 }); await pg.waitForTimeout(1500);
      await pg.getByText(v.name, { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(2000);
      await assertSurface(A, pg, 'body', [expOf(v)], `màn Ngân sách, tờ chi tiết ${v.name}`, bad, { forbid: cfg.forbid });
    } catch (e) { bad(`màn Ngân sách ${v.name}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
}
module.exports = { expectOf, assertSurface, chatFlow, savedFlow };
