#!/usr/bin/env node
// Bất biến tóm tắt khi bấm nhân vật (nguồn: T-037, spec products/T-037-bam-nhan-vat-tom-tat.md v2, ADR-017; qua Spec Gate 2026-11-01, spec-critic).
//   node sum_inv.cjs --repo <repo-dashboard> --check <lit-match|no-leak|one-layer|own-text|esc-layers>
// In một dòng `PASS <check>` / `FAIL <check>: lý do`; mã thoát 0/1.
// Chưa áp dụng (PASS "chưa áp dụng") khi trang chưa có #model-sum-live và repo chưa có docs/screenshots/T-037/.
// Hợp đồng quan sát (spec T-037): g.mch[data-block] là nút; tóm tắt là #fx_s g.sum[data-block][data-state] với
// [data-part=sum-bg] và [data-part=sum-line]; vùng đọc #model-sum-live. Dữ liệu, kênh live và d3 đều giả/cục bộ.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2), arg = n => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log(`FAIL ${CHECK}: thiếu d3.min.js cục bộ (biến D3)`); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log(`FAIL ${CHECK}: không thấy index.html trong ${REPO}`); process.exit(1); }

const CHARS = ['nd_intents', 'nd_spec', 'nd_respec', 'gt_spec', 'nd_exec', 'nd_rework', 'gt_code', 'nd_capu', 'nd_insight', 'nd_kr', 'nd_prod'];
// Quy tắc A (T-032, spec T-037 mục 1): việc khối giữ.
const heldBy = {
  nd_intents: t => t.owner === 'product' && t.state === 'new',
  nd_spec: t => t.owner === 'product' && (t.state === 'doing' || t.state === 'rework'),
  gt_spec: t => t.owner === 'product' && t.state === 'review',
  nd_respec: t => t.state === 'spec',
  nd_exec: t => t.owner === 'engineering' && (t.state === 'new' || t.state === 'doing'),
  nd_rework: t => t.owner === 'engineering' && t.state === 'rework',
  gt_code: t => t.owner === 'engineering' && t.state === 'review',
  nd_capu: t => t.state === 'escalated' || (t.owner === 'engineering' && t.state === 'done' && t.tier !== 'A' && (t.hours_since_update ?? 0) < 48),
  nd_insight: t => t.owner === 'insight' && (t.state === 'doing' || t.state === 'rework'),
  nd_kr: () => false, nd_prod: () => false,
};
const SECRET = { detail: 'SECRET-DETAIL', link: 'SECRET-LINK/path', notes: 'SECRET-NOTE', defect: 'SECRET-DEFECT' };
const T = (id, state, owner, o = {}) => ({ id, title: o.title || 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.hours ?? 2, tier: o.tier || 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0, ...SECRET });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = tasks => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 17, regression_evals: 12, insight_reports: 1, last_insight: '', specs: 2 } });
// Dữ liệu trộn: khối nhiều việc (> 3), khối rảnh, escalated và diff chờ đọc, việc không thuộc khối nào.
const MIX = () => [
  ...[1, 2, 3, 4, 5].map(i => T('T-' + (100 + i), 'doing', 'product', { title: 'Spec: việc số ' + i + ' có tên khá dài để bị cắt bớt' })),
  T('T-110', 'new', 'product'), T('T-111', 'review', 'product'), T('T-112', 'spec', 'engineering'),
  T('T-113', 'new', 'engineering'), T('T-114', 'doing', 'engineering'), T('T-115', 'review', 'engineering'),
  T('T-116', 'escalated', 'engineering'), T('T-117', 'done', 'engineering', { tier: 'B', hours: 3 }), T('T-118', 'done', 'engineering', { tier: 'A' }),
  T('T-119', 'blocked', 'product'), T('T-120', 'new', 'insight')];
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9900 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', detail: 'SECRET-EVENT-DETAIL', link: 'SECRET-EVENT-LINK', ...o });

let browser;
async function open(vp, data, motion) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: motion ? 'no-preference' : 'reduce', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const send = (o, e) => o.sock && o.sock.send(JSON.stringify(live(e)));
// reduced-motion: tóm tắt hiện đủ chữ ngay (spec T-037 mục 7), nên đọc được nội dung đầy đủ không cần chờ gõ.
const sumState = o => o.page.evaluate(() => { const g = document.querySelector('#fx_s g.sum'), lv = document.getElementById('model-sum-live');
  return { n: document.querySelectorAll('#fx_s g.sum').length, block: g && g.getAttribute('data-block'), st: g && g.getAttribute('data-state'),
    lines: g ? [...g.querySelectorAll('[data-part=sum-line]')].map(l => l.textContent) : [], html: g ? g.outerHTML : '', live: lv ? lv.textContent : '',
    zoom: document.querySelector('#model') && document.querySelector('#model').getAttribute('data-zoom') === 'on' }; });
