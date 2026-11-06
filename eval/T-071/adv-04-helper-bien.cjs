#!/usr/bin/env node
// T-071 adv-04 (adversary, tầng 3): biên của eval/_lib/vite_dev.cjs theo spec T-053 "Sản phẩm của việc".
//  (a) hai startViteDev song song trong cùng tiến trình, cùng repo: hai cổng khác nhau, mỗi bên phục vụ ĐÚNG file của mình; stop() từng bên không làm hỏng bên kia.
//  (b) stop() gọi lặp lại / gọi đồng thời hai lần: không lỗi (spec: "gọi lặp lại không lỗi").
//  (c) files có một mục ghi không được (thư mục cha không tồn tại): Promise reject bằng Error và ĐÃ DỌN SẠCH ngay lúc reject (spec: "reject bằng Error (đã dọn sạch)"; "xoá mọi file trong files (cả khi lỗi)") — không để file đã ghi nằm chờ tới lúc tiến trình thoát.
//  (d) repo chưa cài node_modules (vd worktree mới checkout nhánh PR): không có node_modules/.bin/vite -> Promise reject bằng Error (FAIL rõ ràng), KHÔNG làm sập tiến trình bằng 'error' không ai bắt, file trong files đã xoá lúc reject.
// Chạy: node eval/T-071/adv-04-helper-bien.cjs [repo-front]. In PASS/FAIL; mã thoát 0/1.
const fs = require('fs'), path = require('path'), http = require('http');
const { startViteDev } = require('../_lib/vite_dev.cjs');
const REPO = path.resolve(process.argv[2] || process.env.FRONT || '/home/user/tohong-front');
const errs = [];
const get = (u) => new Promise(r => http.get(u, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => r({ st: s.statusCode, b })); }).on('error', () => r(null)));
const tag = 'adv071' + process.pid;
(async () => {
  const fa = `__${tag}a.txt`, fb = `__${tag}b.txt`;
  let A, B;
  try {
    [A, B] = await Promise.all([startViteDev({ repo: REPO, files: { [fa]: 'AAA' } }), startViteDev({ repo: REPO, files: { [fb]: 'BBB' } })]);
    if (A.port === B.port) errs.push('(a) hai helper song song cùng cổng ' + A.port);
    const ra = await get(A.url + '/' + fa), rb = await get(B.url + '/' + fb);
    if (!ra || ra.b !== 'AAA') errs.push('(a) A không phục vụ đúng file của A');
    if (!rb || rb.b !== 'BBB') errs.push('(a) B không phục vụ đúng file của B');
    await A.stop();
    const rb2 = await get(B.url + '/' + fb);
    if (!rb2 || rb2.b !== 'BBB') errs.push('(a) stop() của A làm hỏng B');
    if (fs.existsSync(path.join(REPO, fa))) errs.push('(a) stop() của A không xoá file của A');
    try { await Promise.all([B.stop(), B.stop()]); await B.stop(); await A.stop(); } catch (e) { errs.push('(b) stop() lặp/đồng thời ném lỗi: ' + e.message); }
    if (fs.existsSync(path.join(REPO, fb))) errs.push('(b) stop() của B không xoá file của B');
  } catch (e) { errs.push('(a) lỗi: ' + e.message); try { A && await A.stop(); B && await B.stop(); } catch (_) {} }
  // (c)
  const ok1 = `__${tag}c.txt`, badf = `__${tag}khong-co-thu-muc/x.txt`;
  let rejected = false, isErr = false;
  try { const d = await startViteDev({ repo: REPO, files: { [ok1]: 'C', [badf]: 'X' } }); await d.stop(); }
  catch (e) { rejected = true; isErr = e instanceof Error; }
  if (!rejected) errs.push('(c) files ghi không được mà startViteDev không reject');
  else if (!isErr) errs.push('(c) reject không bằng Error');
  const left = fs.readdirSync(REPO).filter(f => f.startsWith(`__${tag}`));
  if (left.length) errs.push('(c) reject rồi mà còn file trong repo: ' + left.slice(0, 3).join(', '));
  for (const f of fs.readdirSync(REPO)) if (f.startsWith(`__${tag}`)) { try { fs.unlinkSync(path.join(REPO, f)); } catch (e) {} }
  // (d)
  const os = require('os');
  const bare = fs.mkdtempSync(path.join(process.env.EVAL_TMPDIR || os.tmpdir(), 'adv071-bare-'));
  process.on('uncaughtException', (e) => { errs.push('(d) repo không có node_modules làm sập tiến trình (\'error\' của tiến trình con không ai bắt): ' + String(e.message).slice(0, 60)); console.log('FAIL ' + errs.join(' | ')); try { fs.rmSync(bare, { recursive: true, force: true }); } catch (_) {} process.stdout.write('', () => process.exit(1)); });
  let rj = null;
  try { const d = await startViteDev({ repo: bare, files: { '__adv071d.html': 'D' } }); await d.stop(); } catch (e) { rj = e; }
  if (!rj) errs.push('(d) repo không có vite mà startViteDev không reject');
  else if (!(rj instanceof Error)) errs.push('(d) reject không bằng Error');
  if (fs.existsSync(path.join(bare, '__adv071d.html'))) errs.push('(d) reject rồi mà file thử còn trong repo');
  fs.rmSync(bare, { recursive: true, force: true });
  if (errs.length) console.log('FAIL ' + errs.join(' | ')); else console.log('PASS helper: song song hai cổng riêng, stop lặp không lỗi, lỗi ghi file reject Error và dọn sạch ngay');
  process.stdout.write('', () => process.exit(errs.length ? 1 : 0));
})();
