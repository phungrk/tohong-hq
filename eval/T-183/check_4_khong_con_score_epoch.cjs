/* T-183 tiêu chí 4 (tohong-front). Mã chết scoreEpoch đã bỏ hẳn: không còn file src/scoreEpoch.js, test của nó, lệnh bump/đăng ký, hay chữ "score-epoch" trong lệnh npm;
 * và hai test còn sống (ghép dự toán sau lỗi, nhãn số đã lưu) vẫn chạy xanh bằng `node --test`. Quét src, scripts, package.json, docs, index.html (bỏ node_modules, dist, .git).
 * Chạy từ gốc tohong-hq: node eval/T-183/check_4_khong_con_score_epoch.cjs [--repo <tohong-front>]   (hoặc TOHONG_FRONT_REPO) */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const i = process.argv.indexOf('--repo');
const REPO = path.resolve((i > 0 && process.argv[i + 1]) || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
const out = (m, c) => { console.log(m); process.exit(c); };
if (!fs.existsSync(path.join(REPO, 'package.json'))) out('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)', 2);
const RE = /scoreEpoch|ScoreEpoch|score[-_ ]epoch|profilePatchTouchesScore|budgetScoreSig|knownBudgetSig/i;
const bad = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
  const f = path.join(d, e.name);
  if (e.isDirectory()) { walk(f); continue; }
  if (RE.test(e.name)) bad.push(`tên file còn: ${path.relative(REPO, f)}`);
  if (!/\.(js|jsx|mjs|cjs|json|md|html|css)$/.test(e.name) || e.name === 'package-lock.json') continue;
  const t = fs.readFileSync(f, 'utf8').split('\n');
  t.forEach((l, k) => { if (RE.test(l) && bad.length < 8) bad.push(`${path.relative(REPO, f)}:${k + 1}: ${l.trim().slice(0, 100)}`); });
} };
for (const d of ['src', 'scripts', 'docs']) if (fs.existsSync(path.join(REPO, d))) walk(path.join(REPO, d));
for (const f of ['package.json', 'index.html']) if (fs.existsSync(path.join(REPO, f))) fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').forEach((l, k) => { if (RE.test(l)) bad.push(`${f}:${k + 1}: ${l.trim().slice(0, 100)}`); });
if (bad.length) out('FAIL còn tham chiếu scoreEpoch:\n' + bad.slice(0, 8).join('\n'), 1);
const r = cp.spawnSync('node', ['--test', 'scripts/test-merge-budget.mjs', 'scripts/test-saved-budget-sig.mjs'], { cwd: REPO, encoding: 'utf8' });
if (r.status !== 0) out('FAIL hai test còn sống (merge-budget, saved-budget-sig) không xanh:\n' + (r.stdout + r.stderr).split('\n').slice(-12).join('\n'), 1);
out('PASS', 0);
