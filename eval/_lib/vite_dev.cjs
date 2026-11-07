// (T-098/T-077) Mỗi lần chạy có cacheDir vite riêng: đúng một mục tohong-vite-* ngay dưới os.tmpdir(), xoá khi stop()/thoát/tín hiệu; không ghi node_modules/.vite chung.
// Helper dùng chung dựng vite dev cho eval front (T-053/T-071, ADR-024): cổng listen(0), nonce thật, nhóm tiến trình riêng, dọn khi thoát/tín hiệu.
const fs = require('fs'), path = require('path'), net = require('net'), http = require('http'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const live = new Set();
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const get = (url) => new Promise((res) => { const q = http.get(url, { timeout: 2000 }, r => { let b = ''; r.setEncoding('utf8'); r.on('data', d => b += d); r.on('end', () => res({ status: r.statusCode, body: b })); }); q.on('error', () => res(null)); q.on('timeout', () => { q.destroy(); res(null); }); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function killGroup(child) { try { if (child && child.pid) process.kill(-child.pid, 'SIGKILL'); } catch (e) {} }
const rmCache = (d) => { if (d) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch (e) {} } };
function cleanupSync() { for (const h of [...live]) { killGroup(h.child); rmCache(h.cacheDir); for (const f of h.written) { try { fs.unlinkSync(path.join(h.repo, f)); } catch (e) {} } live.delete(h); } }
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanupSync(); process.exit(sig === 'SIGINT' ? 130 : sig === 'SIGTERM' ? 143 : 129); });
process.on('exit', cleanupSync);

// Danh sách + thứ tự file cấu hình lấy từ DEFAULT_CONFIG_FILES của vite đã cài (vite tự chọn file đầu tiên tồn tại); không đọc được thì dùng bản vite 8.
function viteConfigNames(repo) {
  const fallback = ['vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.cjs', 'vite.config.mts', 'vite.config.cts'];
  try {
    const dist = path.join(repo, 'node_modules', 'vite', 'dist'), stack = [dist];
    while (stack.length) {
      const d = stack.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) { stack.push(f); continue; }
        if (!/\.m?js$/.test(e.name)) continue;
        const m = /DEFAULT_CONFIG_FILES\s*=\s*\[([^\]]*)\]/.exec(fs.readFileSync(f, 'utf8'));
        if (m) { const l = [...m[1].matchAll(/["']([^"']+)["']/g)].map(x => x[1]); if (l.length) return l; }
      }
    }
  } catch (e) {}
  return fallback;
}
async function attempt(repo, files, deadlineMs) {
  const nonce = crypto.randomBytes(8).toString('hex'), nf = '__nonce-' + nonce + '.txt';
  const h = { repo, written: [], child: null, cacheDir: null }; live.add(h);
  const all = Object.assign({}, files, { [nf]: nonce });
  const wipe = () => { rmCache(h.cacheDir); for (const f of h.written) { try { fs.unlinkSync(path.join(repo, f)); } catch (e) {} } };
  let cfgArg = [];
  try {
    h.cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tohong-vite-'));
    const base = viteConfigNames(repo).find(f => fs.existsSync(path.join(repo, f)));
    const cf = '__vite-cfg-' + nonce + '.mjs';
    if (base) {
      all[cf] = "import { mergeConfig, defineConfig } from 'vite';\nimport base from './" + base + "';\n" +
        "export default defineConfig(async (env) => mergeConfig(typeof base === 'function' ? await base(env) : await base, { cacheDir: " + JSON.stringify(h.cacheDir) + " }));\n";
    } else {
      // Không có config gốc: vẫn phải ép cacheDir riêng, nếu không vite ghi vào node_modules/.vite chung.
      all[cf] = "export default { cacheDir: " + JSON.stringify(h.cacheDir) + " };\n";
    }
    cfgArg = ['--config', cf];
  } catch (e) { wipe(); live.delete(h); throw new Error('không tạo được cacheDir riêng: ' + e.message); }
  try { for (const [f, c] of Object.entries(all)) { h.written.push(f); fs.writeFileSync(path.join(repo, f), c); } }
  catch (e) { wipe(); live.delete(h); throw new Error('không ghi được file thử "' + h.written[h.written.length - 1] + '": ' + e.message); }
  const port = await freePort();
  let exited = false, spawnErr = null;
  h.child = cp.spawn(path.join(repo, 'node_modules', '.bin', 'vite'), [...cfgArg, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: repo, detached: true, stdio: 'ignore', env: process.env });
  h.child.on('exit', () => { exited = true; });
  h.child.on('error', (e) => { spawnErr = e; exited = true; });
  const stop = async () => {
    if (!live.has(h)) return;
    killGroup(h.child);
    if (!exited) await Promise.race([new Promise(r => h.child.once('exit', r)), sleep(3000)]);
    for (const f of h.written) { try { fs.unlinkSync(path.join(repo, f)); } catch (e) {} }
    rmCache(h.cacheDir);
    live.delete(h);
  };
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    if (spawnErr) { killGroup(h.child); wipe(); live.delete(h); const e = new Error('không chạy được vite (' + spawnErr.code + '): ' + spawnErr.message + '; cần cài node_modules trong ' + repo); e.fatal = true; throw e; }
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
    try { return await attempt(repo, files, Math.min(18000, total - Date.now())); } catch (e) { if (e.fatal) throw e; last = e; }
  }
  throw new Error('startViteDev thất bại sau 3 lần: ' + (last && last.message));
}
module.exports = { startViteDev };
