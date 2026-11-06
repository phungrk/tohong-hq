// T-081 ca thật: ảnh chụp sổ cái 2026-11-06 cố định (eval/T-076/fixtures/ledger-2026-11-06; T-072 có issue 16, T-074 có issue 21, T-016 và T-070 không có), TOHONG_NOW=2026-11-06T12:00, --public, không token, không mạng.
// Kỳ vọng: queue vẫn T-016,T-070,T-072,T-074 (issue không đổi tập); T-072 links [DR, Issue #16], T-074 [DR, Issue #21], T-016/T-070 chỉ DR; trên trang 390px T-072 và T-074 có gợi ý /ok, T-016 và T-070 không có link issue lẫn gợi ý.
// Cộng kiểm nhẹ sổ cái thật: link issue trong capu_queue khi và chỉ khi board có `issue` là số nguyên dương, số trong URL bằng số trên board.
// Chạy: cd /home/user/tohong-hq && node eval/T-081/check_3_ca_that.cjs
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const L = require('../T-076/lib.cjs'); const R = L.reporter();
const ROOT = path.resolve(__dirname, '..', '..'), FIX = path.join(ROOT, 'eval/T-076/fixtures/ledger-2026-11-06');
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 't081-'));
const exp = (root, name, now) => { const out = path.join(tmp, name); const env = { ...process.env, TOHONG_ROOT: root }; delete env.PR_READ_TOKEN; if (now) env.TOHONG_NOW = now;
  const r = cp.spawnSync('python3', [path.join(ROOT, 'scripts/export_dashboard.py'), '--public', '--out', out], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error('exporter lỗi: ' + (r.stderr || '').split('\n').filter(Boolean).pop()); return JSON.parse(fs.readFileSync(path.join(out, 'dashboard.json'), 'utf8')); };
const IS = n => `https://github.com/phungrk/tohong-hq/issues/${n}`, DRB = 'https://github.com/phungrk/tohong-hq/blob/main/inbox/capu/';
L.dumpCases('check_3', [{ name: 'ảnh chụp', fixture: FIX, now: '2026-11-06T12:00', expect: { queue: 'T-016,T-070,T-072,T-074', issue: { 'T-072': 16, 'T-074': 21 } } }]);
(async () => {
  await L.start();
  const d = exp(FIX, 'fix', '2026-11-06T12:00'), q = d.capu_queue || [], by = Object.fromEntries(q.map(e => [e.task, e]));
  R.ok(q.map(e => e.task).sort().join() === 'T-016,T-070,T-072,T-074', 'capu_queue = T-016,T-070,T-072,T-074 (issue không đổi tập), thấy [' + q.map(e => e.task) + ']');
  const urls = t => ((by[t] || { links: [] }).links).map(l => l.url);
  for (const [t, n] of [['T-072', 16], ['T-074', 21]]) { const u = urls(t); R.ok(u.length === 2 && u[0].startsWith(DRB + t + '-') && u[1] === IS(n) && by[t].links[1].label === 'Issue #' + n, t + ': links = [Decision Request, Issue #' + n + '], thấy ' + JSON.stringify(u)); }
  for (const t of ['T-016', 'T-070']) { const u = urls(t); R.ok(u.length === 1 && u[0].startsWith(DRB + t + '-'), t + ': không issue, chỉ link Decision Request'); }
  const o = await L.open(d, { width: 390, height: 844 }, { touch: true }); await L.clickNode(o);
  const rs = Object.fromEntries((await L.rows(o)).map(r => [r.task, r]));
  const hints = await o.page.$$eval('#capu-modal [data-capu-row]', rs => Object.fromEntries(rs.map(r => [r.getAttribute('data-task'), r.querySelectorAll('[data-capu-ok-hint]').length])));
  for (const [t, n] of [['T-072', 16], ['T-074', 21]]) R.ok(rs[t] && rs[t].links.some(l => l.href === IS(n) && l.target === '_blank' && /noopener/.test(l.rel)) && hints[t] === 1, t + ': trên trang có link Issue #' + n + ' (tab mới, noopener) và đúng một gợi ý /ok');
  for (const t of ['T-016', 'T-070']) R.ok(rs[t] && !rs[t].links.some(l => /\/issues\//.test(l.href)) && hints[t] === 0, t + ': không link issue, không gợi ý /ok');
  await o.ctx.close();
  // sổ cái thật: issue trên board <-> link issue trong capu_queue
  const real = exp(ROOT, 'real'); const board = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'board'))) { const m = /^issue:\s*"?([^"\n]*)"?\s*$/m.exec(fs.readFileSync(path.join(ROOT, 'board', f), 'utf8')); board[f.replace(/\.md$/, '')] = m ? m[1].trim() : ''; }
  const bad = [];
  for (const e of real.capu_queue || []) { const iss = e.links.filter(l => /\/issues\//.test(l.url)), b = board[e.task] || '', valid = /^[1-9][0-9]*$/.test(b);
    if (valid && !(iss.length === 1 && iss[0].url === IS(b) && iss[0].label === 'Issue #' + b)) bad.push(e.task + ' thiếu/sai link issue ' + b);
    if (!valid && iss.length) bad.push(e.task + ' có link issue nhưng board issue=' + JSON.stringify(b)); }
  R.ok(Array.isArray(real.capu_queue) && !bad.length, 'sổ cái thật: link issue khi và chỉ khi board có issue số nguyên dương, số khớp: ' + (bad.join('; ') || 'ổn'));
  R.ok(real.tasks.every(t => !('issue' in t)), 'sổ cái thật --public: tasks[] không có trường issue');
  await L.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
