// Helper dùng chung dựng vite dev cho eval front (T-053/T-071, ADR-024): cổng listen(0), nonce thật, nhóm tiến trình riêng, dọn khi thoát/tín hiệu.
const fs = require('fs'), path = require('path'), net = require('net'), http = require('http'), cp = require('child_process'), crypto = require('crypto');
const live = new Set();
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const get = (url) => new Promise((res) => { const q = http.get(url, { timeout: 2000 }, r => { let b = ''; r.setEncoding('utf8'); r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b })); }); q.on('error', () => res(null)); q.on('timeout', () => { q.destroy(); res(null); }); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function killGroup(child) { try { if (child && child.pid) process.kill(-child.pid, 'SIGKILL'); } catch (e) {} }
function cleanupSync() { for (const h of [...live]) { killGroup(h.child); for (const f of h.written) { try { fs.unlinkSync(path.join(h.repo, f)); } catch (e) {} } live.delete(h); } }
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanupSync(); process.exit(sig === 'SIGINT' ? 130 : sig === 'SIGTERM' ? 143 : 129); });
process.on('exit', cleanupSync);

async function attempt(repo, files, deadlineMs) {
  const nonce = crypto.randomBytes(8).toString('hex'), nf = '__nonce-' + nonce + '.txt';
  const h = { repo, written: [], child: null }; live.add(h);
  const all = Object.assign({}, files, { [nf]: nonce });
  for (const [f, c] of Object.entries(all)) { fs.writeFileSync(path.join(repo, f), c); h.written.push(f); }
  const port = await freePort();
  let exited = false;
  h.child = cp.spawn(path.join(repo, 'node_modules', '.bin', 'vite'), ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: repo, detached: true, stdio: 'ignore', env: process.env });
  h.child.on('exit', () => { exited = true; });
  const stop = async () => {
    if (!live.has(h)) return;
    killGroup(h.child);
    if (!exited) await Promise.race([new Promise(r => h.child.once('exit', r)), sleep(3000)]);
    for (const f of h.written) { try { fs.unlinkSync(path.join(repo, f)); } catch (e) {} }
    live.delete(h);
  };
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    if (exited) { await stop(); throw new Error('vite thoát sớm (cổng ' + port + ')'); }
    const r = await get(`http://127.0.0.1:${port}/${nf}`);
    if (r && r.status === 200 && r.body === nonce && !exited) return { port, url: 'http://127.0.0.1:' + port, stop };
    await sleep(250);
  }
  await stop(); throw new Error('nonce không khớp / hết hạn (cổng ' + port + ')');
}
async function startViteDev({ repo, files = {} }) {
  const total = Date.now() + 60000; let last;
  for (let i = 0; i < 3 && Date.now() < total; i++) {
    try { return await attempt(repo, files, Math.min(18000, total - Date.now())); } catch (e) { last = e; }
  }
  throw new Error('startViteDev thất bại sau 3 lần: ' + (last && last.message));
}
module.exports = { startViteDev };
