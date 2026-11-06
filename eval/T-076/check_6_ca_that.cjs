// T-076 ca thật: ảnh chụp sổ cái 2026-11-06 cố định (eval/T-076/fixtures/ledger-2026-11-06, kèm sự kiện `merged` mô phỏng sau backfill), TOHONG_NOW=2026-11-06T12:00, không token, không mạng.
// Kỳ vọng hôm đó: đúng bốn việc T-016 (bị chặn chờ Capu), T-070 (Decision Request, việc đã done), T-072, T-074 (leo thang); T-015 (đã decided), T-021 (Capu huỷ), T-052/055/057/067/068 (PR đã merged) không có.
// Cộng kiểm nhẹ trên sổ cái thật: chỉ về hình dạng, không ngoại lệ, không phụ thuộc thời điểm.
// Chạy: cd /home/user/tohong-hq && node eval/T-076/check_6_ca_that.cjs
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const L = require('./lib.cjs'); const R = L.reporter();
const ROOT = path.resolve(__dirname, '..', '..'), FIX = path.join(__dirname, 'fixtures', 'ledger-2026-11-06');
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 't076-'));
const exp = (root, name, now) => {
  const out = path.join(tmp, name);
  const env = { ...process.env, TOHONG_ROOT: root }; delete env.PR_READ_TOKEN; if (now) env.TOHONG_NOW = now;
  const r = cp.spawnSync('python3', [path.join(ROOT, 'scripts/export_dashboard.py'), '--public', '--out', out], { encoding: 'utf8', env });
  if (r.status !== 0) throw new Error('exporter lỗi: ' + (r.stderr || '').split('\n').filter(Boolean).pop());
  return JSON.parse(fs.readFileSync(path.join(out, 'dashboard.json'), 'utf8'));
};
(async () => {
  await L.start();
  const d = exp(FIX, 'fix', '2026-11-06T12:00');
  const q = d.capu_queue || [], by = Object.fromEntries(q.map(e => [e.task, e]));
  R.ok(Array.isArray(d.capu_queue), 'dashboard.json từ ảnh chụp có mảng capu_queue');
  R.ok(q.map(e => e.task).sort().join() === 'T-016,T-070,T-072,T-074', 'capu_queue = T-016,T-070,T-072,T-074, thấy [' + q.map(e => e.task) + ']');
  const kinds = Object.fromEntries(q.map(e => [e.task, e.kind]));
  R.ok(kinds['T-072'] === 'escalated' && kinds['T-074'] === 'escalated' && kinds['T-070'] === 'decision' && kinds['T-016'] === 'blocked', 'loại: T-072/T-074 escalated, T-070 decision, T-016 blocked; thấy ' + JSON.stringify(kinds));
  for (const e of q) { const f = fs.readdirSync(path.join(FIX, 'inbox/capu')).filter(x => x.startsWith(e.task + '-') && x.endsWith('.md'));
    R.ok(e.links.length === 1 && f.map(x => 'https://github.com/phungrk/tohong-hq/blob/main/inbox/capu/' + x).includes(e.links[0].url), e.task + ': một link tới file Decision Request có thật (' + (e.links[0] && e.links[0].url) + ')'); }
  R.ok(by['T-070'] && by['T-070'].decide_by === '2026-11-10' && by['T-016'] && by['T-016'].decide_by === '2026-10-31', 'hạn quyết đọc từ decide-by: T-070 2026-11-10, T-016 2026-10-31');
  R.ok(!q.some(e => e.links.some(l => /\/pull\//.test(l.url))), 'không PR nào hiện (mọi PR đã có sự kiện merged)');
  const o = await L.open(d, { width: 390, height: 844 }, { touch: true });
  R.ok(await L.nodeCount(o) === '4', 'trang 390px: số trên khối Capu = 4 (không phải 7), thấy ' + await L.nodeCount(o));
  await L.clickNode(o); const rs = await L.rows(o);
  R.ok(rs.map(r => r.task).join() === 'T-072,T-074,T-070,T-016', 'modal: T-072,T-074 (leo thang), T-070 (quyết), T-016 (chặn); thấy ' + rs.map(r => r.task));
  R.ok(rs.every(r => r.links.length === 1 && r.links[0].href.startsWith('https://github.com/phungrk/tohong-hq/blob/main/inbox/capu/')), 'mỗi dòng đúng một link tới Decision Request');
  await o.ctx.close();
  // đối chứng: bỏ sự kiện merged -> các việc B/C quay lại (chứng tỏ sự kiện merged là thứ làm chúng biến mất)
  const bare = path.join(tmp, 'bare'); fs.cpSync(FIX, bare, { recursive: true });
  const lf = path.join(bare, 'ledger/events.jsonl'); fs.writeFileSync(lf, fs.readFileSync(lf, 'utf8').split('\n').filter(l => l && JSON.parse(l).event !== 'merged').join('\n') + '\n');
  const d2 = exp(bare, 'bare', '2026-11-06T12:00'), t2 = (d2.capu_queue || []).map(e => e.task);
  R.ok(['T-052', 'T-055', 'T-057', 'T-067', 'T-068'].every(t => t2.includes(t)), 'đối chứng không có sự kiện merged: T-052,T-055,T-057,T-067,T-068 quay lại danh sách; thấy [' + t2 + ']');
  // kiểm nhẹ trên sổ cái thật: chạy được, hình dạng đúng, mọi việc trong queue có thật trên board
  const real = exp(ROOT, 'real');
  const ids = new Set(real.tasks.map(t => t.id));
  R.ok(Array.isArray(real.capu_queue) && real.capu_queue.every(e => ids.has(e.task) && ['escalated', 'decision', 'blocked', 'diff-b', 'merge-c'].includes(e.kind) && Array.isArray(e.links) && e.links.every(l => /^https:\/\/github\.com\/phungrk\//.test(l.url))), 'sổ cái thật: capu_queue đúng hình dạng, mọi mã việc có trên board');
  R.ok(real.tasks.filter(t => t.state === 'escalated').every(t => real.capu_queue.some(e => e.task === t.id)), 'sổ cái thật: mọi việc đang escalated đều có trong capu_queue');
  await L.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
