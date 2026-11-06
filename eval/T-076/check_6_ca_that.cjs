// T-076 ca thật: xuất dữ liệu từ sổ cái THẬT của tohong-hq (giả định mọi PR đã merge), nạp vào dashboard thật. Việc xong bậc B/C không được đếm; khối Capu = đúng số việc đang escalated trong board/;
// mỗi việc escalated có link tới file inbox/capu/ có thật (nếu có file T-xxx-*.md), hoặc thư mục. Thêm phép thử "mọi PR mở" để thấy việc B/C quay lại và có link PR.
// Chạy: cd /home/user/tohong-hq && node eval/T-076/check_6_ca_that.cjs
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const L = require('./lib.cjs'); const R = L.reporter();
const ROOT = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 't076-'));
const exportWith = (name, stateOf) => {
  // lấy mọi URL PR có trong sự kiện handoff + handoffs/*.md của sổ cái thật
  const text = fs.readFileSync(path.join(ROOT, 'ledger/events.jsonl'), 'utf8') + fs.readdirSync(path.join(ROOT, 'handoffs')).map(f => fs.readFileSync(path.join(ROOT, 'handoffs', f), 'utf8')).join('\n');
  const st = {}; for (const m of text.matchAll(/https:\/\/github\.com\/phungrk\/([\w.-]+)\/pull\/(\d+)/g)) st[`phungrk/${m[1]}#${m[2]}`] = stateOf;
  const f = path.join(tmp, name + '-state.json'); fs.writeFileSync(f, JSON.stringify(st)); const out = path.join(tmp, name);
  const r = cp.spawnSync('python3', ['scripts/export_dashboard.py', '--public', '--out', out, '--pr-state-file', f], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PR_READ_TOKEN: '' } });
  if (r.status !== 0) throw new Error('exporter lỗi: ' + (r.stderr || '').split('\n').filter(Boolean).pop());
  return { data: JSON.parse(fs.readFileSync(path.join(out, 'dashboard.json'), 'utf8')), nPR: Object.keys(st).length };
};
const escalatedOnBoard = () => fs.readdirSync(path.join(ROOT, 'board')).filter(f => /^T-\d+\.md$/.test(f)).filter(f => /^state:\s*escalated\s*$/m.test(fs.readFileSync(path.join(ROOT, 'board', f), 'utf8'))).map(f => f.replace('.md', ''));
(async () => {
  await L.start();
  const esc = escalatedOnBoard();
  const merged = exportWith('merged', 'merged');
  R.ok(Array.isArray(merged.data.capu_queue), 'dashboard.json thật có mảng capu_queue');
  const q = merged.data.capu_queue || [];
  R.ok(q.every(e => e.kind === 'escalated'), 'mọi PR merged: không việc bậc B/C nào trong capu_queue (thấy ' + q.filter(e => e.kind !== 'escalated').map(e => e.task) + ')');
  R.ok(q.map(e => e.task).sort().join() === esc.sort().join(), 'capu_queue = đúng các việc escalated trên board: [' + esc + '], thấy [' + q.map(e => e.task) + ']');
  for (const e of q) { const files = fs.readdirSync(path.join(ROOT, 'inbox/capu')).filter(f => f.startsWith(e.task + '-') && f.endsWith('.md'));
    const u = e.links[0] && e.links[0].url, want = files.map(f => `https://github.com/phungrk/tohong-hq/blob/main/inbox/capu/${f}`);
    R.ok(files.length ? want.includes(u) : u === 'https://github.com/phungrk/tohong-hq/tree/main/inbox/capu', e.task + ': link Decision Request trỏ file có thật trong inbox/capu (' + u + ')'); }
  const o = await L.open(merged.data, { width: 390, height: 844 }, { touch: true });
  R.ok(await L.nodeCount(o) === String(esc.length), 'trang thật 390px: số trên khối Capu = ' + esc.length + ', thấy ' + await L.nodeCount(o));
  await L.clickNode(o); const rs = await L.rows(o);
  R.ok(rs.length === esc.length && rs.map(r => r.task).sort().join() === esc.sort().join(), 'modal liệt kê đúng ' + esc.length + ' việc leo thang');
  R.ok(rs.every(r => r.links.length === 1 && r.links[0].href.startsWith('https://github.com/phungrk/tohong-hq/')), 'mỗi dòng có đúng một link tới tohong-hq');
  if (!esc.length) R.ok(await o.page.locator('#capu-modal [data-capu-empty]').count() === 1, 'không có việc escalated: modal ghi "Không có việc nào chờ anh"');
  await o.ctx.close();
  // đối chứng: mọi PR mở -> việc B/C xong gần đây phải quay lại, có link PR
  const open = exportWith('open', 'open');
  const bc = (open.data.capu_queue || []).filter(e => e.kind !== 'escalated');
  const want = open.data.tasks.filter(t => t.owner === 'engineering' && t.state === 'done' && ['B', 'C'].includes(t.tier) && t.hours_since_update < 24 * 30);
  R.ok(open.nPR > 0 && bc.every(e => e.links.length && e.links.every(l => l.pr_state === 'open' && /\/pull\/\d+$/.test(l.url))), 'đối chứng mọi PR mở: các dòng B/C có link PR mở (' + bc.length + ' dòng, ' + open.nPR + ' PR trong sổ cái)');
  R.ok(bc.length > 0 && bc.length <= want.length, 'đối chứng: việc B/C với PR mở xuất hiện (' + bc.length + '), không vượt số việc B/C xong trong 30 ngày (' + want.length + ')');
  await L.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
