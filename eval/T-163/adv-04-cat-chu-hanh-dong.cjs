#!/usr/bin/env node
// Eval đối kháng T-163 (adversary), spec T-162 v3.1 Hành vi 1: chữ tên và chữ hành động của nhịp trên node bị cắt bằng "…" (một dòng),
// hộp node (vòng tròn, nhãn) nằm trong khung ở 390px và 1200px; tên đầy đủ ở title hoặc tooltip.
// Input: hành động dài 70 ký tự ở các node cột mép; tên và hành động in hoa có dấu (chữ rộng hơn ước 7px/ký tự của cách cắt);
// chuỗi bệnh lý toàn M/W vẫn vượt khung ở 390px: ghi minor trong accept note T-163, không đưa vào eval vì hook (activity_hook.py ACTIONS, live.py --done) không sinh chuỗi như vậy;
// một bộ phận tên 19 ký tự. Mong đợi: mọi node trong khung, không cuộn ngang, chữ dài kết thúc bằng "…", không có chữ "Đang làm" khi có nhịp,
// rê chuột thấy tên đầy đủ (bắt buộc). Hành động đầy đủ trong tooltip: spec chưa nói, chỉ in MINOR nếu thiếu, không làm FAIL.
const fs = require('fs'), path = require('path');
const REPO = process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard';
const INDEX = path.join(REPO, 'index.html');
const D3 = process.env.D3 || '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js';
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
if (!fs.existsSync(D3)) fail('thiếu d3.min.js (biến D3)');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { fail('thiếu playwright'); }
const stamp = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 16);
const WIDE = 'BỘ PHẬN ĐỐI KHÁNG MỚI';   // 21 ký tự in hoa có dấu
const ids = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary', 'qa-kiem-thu-tu-dong', 'wide-bot'];
const roster = ids.map(id => ({ id, name: id === 'wide-bot' ? WIDE : id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const T = (id, holder) => ({ id, title: id, state: 'doing', holder, owner: holder, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: stamp, updated: stamp, hours_since_update: 1, tier: 'A', area: 'hq/dashboard', product: 'hq', evals: 1, spec_returns: 0, evals_added: 0 });
const holders = ids.slice(2);
const data = { generated_at: stamp, timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: holders.map((h, i) => T('T-' + (i + 1), h)), events: [], roster, capu_queue: [],
  model: { invariants: {}, invariants_total: 0, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 0 } };
const LONG = 'Chạy lại toàn bộ eval tầng hai cho vùng hq/dashboard sau khi sửa export';
const WACT = 'Task [CÀI T-162: SƠ ĐỒ LUỒNG THEO ROSTER] đã hoàn thành';   // dạng live.py --done, tiêu đề in hoa
const ACT = { insight: LONG, 'spec-critic': WACT, engineering: LONG, 'qa-kiem-thu-tu-dong': LONG, 'wide-bot': WACT, product: 'Viết spec' };
(async () => {
  const browser = await chromium.launch(); const why = [], minor = [];
  for (const w of [390, 1200]) {
    const page = await browser.newPage({ viewport: { width: w, height: 1400 } }); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [],
      activity: Object.entries(ACT).map(([agent, action], i) => ({ agent, action, task: 'T-' + (holders.indexOf(agent) + 1), at: Date.now() - 2000 - i })) })));
    await page.goto('file://' + INDEX); await page.waitForTimeout(1500);
    if (errors.length) why.push(`${w}px: lỗi trang ${errors[0]}`);
    const f = await page.evaluate(() => { const svg = document.querySelector('#flow svg'); const sr = svg.getBoundingClientRect();
      return { hscroll: document.documentElement.scrollWidth > innerWidth, nodes: [...svg.querySelectorAll('.chr[data-agent]')].map(c => { const g = c.parentNode, r = g.getBoundingClientRect();
        const texts = [...g.querySelectorAll(':scope > text')].map(t => { const b = t.getBoundingClientRect(); return { s: t.textContent, out: b.left < sr.left - 1 || b.right > sr.right + 1 }; });
        return { id: c.getAttribute('data-agent'), texts, inside: r.left >= sr.left - 1 && r.right <= sr.right + 1, title: (g.querySelector('title') || {}).textContent || '' }; }) }; });
    if (f.hscroll) why.push(`${w}px: trang cuộn ngang`);
    for (const n of f.nodes) {
      if (!n.inside) why.push(`${w}px: node ${n.id} vượt khung (${n.texts.filter(t => t.out).map(t => '"' + t.s + '"').join(', ')})`);
      const all = n.texts.map(t => t.s).join('|');
      if (ACT[n.id] && /đang làm/i.test(all)) why.push(`${w}px: ${n.id} có nhịp mà vẫn hiện "Đang làm"`);
      const a = ACT[n.id]; if (a && !n.texts.some(t => t.s === a || (t.s.endsWith('…') && a.startsWith(t.s.slice(0, -1))))) why.push(`${w}px: ${n.id} không hiện hành động (đủ hoặc cắt bằng …): ${all}`);
    }
    // rê chuột: tên đầy đủ (bắt buộc) và hành động đầy đủ (minor)
    for (const id of ['qa-kiem-thu-tu-dong', 'wide-bot', 'engineering']) {
      const full = id === 'wide-bot' ? WIDE : id;
      const c = await page.$(`#flow svg .chr[data-agent="${id}"]`); const g = c && await c.evaluateHandle(e => e.parentNode);
      const ring = g && await g.asElement().$(':scope > circle:not([class])'); if (!ring) { why.push(`${w}px: không thấy node ${id}`); continue; }
      await ring.hover({ force: true }); await page.waitForTimeout(150);
      const tip = await page.evaluate(() => { const t = document.querySelector('#flow .tip'); return t ? t.textContent : ''; });
      const title = f.nodes.find(n => n.id === id).title;
      if (!tip.includes(full) && !title.includes(full)) why.push(`${w}px: rê chuột ${id} không thấy tên đầy đủ "${full}"`);
      if (!tip.includes(ACT[id]) && !title.includes(ACT[id])) minor.push(`${w}px: ${id} không có hành động đầy đủ trong tooltip/title`);
    }
    await page.close();
  }
  await browser.close();
  if (minor.length) console.log('MINOR ' + minor.join(' | '));
  console.log(why.length ? 'FAIL ' + [...new Set(why)].join(' | ') : 'PASS'); process.exit(why.length ? 1 : 0);
})();
