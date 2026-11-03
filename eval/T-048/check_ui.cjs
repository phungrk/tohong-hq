#!/usr/bin/env node
/*
 * Eval tầng 1 của T-048 (front): khối "Cách hoạt động" (Tìm, Lưu, Chốt, Vào ngân sách) trong màn chi tiết hạng mục ngân sách.
 * Spec: products/T-048-cach-hoat-dong-chi-tiet-hang-muc.md. --only N = tiêu chí N (1 vị trí và hạng mục nào hiện, 2 hình khối và token màu,
 * 3 truy cập, 4 390px, 5 "Chi tiết" mở/đóng, 6 không đổi hành vi ngân sách). Tiêu chí 7 (ảnh): python3 eval/T-048/check_pr.py.
 *
 * Chạy: cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-048/check_ui.cjs --repo . [--only 1] [--shots DIR] [--dist DIR]
 * Tự `vite build` ra thư mục tạm, VITE_API_BASE=http://api.test, mạng ngoài bị chặn, API giả trong bộ nhớ. Dữ liệu là bịa.
 * Chạy được trên main lẫn nhánh feat/t046-venue-theo-ban: không đo tiền chi của vendor, không đọc mã nguồn.
 * Tìm phần tử theo CHỮ và VAI TRÒ (getByRole, tên truy cập, listitem, dialog). Đọc style tính toán chỉ để so MÀU với token của app; không có bộ chọn theo style/class/cấu trúc component.
 * Dòng cuối PASS hoặc FAIL <lý do đầu> (+n lỗi nữa); mã thoát 0/1 (2 = không chạy được).
 */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execSync } = require('child_process');
const { createRequire } = require('module');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const SHOTS = arg('--shots'); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
const wants = (c) => !ONLY || ONLY.includes(c);

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', path.join(execSync('npm root -g').toString().trim(), 'playwright')].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}
const { chromium } = loadPlaywright();