const litOf = (o, id) => o.page.evaluate(id => { const e = document.getElementById(id), sh = e && e.querySelector(':scope > rect, :scope > circle'); return sh ? parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5 : null; }, id);
async function clickChar(o, id) {
  const c = await o.page.evaluate(id => { const b = document.querySelector('#model svg g.mch[data-block="' + id + '"] [data-part=body]'); if (!b) return null;
    b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  if (!c) return false; await o.page.mouse.click(c.x, c.y); return true;
}
async function openSum(o, id) { await clickChar(o, id); const t0 = Date.now(); let s;
  while (Date.now() - t0 < 4000) { s = await sumState(o); if (s.n === 1 && s.block === id && s.st === 'done') return s; await o.page.waitForTimeout(50); } return s; }
async function closeSum(o) { await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(120); }
const countOf = lines => lines.reduce((a, l) => a + (/^T-\S+ · /.test(l) ? 1 : 0) + ((/^\+(\d+) việc nữa$/.exec(l) || [])[1] | 0), 0);

async function applicable() {
  if (fs.existsSync(path.join(REPO, 'docs', 'screenshots', 'T-037'))) return true;
  const o = await open({ width: 1280, height: 900 }, dash([]));
  try { return await o.page.evaluate(() => !!document.getElementById('model-sum-live')); } finally { await o.ctx.close(); }
}

const CHECKS = {
  // inv-023: đèn và lời không nói hai điều khác nhau.
  'lit-match': async () => {
    const errs = [], tasks = MIX();
    const o = await open({ width: 1280, height: 900 }, dash(tasks));
    try {
      for (const id of CHARS) { const s = await openSum(o, id); if (s.n !== 1 || s.block !== id) { errs.push(`${id}: bấm không mở tóm tắt`); continue; }
        const lit = await litOf(o, id), held = tasks.filter(heldBy[id]).length, idle = s.lines[0] === 'Đang rảnh';
        if (lit && idle) errs.push(`${id} sáng mà nói "Đang rảnh"`);
        if (lit === false && !idle) errs.push(`${id} tắt mà nói "${s.lines[0]}"`);
        if (held && countOf(s.lines) !== held) errs.push(`${id} giữ ${held} việc mà tóm tắt đếm ${countOf(s.lines)}`);
        if (!held && !idle && !/^Vừa (nhận|giao) /.test(s.lines[0])) errs.push(`${id} không giữ việc mà dòng là "${s.lines[0]}"`);
        await closeSum(o); }
    } finally { await o.ctx.close(); }
    // Khối chỉ sáng vì dot (nd_kr nhận dot khi spec qua cổng): mỗi khung, đèn và lời khớp (lệch ≤ 300 ms); có ít nhất một khung sáng.
    const o2 = await open({ width: 1280, height: 900 }, dash([T('T-2', 'doing', 'product', { title: 'Spec: thử khối sáng vì dot' })]), true); // dot chỉ chạy khi không reduced-motion (inv-005)
    try {
      const s0 = await openSum(o2, 'nd_kr'); if (s0.n !== 1) { errs.push('nd_kr: bấm không mở tóm tắt'); return errs; }
      await o2.page.evaluate(() => { const sh = document.querySelector('#nd_kr > rect, #nd_kr > circle'); window.__L = { on: true, s: [] };
        const f = t => { if (!window.__L.on) return; const l = document.querySelector('#fx_s g.sum [data-part=sum-line]');
          window.__L.s.push({ t, lit: parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5, l0: l ? l.textContent : null }); requestAnimationFrame(f); }; requestAnimationFrame(f); });
      send(o2, { task: 'T-2', event: 'accepted', from: 'spec-critic', to: 'done', state: 'done', holder: '-', owner: 'product' });
      await o2.page.waitForTimeout(13500);
      const S = await o2.page.evaluate(() => { window.__L.on = false; return window.__L.s; });
      let run0 = null, worst = null;
      for (const x of S) { const bad = x.l0 === null ? 'tóm tắt bị đóng' : (x.lit && x.l0 === 'Đang rảnh' ? 'sáng mà nói "Đang rảnh"' : (!x.lit && x.l0 !== 'Đang rảnh' ? `tắt mà còn nói "${x.l0}"` : null));
        if (bad) { if (run0 === null) run0 = x.t; if (x.t - run0 > 300 && !worst) worst = bad; } else run0 = null; }
      if (!S.some(x => x.lit)) errs.push('nd_kr không sáng lần nào sau dot (không thử được)');
      if (worst) errs.push('nd_kr khi có dot: ' + worst);
    } finally { await o2.ctx.close(); }
    return errs;
  },
  // inv-024: tóm tắt và vùng đọc chỉ có trường công khai.
  'no-leak': async () => {
    const errs = [], o = await open({ width: 1280, height: 900 }, dash(MIX()));
    try {
      for (const id of CHARS) { const s = await openSum(o, id); if (s.n !== 1 || s.block !== id) { errs.push(`${id}: bấm không mở tóm tắt`); continue; } if (/SECRET/.test(s.html) || /SECRET/.test(s.live)) errs.push(`${id} rò trường riêng tư`); await closeSum(o); }
      await openSum(o, 'gt_spec'); send(o, { task: 'T-111', event: 'accepted', from: 'spec-critic', to: 'engineering', state: 'new', holder: 'engineering', owner: 'engineering' });
      await o.page.waitForTimeout(1500); const s = await sumState(o); if (s.n !== 1) errs.push('tóm tắt gt_spec không mở để thử sự kiện live'); else if (/SECRET/.test(s.html) || /SECRET/.test(s.live)) errs.push('rò trường riêng tư của sự kiện live');
    } finally { await o.ctx.close(); }
    return errs;
  },
  // inv-025: một tóm tắt, ở lớp riêng sau #fx_b; bong bóng sự kiện ≤ 3 và không có bong bóng sự kiện cùng khối khi tóm tắt mở.
  'one-layer': async () => {
    const errs = [], o = await open({ width: 1280, height: 900 }, dash([T('T-1', 'doing', 'product'), T('T-2', 'doing', 'product'), T('T-9', 'doing', 'engineering')]), true); // bong bóng sự kiện cần chuyển động
    try {
      await o.page.evaluate(() => { window.__M = { sum: 0, bub: 0, same: 0, on: true }; const f = () => { if (!window.__M.on) return; const g = document.querySelector('#fx_s g.sum');
        window.__M.sum = Math.max(window.__M.sum, document.querySelectorAll('g.sum').length); window.__M.bub = Math.max(window.__M.bub, document.querySelectorAll('#fx_b .bub').length);
        if (g && document.querySelector('#fx_b .bub[data-block="' + g.getAttribute('data-block') + '"]')) window.__M.same++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await openSum(o, 'nd_spec');
      const lay = await o.page.evaluate(() => { const svg = document.querySelector('#model svg'), s = document.getElementById('fx_s'), b = document.getElementById('fx_b');
        if (!s || !b) return 'thiếu #fx_s hoặc #fx_b'; if (svg.lastElementChild !== s) return '#fx_s không phải con cuối của svg'; if (!(b.compareDocumentPosition(s) & 4)) return '#fx_s không đứng sau #fx_b';
        return document.querySelector('#fx_b g.sum') ? 'tóm tắt nằm trong #fx_b' : null; });
      if (lay) errs.push(lay);
      for (let i = 0; i < 8; i++) send(o, { task: i % 2 ? 'T-1' : 'T-' + (300 + i), event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' });
      await o.page.waitForTimeout(600); await clickChar(o, 'nd_exec'); await o.page.waitForTimeout(400); await clickChar(o, 'gt_spec'); await o.page.waitForTimeout(2500);
      const m = await o.page.evaluate(() => { window.__M.on = false; return window.__M; });
      if (m.sum > 1) errs.push(`${m.sum} tóm tắt cùng lúc`); if (m.bub > 3) errs.push(`${m.bub} bong bóng sự kiện cùng lúc`); if (m.same) errs.push(`${m.same} khung có bong bóng sự kiện cùng khối với tóm tắt đang mở`);
    } finally { await o.ctx.close(); }
    return errs;
  },
  // inv-026: tóm tắt trọn trong svg, không che chữ của chính khối, không đè thân bot của nhân vật đó (390, 1280; thường và phóng to).
  'own-text': async () => {
    const errs = [], W = 'CẬP NHẬT BẢNG MÔ HÌNH EVAL GATED', tasks = [];
    const add = (own, st, tier) => { for (let i = 0; i < 4; i++) tasks.push(T('T-' + (900 + tasks.length), st, own, { title: W, tier: tier || 'A', hours: 1 })); };
    add('product', 'new'); add('product', 'doing'); add('product', 'review'); add('product', 'spec'); add('engineering', 'doing'); add('engineering', 'rework'); add('engineering', 'review'); add('engineering', 'done', 'B'); add('insight', 'doing');
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) for (const zoom of [false, true]) {
      const o = await open(vp, dash(tasks));
      try {
        if (zoom) { const z = await o.page.$('#model-zoom'); if (!z) continue; await z.click(); await o.page.waitForTimeout(500); }
        for (const id of CHARS) { const s = await openSum(o, id); if (s.n !== 1) { errs.push(`${vp.width}${zoom ? ' phóng to' : ''} ${id}: không mở`); continue; }
          const g = await o.page.evaluate(id => { const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), sc = sr.width / (svg.viewBox.baseVal.width || 1000);
            const r = document.querySelector('#fx_s g.sum [data-part=sum-bg]').getBoundingClientRect(), out = [];
            if (r.left < sr.left - 0.5 || r.right > sr.right + 0.5 || r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5) out.push('ra ngoài svg');
            const ov = q => Math.min(r.right, q.right) - Math.max(r.left, q.left) > 0.5 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 0.5;
            const body = document.querySelector('#model svg g.mch[data-block="' + id + '"] [data-part=body]');
            if (body) { const b = body.getBoundingClientRect(); if (Math.min(r.right, b.right) - Math.max(r.left, b.left) > 0.5 * sc && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 0.5 * sc) out.push('đè thân bot'); }
            const own = document.getElementById(id); if (own) own.querySelectorAll('text').forEach(t => { if (t.closest('.mch') || !t.textContent.trim()) return; const q = t.getBoundingClientRect(); if (q.width && ov(q)) out.push('che chữ "' + t.textContent.trim().slice(0, 16) + '"'); });
            return out; }, id);
          if (g.length) errs.push(`${vp.width}${zoom ? ' phóng to' : ''} ${id}: ${g.join(', ')}`);
          await closeSum(o); }
      } finally { await o.ctx.close(); }
    }
    return errs;
  },
  // inv-027: Esc đóng từng lớp: tóm tắt trước, phóng to sau (mở rộng inv-021).
  'esc-layers': async () => {
    const errs = [];
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      const o = await open(vp, dash(MIX()));
      try {
        const z = await o.page.$('#model-zoom'); if (!z) { errs.push(`${vp.width}px không có #model-zoom`); continue; }
        await z.click(); await o.page.waitForTimeout(500);
        const s0 = await openSum(o, 'nd_spec'); if (s0.n !== 1 || !s0.zoom) { errs.push(`${vp.width}px không mở được tóm tắt trong phóng to`); continue; }
        await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(300); let s = await sumState(o);
        if (s.n !== 0) errs.push(`${vp.width}px Esc lần một không đóng tóm tắt`); if (!s.zoom) errs.push(`${vp.width}px Esc lần một đóng luôn phóng to`);
        await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(400); s = await sumState(o);
        if (s.zoom) errs.push(`${vp.width}px Esc lần hai không đóng phóng to`);
        if (o.errors.length) errs.push('lỗi trang: ' + o.errors[0]);
      } finally { await o.ctx.close(); }
    }
    return errs;
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log(`FAIL ${CHECK}: không có check này`); process.exit(1); }
  browser = await chromium.launch(); let errs, na = false;
  try { if (!(await applicable())) na = true; else errs = await CHECKS[CHECK](); } catch (e) { errs = ['lỗi chạy: ' + (e && e.stack || e)]; }
  await browser.close();
  if (na) { console.log(`PASS ${CHECK} (chưa áp dụng: T-037 chưa vào, trang chưa có #model-sum-live)`); process.exit(0); }
  console.log(errs.length ? `FAIL ${CHECK}: ${errs.slice(0, 6).join(' | ')}` : `PASS ${CHECK}`);
  process.exit(errs.length ? 1 : 0);
})();