const fails = []; let crit = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 600) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 140) + ']' : ''}`);
};
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* ---------- build + server ---------- */
let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't048-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test' } });
  } catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

/* ---------- dữ liệu giả ---------- */
const CID = 'c-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const venueV = () => ({ id: 'v-venue', name: 'Nhà hàng Hoa Sen', priceTotal: 6, spec: '10 người/bàn' });
const photoV = () => ({ id: 'v-photo', name: 'Studio Ánh Dương', priceTotal: 12 });
const BUDGET = { total_tr: 500, guests: 205, mung_tr: 0, categories: [
  { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, items: [{ id: 'i-keep-venue', name: 'Bánh cưới', amt: 3 }] },
  { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, items: [{ id: 'i-album', name: 'Album', amt: 5 }] },
  { id: 'decor', name: 'Trang trí tiệc + hoa', pct: 6, priority: 'mid', allocated_tr: 30, items: [] },
  { id: 'reserve', name: 'Dự phòng phát sinh', pct: 10, priority: null, allocated_tr: 50, items: [] },
] };
const withStats = (b) => { const cats = b.categories.map((c) => { const est = (c.items || []).reduce((s, i) => s + (Number(i.amt) || 0), 0);
  return { ...c, estimated_tr: est, variance_tr: (c.allocated_tr || 0) - est, state: est === 0 ? 'chua_phan_bo' : 'dang_theo_doi' }; });
  const te = cats.reduce((s, c) => s + c.estimated_tr, 0); return { ...b, categories: cats, total_estimated_tr: te, total_variance_tr: b.total_tr - te, budget_used_pct: Math.round(te / b.total_tr * 100) }; };

const TOKENS = { kim500: '--kim-500', kim600: '--kim-600', sage500: '--sage-500', son500: '--son-500', son300: '--son-300' };
const STEPS = ['Tìm', 'Lưu', 'Chốt', 'Vào ngân sách'];
const STEP_TOKEN = ['kim500', 'kim600', 'sage500', 'son500'];
const SHEET_TITLES = ['Tìm vendor phù hợp', 'Lưu vendor bạn thích', 'Chốt vendor chính thức', 'Tự động vào ngân sách'];
const SHEET_DESCS = [
  'Hỏi Tơ Hồng gợi ý vendor theo phong cách, ngân sách và khu vực của bạn cho từng hạng mục.',
  'Lưu những vendor ưng ý vào từng hạng mục. Vendor đã lưu nằm trong mục Vendor đã lưu của hạng mục đó.',
  'Khi đã quyết định, bấm Chốt trên vendor đó. Mỗi hạng mục chỉ chốt một vendor.',
  'Vendor vừa chốt được tính vào chi phí của hạng mục này và vào tổng Đã chốt của ngân sách.',
];

let browser, BASE;
async function scenario(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const S = { page, ctx, puts: [], external: [], errors: [], nonGet: [], store: JSON.parse(JSON.stringify(BUDGET)) };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(BASE) || u.startsWith('http://api.test')) return route.continue(); S.external.push(u); return route.abort(); });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (m !== 'GET') S.nonGet.push(m + ' ' + p);
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    if (p === `/api/couples/${CID}/budget` && m === 'GET') return json(withStats(S.store));
    if (p === `/api/couples/${CID}/budget` && m === 'PUT') { const b = JSON.parse(req.postData() || '{}'); S.puts.push(b); S.store = { ...S.store, ...b }; return json(withStats(S.store)); }
    if (p === `/api/couples/${CID}/summary`) return json({ profile: {}, budget: { total_tr: S.store.total_tr }, guests: { capacity: S.store.guests, total: 0, yes: 0, pending: 0, no: 0 } });
    if (p === `/api/couples/${CID}/conversations`) return json({ conversations: [] });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    return json({});
  });
  const saved = { venue: { shortlisted: [venueV()], confirmed: null }, photography: { shortlisted: [], confirmed: null }, decor: { shortlisted: [photoV()], confirmed: null } };
  await page.addInitScript(([cid, sv]) => { try { if (!sessionStorage.getItem('t048-seeded')) { localStorage.setItem('th_vendors_' + cid, JSON.stringify(sv)); localStorage.setItem('th_user', JSON.stringify({ bride: 'An', groom: 'Bình' })); sessionStorage.setItem('t048-seeded', '1'); } } catch { /* bỏ qua */ } }, [CID, saved]);
  await page.goto(BASE + '/#/ngan-sach'); await page.waitForTimeout(500);
  return S;
}
async function openCat(S, id) { await S.page.goto(BASE + '/#/ngan-sach/' + id); await S.page.waitForTimeout(600); }

/* Trong trang: hàm tìm theo chữ/vai trò. Trả JSON thuần. */
const PAGE_FN = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const inDialog = (e) => !!e.closest('[role="dialog"],dialog');
  const leaves = () => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && vis(e));
  const nameOf = (b) => norm(b.getAttribute('aria-label') || b.innerText || b.textContent);
  const rect = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const heading = () => { const l = leaves().find((e) => /^Vendor đã lưu\\s*·\\s*\\d+$/.test(norm(e.textContent)) && !inDialog(e)); return l || null; };
  const title = () => leaves().find((e) => norm(e.textContent) === 'Cách hoạt động' && !inDialog(e)) || null;
  // thẻ = tổ tiên nhỏ nhất của tiêu đề mà chứa cả nút tên "Chi tiết" lẫn các listitem
  const card = () => { let el = title(); while (el && el !== document.body) {
      if ([...el.querySelectorAll('button,[role="button"],a')].some((b) => nameOf(b) === 'Chi tiết') && el.querySelector('li,[role="listitem"]')) return el; el = el.parentElement; } return null; };
  const items = (c) => [...c.querySelectorAll('li,[role="listitem"]')];
  const labelLeaf = (li, label) => [...li.querySelectorAll('*')].concat([li]).find((e) => e.children.length === 0 && norm(e.textContent) === label) || null;
  const probe = (tok) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;background:var(' + tok + ')'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
  const probeText = (tok) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:-99px;top:0;color:var(' + tok + ')'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
  return { vis, norm, inDialog, leaves, nameOf, rect, heading, title, card, items, labelLeaf, probe, probeText };
})()`;
const P = (page, body, ...a) => page.evaluate(([h, b, x]) => { const H = eval(h); return new Function('H', 'x', 'return (' + b + ')(H, x)')(H, x); }, [PAGE_FN, body.toString(), a[0]]);
const chiTietBtn = (page) => page.getByRole('button', { name: 'Chi tiết', exact: true });

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); BASE = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  const run = async (n, fn) => { if (!wants(n)) return; crit = n; try { await fn(); } catch (e) { check('bước thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu?)', false, String(e.message).split('\n').slice(0, 14).join(' ')); } };

  /* TC1: vị trí và hạng mục nào hiện */
  await run(1, async () => {
    for (const [id, note] of [['venue', 'hạng mục vendor có 1 vendor đã lưu'], ['photography', 'hạng mục vendor chưa lưu vendor nào'], ['decor', 'hạng mục vendor khác']]) {
      const S = await scenario(); await openCat(S, id);
      const g = await P(S.page, (H) => { const c = H.card(), h = H.heading(); const d = H.leaves().find((e) => H.norm(e.textContent) === 'Dự toán' && !H.inDialog(e));
        return { card: c && H.rect(c), head: h && H.rect(h), duToan: d && H.rect(d), n: H.leaves().filter((e) => H.norm(e.textContent) === 'Cách hoạt động' && !H.inDialog(e)).length }; });
      check(`${id} (${note}): có đúng một khối "Cách hoạt động"`, !!g.card && g.n === 1, JSON.stringify(g));
      check(`${id}: có mục "Vendor đã lưu" (điều kiện của phép đo)`, !!g.head, norm(await S.page.evaluate(() => location.hash + ' | ' + document.body.innerText)).slice(0, 200));
      if (g.card && g.head) {
        const gap = g.head.t - g.card.b;
        check(`${id}: khối nằm trên tiêu đề "Vendor đã lưu", cách 0-40px (không có gì chen giữa)`, gap >= -1 && gap <= 40, 'gap=' + gap);
        check(`${id}: khối nằm dưới thẻ "Dự toán"`, !!g.duToan && g.duToan.b <= g.card.t + 1, JSON.stringify([g.duToan, g.card]));
        const between = await P(S.page, (H, k) => H.leaves().filter((e) => { const r = H.rect(e); return r.t >= k.b - 1 && r.b <= k.t + 1 && !H.card().contains(e); }).map((e) => H.norm(e.textContent)).slice(0, 4), { b: g.card.b, t: g.head.t });
        check(`${id}: không có chữ nào nằm giữa khối và tiêu đề "Vendor đã lưu"`, between.length === 0, JSON.stringify(between));
      }
      await S.ctx.close();
    }
    const S = await scenario(); await openCat(S, 'reserve');
    const r = await P(S.page, (H) => ({ card: !!H.card(), title: !!H.title(), head: !!H.heading(), name: H.leaves().some((e) => /Dự phòng phát sinh/.test(H.norm(e.textContent))) }));
    check('reserve (hạng mục không có mục "Vendor đã lưu"): màn có mở được và không có khối "Cách hoạt động"', r.name && !r.head && !r.card && !r.title, JSON.stringify(r));
    await S.ctx.close();
  });

  /* TC2: hình khối, thứ tự, token màu, nét đứt */
  await run(2, async () => {
    const S = await scenario(); await openCat(S, 'venue');
    const g = await P(S.page, (H, T) => { const c = H.card(); if (!c) return null; const cr = H.rect(c);
      const its = H.items(c).map((li) => { const txt = H.norm(li.innerText); const lf = H.labelLeaf(li, txt); return { text: txt, rect: H.rect(lf || li) }; });
      const circles = H.items(c).map((li) => { const svg = li.querySelector('svg'); if (!svg) return null; let e = svg.parentElement; while (e && e !== li.parentElement) { const bg = getComputedStyle(e).backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') break; e = e.parentElement; }
        return e && e !== li.parentElement ? { bg: getComputedStyle(e).backgroundColor, w: H.rect(e).w, round: getComputedStyle(e).borderRadius, svgStroke: getComputedStyle(svg).stroke, svgColor: getComputedStyle(svg).color, circleRect: H.rect(e) } : { bg: null }; });
      const dashed = [...c.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); const r = H.rect(e); return r.w > 0 && r.h < 6 && cs.borderTopStyle === 'dashed' && parseFloat(cs.borderTopWidth) > 0 || r.w < 6 && r.h > 0 && cs.borderLeftStyle === 'dashed' && parseFloat(cs.borderLeftWidth) > 0; })
        .map((e) => ({ color: getComputedStyle(e).borderTopColor, rect: H.rect(e) }));
      const tt = H.title(); const iconBefore = [...c.querySelectorAll('svg')].find((s) => { const r = H.rect(s); const t = H.rect(tt); return r.r <= t.l + 2 && Math.abs((r.t + r.b) / 2 - (t.t + t.b) / 2) < 12 && !H.items(c).some((li) => li.contains(s)); });
      const btn = [...c.querySelectorAll('button,[role="button"],a')].find((b) => H.nameOf(b) === 'Chi tiết');
      const chev = btn && btn.querySelector('svg');
      const tok = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, H.probe(v)]));
      return { cr, its, circles, dashed, hasTitleIcon: !!iconBefore, titleIconAria: iconBefore && iconBefore.getAttribute('aria-hidden'), btnRect: btn && H.rect(btn), chev: !!chev, tok, linkColor: btn && getComputedStyle(btn).color, linkTok: H.probeText('--son-500'), tt: H.rect(tt) }; }, TOKENS);
    check('có khối "Cách hoạt động" (tiêu đề + nút "Chi tiết" + danh sách bước)', !!g, 'không tìm thấy');
    if (g) {
      check('đúng 4 bước theo thứ tự chữ: Tìm, Lưu, Chốt, Vào ngân sách', JSON.stringify(g.its.map((i) => i.text)) === JSON.stringify(STEPS), JSON.stringify(g.its.map((i) => i.text)));
      const xs = g.its.map((i) => i.rect.l); const ys = g.its.map((i) => i.rect.t);
      check('4 bước xếp ngang một hàng, trái sang phải đúng thứ tự', g.its.length === 4 && xs.every((x, i) => i === 0 || x > xs[i - 1]) && Math.max(...ys) - Math.min(...ys) < 10, JSON.stringify({ xs, ys }));
      check('mỗi bước có một icon tròn (nền đặc, hình tròn, rộng >= 28px)', g.circles.length === 4 && g.circles.every((c) => c && c.bg && c.w >= 28 && /50%|9999|99px|\d{2,}px/.test(c.round)), JSON.stringify(g.circles.map((c) => c && [c.bg, c.w, c.round])));
      check('màu icon lấy đúng token: Tìm --kim-500, Lưu --kim-600, Chốt --sage-500, Vào ngân sách --son-500', g.circles.every((c, i) => c && c.bg === g.tok[STEP_TOKEN[i]]), JSON.stringify({ got: g.circles.map((c) => c && c.bg), want: STEP_TOKEN.map((k) => g.tok[k]) }));
      check('3 nét đứt nối 4 icon, màu token --son-300, nằm giữa hai icon liền kề', g.dashed.length === 3 && g.dashed.every((d) => d.color === g.tok.son300) && g.dashed.every((d, i) => d.rect.l >= g.circles[i].circleRect.r - 2 && d.rect.r <= g.circles[i + 1].circleRect.l + 2), JSON.stringify(g.dashed));
      check('tiêu đề có icon (i) bên trái, trang trí (aria-hidden)', g.hasTitleIcon && g.titleIconAria === 'true', String(g.hasTitleIcon) + ' ' + g.titleIconAria);
      check('nút "Chi tiết" nằm bên phải hàng tiêu đề, có mũi tên ">" (svg) và màu chữ --son-500', !!g.btnRect && g.btnRect.l > g.tt.r && g.chev && g.linkColor === g.linkTok, JSON.stringify([g.btnRect, g.chev, g.linkColor, g.linkTok]));
      check('khối là thẻ bo góc có viền/nền riêng (không trong suốt)', await P(S.page, (H) => { const cs = getComputedStyle(H.card()); return parseFloat(cs.borderTopLeftRadius) >= 12 && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0); }), '');
    }
    await S.ctx.close();
  });

  /* TC3: truy cập */
  await run(3, async () => {
    const S = await scenario(); await openCat(S, 'venue');
    const h = await S.page.getByRole('heading', { name: 'Cách hoạt động', exact: true }).count();
    check('tiêu đề "Cách hoạt động" là heading (getByRole heading) và chỉ có một trên màn', h === 1, 'count=' + h);
    const nb = await chiTietBtn(S.page).count();
    check('có đúng một nút (role=button) tên truy cập đúng "Chi tiết", không phải cả thẻ là một nút', nb === 1, 'count=' + nb);
    const li = await S.page.getByRole('listitem').filter({ hasText: /^(Tìm|Lưu|Chốt|Vào ngân sách)$/ }).count();
    check('4 bước là listitem trong một list, tên đọc được là chữ nhãn', li === 4, 'count=' + li);
    const t = await P(S.page, (H) => { const c = H.card(); if (!c) return null; const list = c.querySelector('ul,ol,[role="list"]');
      const svgs = [...c.querySelectorAll('svg')].map((s) => ({ aria: s.getAttribute('aria-hidden'), label: s.getAttribute('aria-label'), role: s.getAttribute('role'), inBtn: !!s.closest('button') }));
      const btn = [...c.querySelectorAll('button,[role="button"]')].find((b) => H.nameOf(b) === 'Chi tiết'); const r = btn && H.rect(btn);
      return { list: !!list, svgs, btnH: r && r.h, btnW: r && r.w, tag: btn && btn.tagName }; });
    check('các bước nằm trong ul/ol/role=list', !!t && t.list, JSON.stringify(t));
    check('mọi icon svg trong khối là trang trí (aria-hidden="true"), tên đọc chỉ có chữ', !!t && t.svgs.length >= 5 && t.svgs.every((s) => s.aria === 'true'), JSON.stringify(t && t.svgs));
    check('nút "Chi tiết" cao >= 32px và là phần tử bấm được thật (button hoặc role=button)', !!t && t.btnH >= 32 && t.btnW >= 32, JSON.stringify(t && [t.btnH, t.btnW, t.tag]));
    // bàn phím
    const btn = chiTietBtn(S.page).first(); await btn.focus();
    const focused = await S.page.evaluate(() => (document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.innerText || '').trim()));
    check('nút "Chi tiết" nhận focus bàn phím', focused === 'Chi tiết', focused);
    await S.page.keyboard.press('Enter'); await S.page.waitForTimeout(500);
    let d = await S.page.getByRole('dialog').count(); check('Enter trên "Chi tiết" mở hộp thoại (role=dialog)', d === 1, 'dialog=' + d);
    const inside = await S.page.evaluate(() => { const dl = document.querySelector('[role="dialog"],dialog'); return !!dl && dl.contains(document.activeElement); });
    check('khi mở, focus chuyển vào trong hộp thoại', inside, '');
    await S.page.keyboard.press('Escape'); await S.page.waitForTimeout(500);
    d = await S.page.getByRole('dialog').count(); check('Escape đóng hộp thoại', d === 0, 'dialog=' + d);
    const back = await S.page.evaluate(() => (document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.innerText || '').trim()));
    check('sau khi đóng, focus quay lại nút "Chi tiết"', back === 'Chi tiết', back);
    await S.page.keyboard.press('Space'); await S.page.waitForTimeout(500);
    d = await S.page.getByRole('dialog').count(); check('Space trên "Chi tiết" cũng mở hộp thoại', d === 1, 'dialog=' + d);
    await S.ctx.close();
  });

  /* TC4: 390px */
  await run(4, async () => {
    for (const [w, strict] of [[390, true], [320, false]]) {
      const S = await scenario({ viewport: { width: w, height: 844 } }); await openCat(S, 'venue');
      const m = await P(S.page, (H) => { const c = H.card(); if (!c) return null; const cr = H.rect(c);
        const labels = ['Tìm', 'Lưu', 'Chốt', 'Vào ngân sách'].map((l) => { const li = H.items(c).find((i) => H.norm(i.innerText) === l); const leaf = li && H.labelLeaf(li, l); if (!leaf) return { l, missing: true };
          const cs = getComputedStyle(leaf); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25; const r = H.rect(leaf);
          return { l, lines: Math.round(r.h / lh), r, over: leaf.scrollWidth > leaf.clientWidth + 1, clip: cs.textOverflow === 'ellipsis' && leaf.scrollWidth > leaf.clientWidth }; });
        const d = document.documentElement;
        return { cr, labels, sw: d.scrollWidth, cw: d.clientWidth, bsw: document.body.scrollWidth, cardOver: c.scrollWidth > c.clientWidth + 1, iw: innerWidth }; });
      check(`${w}px: có khối để đo`, !!m, '');
      if (m) {
        check(`${w}px: trang không cuộn ngang (html, body, thẻ)`, m.sw <= m.cw + 1 && m.bsw <= m.cw + 1 && !m.cardOver, JSON.stringify([m.sw, m.cw, m.bsw, m.cardOver]));
        check(`${w}px: thẻ nằm trọn trong màn hình`, m.cr.l >= 0 && m.cr.r <= m.iw + 0.5, JSON.stringify(m.cr));
        check(`${w}px: bốn nhãn nằm trong thẻ, không bị cắt (không tràn, không dấu ...)`, m.labels.every((x) => !x.missing && x.r.l >= m.cr.l - 0.5 && x.r.r <= m.cr.r + 0.5 && !x.over && !x.clip), JSON.stringify(m.labels));
        check(`${w}px: "Vào ngân sách" xuống tối đa 2 dòng, ba nhãn kia 1 dòng`, m.labels.every((x, i) => i === 3 ? x.lines >= 1 && x.lines <= 2 : x.lines === 1), JSON.stringify(m.labels.map((x) => [x.l, x.lines])));
        if (strict) check('390px: "Vào ngân sách" đúng 2 dòng như mẫu của Capu', m.labels[3].lines === 2, 'lines=' + m.labels[3].lines);
      }
      if (strict && SHOTS) { await S.page.screenshot({ path: path.join(SHOTS, 'budget-detail-390.png') }); }
      await S.ctx.close();
    }
    const S = await scenario({ viewport: { width: 1024, height: 900 } }); await openCat(S, 'venue');
    const m = await P(S.page, (H) => { const d = document.documentElement; const c = H.card(); return { has: !!c, over: d.scrollWidth > d.clientWidth + 1 }; });
    check('1024px: có khối và không cuộn ngang', m.has && !m.over, JSON.stringify(m)); await S.ctx.close();
  });

  /* TC5: Chi tiết mở / đóng */
  await run(5, async () => {
    const S = await scenario(); await openCat(S, 'venue');
    const hashBefore = await S.page.evaluate(() => location.hash);
    await chiTietBtn(S.page).first().click(); await S.page.waitForTimeout(500);
    const dlg = S.page.getByRole('dialog', { name: 'Cách hoạt động' });
    check('bấm "Chi tiết" mở hộp thoại tên "Cách hoạt động" (role=dialog)', await dlg.count() === 1, 'count=' + await dlg.count());
    const txt = norm(await dlg.first().innerText().catch(() => ''));
    check('hộp thoại có dòng phụ "Tìm → Lưu → Chốt → Vào ngân sách"', txt.includes('Tìm → Lưu → Chốt → Vào ngân sách'), txt.slice(0, 120));
    const pos = SHEET_TITLES.map((t) => txt.indexOf(t));
    check('hộp thoại có đủ 4 tiêu đề bước đúng chữ và đúng thứ tự', pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), JSON.stringify(pos));
    check('hộp thoại có đủ 4 đoạn giải thích đúng chữ', SHEET_DESCS.every((d) => txt.includes(d)), SHEET_DESCS.filter((d) => !txt.includes(d)).map((d) => d.slice(0, 20)).join(' | '));
    check('hộp thoại không có số tiền minh hoạ (không "<số>tr", không thanh tiến độ)', !/\d\s*tr\b/i.test(txt) && await dlg.first().getByRole('progressbar').count() === 0, txt.match(/\d\s*tr\b/i));
    check('hộp thoại có nút "Đóng" và nút "Đã hiểu"', await dlg.first().getByRole('button', { name: 'Đóng', exact: true }).count() === 1 && await dlg.first().getByRole('button', { name: 'Đã hiểu', exact: true }).count() === 1, '');
    check('mở hộp thoại không đổi địa chỉ (không rời màn hạng mục)', await S.page.evaluate(() => location.hash) === hashBefore, hashBefore);
    const vh = await S.page.evaluate(() => innerHeight); const dr = await dlg.first().boundingBox();
    check('hộp thoại nằm trong khung nhìn 390x844, không tràn ngang', !!dr && dr.x >= -0.5 && dr.x + dr.width <= 390.5 && dr.y >= 0 && dr.y + dr.height <= vh + 0.5, JSON.stringify(dr));
    if (SHOTS) await S.page.screenshot({ path: path.join(SHOTS, 'budget-detail-390-chi-tiet.png') });
    const closed = async () => (await S.page.getByRole('dialog').count()) === 0;
    const reopen = async () => { await chiTietBtn(S.page).first().click(); await S.page.waitForTimeout(450); };
    await dlg.first().getByRole('button', { name: 'Đóng', exact: true }).click(); await S.page.waitForTimeout(450);
    check('nút "Đóng" đóng hộp thoại, màn hạng mục còn nguyên', await closed() && await P(S.page, (H) => !!H.heading() && !!H.card()), '');
    await reopen(); await S.page.getByRole('dialog').getByRole('button', { name: 'Đã hiểu', exact: true }).click(); await S.page.waitForTimeout(450);
    check('nút "Đã hiểu" đóng hộp thoại', await closed(), '');
    await reopen(); await S.page.mouse.click(195, 20); await S.page.waitForTimeout(450);
    check('chạm vùng tối phía trên hộp thoại đóng hộp thoại', await closed(), '');
    await reopen(); await S.page.keyboard.press('Escape'); await S.page.waitForTimeout(450);
    check('Escape đóng hộp thoại', await closed(), '');
    await reopen(); const nav = await S.page.evaluate(() => history.length); await S.page.goBack(); await S.page.waitForTimeout(600);
    check('nút Back của trình duyệt chỉ đóng hộp thoại: vẫn ở màn hạng mục cũ', await closed() && await S.page.evaluate(() => location.hash) === hashBefore && await P(S.page, (H) => !!H.heading()), await S.page.evaluate(() => location.hash));
    check('đóng bằng chữ rồi mở lại vẫn mở được (lần thứ năm)', (await reopen(), await S.page.getByRole('dialog').count()) === 1, '');
    check('không có yêu cầu mạng ra ngoài (trừ phông chữ có sẵn của app), không có lỗi trang', S.external.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)).length === 0 && S.errors.length === 0, JSON.stringify([S.external.map((u) => u.slice(0, 60)), S.errors]));
    await S.ctx.close();
  });

  /* TC6: không đổi hành vi ngân sách */
  await run(6, async () => {
    for (const id of ['venue', 'photography']) {
      const S = await scenario(); await openCat(S, id);
      const before = await S.page.evaluate(() => document.body.innerText); const putsBefore = S.puts.length, ngBefore = S.nonGet.length;
      await chiTietBtn(S.page).first().click(); await S.page.waitForTimeout(450);
      await S.page.getByRole('dialog').getByRole('button', { name: 'Đã hiểu', exact: true }).click(); await S.page.waitForTimeout(1500);
      const after = await S.page.evaluate(() => document.body.innerText);
      check(`${id}: mở rồi đóng "Chi tiết" không đổi chữ nào trên màn (số dự toán, danh sách vendor, trạng thái)`, norm(before) === norm(after), norm(before).slice(0, 80) + ' ... ' + norm(after).slice(0, 80));
      check(`${id}: không có PUT/POST nào ra API khi mở màn và mở/đóng "Chi tiết"`, S.puts.length === putsBefore && S.nonGet.length === ngBefore && S.puts.length === 0, JSON.stringify([S.puts.length, S.nonGet]));
      const t = after;
      check(`${id}: các thành phần cũ vẫn còn: "Dự toán", "Ngân sách cưới", "Vendor đã lưu"`, /Dự toán/i.test(t) && /Ngân sách cưới/i.test(t) && /Vendor đã lưu/i.test(t), t.slice(0, 120));
      await S.ctx.close();
    }
  });

  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
}
main().catch((e) => { console.log('FAIL eval không chạy được: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
