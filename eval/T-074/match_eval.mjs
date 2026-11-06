#!/usr/bin/env node
// T-074 · MỘT LỆNH: in tỉ lệ trùng top 5 theo hạng mục giữa matcher thật (pool thật) và nhãn người chấm mù.
//   node eval/T-074/match_eval.mjs [--labels <file>] [--baseline <file>] [--save-baseline] [--out <thư mục ghi t074-unlabeled.json, mặc định thư mục tạm>] [--validate <file>] [--print-threshold]
// Dòng cuối luôn là "PASS ..." hoặc "FAIL <lý do>"; mã thoát 0 chỉ khi PASS. Không sửa matcher, không sửa nhãn.
// Chưa có baseline: chỉ đo (PASS ghi rõ "baseline lần đầu"). Có baseline: tụt quá 10 điểm ở hạng mục nào là FAIL.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, sha } from './lib/candidates.mjs';
import { evaluate, validateLabels, MAX_DROP_PT, COVERAGE_PCT, compareBaseline, MIN_GRADERS } from './lib/metric.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const finish = (line, code) => { console.log(line); process.exit(code); };

if (args.includes('--print-threshold')) finish(`${MAX_DROP_PT} ${COVERAGE_PCT}`, 0);

const profilesRaw = fs.readFileSync(path.join(HERE, 'profiles.json'), 'utf8');
const profilesSha = sha(profilesRaw, 16);
const allProfiles = JSON.parse(profilesRaw).profiles;

const vf = opt('--validate');
if (vf) {
  let doc; try { doc = JSON.parse(fs.readFileSync(vf, 'utf8')); } catch (e) { finish(`FAIL không đọc được ${vf}: ${e.message}`, 1); }
  const errs = validateLabels(doc, { profilesSha });
  if (errs.length) finish(`FAIL nhãn không hợp lệ:\n - ${errs.join('\n - ')}`, 1);
  finish(`PASS nhãn hợp lệ (${doc.graders.length} người chấm, ${doc.labels.length} nhãn, is_sample=${doc.is_sample})`, 0);
}

const labelsPath = path.resolve(opt('--labels') || path.join(HERE, 'labels.json'));
const back = path.resolve(process.env.TOHONG_BACK || path.join(HERE, '..', '..', '..', 'tohong-back'));
const mod = await import(pathToFileURL(path.join(back, 'lib', 'vendorMatcher.js')).href);
const pool = mod.VENDOR_POOL, poolById = Object.fromEntries(pool.map((v) => [v.id, v]));
const poolSha = sha(JSON.stringify(pool.map((v) => [v.id, v.category, v.priceMin, v.priceMax, v.city, v.isVerified, v.rating]).sort()), 16);
const topFn = (p, cat) => mod.computeMatches(p, { category: cat, limit: 5 }).vendors.map((v) => v.id);
const baselinePath = path.resolve(opt('--baseline') || path.join(HERE, 'baseline.json'));

const head = `T-074 · pool=${pool.length} vendor (sha ${poolSha}) · hồ sơ=${allProfiles.length} · không tụt quá ${MAX_DROP_PT} điểm so với baseline, phủ nhãn top 5 >= ${COVERAGE_PCT}% · giá địa điểm tiệc: triệu/bàn (~85% theo bằng chứng, xem spec)`;
console.log(head);

if (!fs.existsSync(labelsPath)) {
  for (const c of CATEGORIES) console.log(`${c.padEnd(12)} tỉ lệ: chưa có nhãn`);
  finish(`FAIL chưa có nhãn thật: ${path.relative(process.cwd(), labelsPath)} không tồn tại; cần ${MIN_GRADERS}-5 người chấm ngoài do Capu mời (quy trình: products/T-074-bo-eval-top5.md)`, 1);
}
let doc;
try { doc = JSON.parse(fs.readFileSync(labelsPath, 'utf8')); } catch (e) { finish(`FAIL không đọc được nhãn: ${e.message}`, 1); }
const errs = validateLabels(doc, { profilesSha });
if (errs.length) finish(`FAIL nhãn không hợp lệ:\n - ${errs.join('\n - ')}`, 1);
const labelsSha = sha(fs.readFileSync(labelsPath, 'utf8'), 16);

// Nhãn mẫu chỉ phủ vài hồ sơ: chỉ tính trên hồ sơ có nhãn. Nhãn thật phải phủ cả 30.
const inLabels = new Set(doc.labels.map((r) => r.profile));
const profiles = doc.is_sample ? allProfiles.filter((p) => inLabels.has(p.id)) : allProfiles;
console.log(`nhãn: ${path.relative(process.cwd(), labelsPath)} · ${doc.graders.length} người chấm · ${doc.is_sample ? 'NHÃN MẪU (giả lập, không phải đánh giá người)' : 'nhãn thật'} · hồ sơ tính=${profiles.length}`);
const r = evaluate({ profiles, rows: doc.labels, poolById, topFn });
let base = null;
if (!doc.is_sample && fs.existsSync(baselinePath)) {
  try { base = JSON.parse(fs.readFileSync(baselinePath, 'utf8')); } catch (e) { finish(`FAIL không đọc được baseline: ${e.message}`, 1); }
  if (base.schema !== 't074-baseline/v1' || !base.rates || !CATEGORIES.every((c) => Number.isFinite(base.rates[c]))) finish('FAIL baseline sai định dạng (t074-baseline/v1, đủ 4 hạng mục)', 1);
}
const cmp = base && base.labels_sha === labelsSha && base.profiles_sha === profilesSha ? compareBaseline(r, base.rates) : null;
console.log('hạng mục      ô   trùng/đã-chấm  tỉ lệ    ±95%   phủ nhãn  đối chứng(ngẫu nhiên)  so baseline');
for (const c of CATEGORIES) {
  const x = r.categories[c];
  console.log(`${c.padEnd(12)} ${String(x.cells).padStart(3)}  ${(`${x.fit}/${x.covered}`).padStart(9)}  ${x.ratePct.toFixed(1).padStart(5)}%  ` +
    `${x.ci95Pct == null ? '  n/a' : '±' + x.ci95Pct.toFixed(1).padStart(4)}  ${x.coveragePct.toFixed(1).padStart(5)}%  ${x.fillerPct == null ? '   n/a' : x.fillerPct.toFixed(1).padStart(5) + '%'}` +
    `  ${cmp ? (cmp[c].delta >= 0 ? '+' : '') + cmp[c].delta.toFixed(1) + (cmp[c].pass ? ' đạt' : ' TỤT QUÁ ' + MAX_DROP_PT) : base ? 'n/a' : 'chưa có baseline'}` +
    `${x.pass ? '' : '  | ' + x.reasons.join('; ')}`);
}
if (r.unlabeled.length) {
  const f = path.join(path.resolve(opt('--out') || process.env.T074_OUT || os.tmpdir()), 't074-unlabeled.json');
  try { fs.writeFileSync(f, JSON.stringify(r.unlabeled, null, 1)); console.log(`cần chấm thêm ${r.unlabeled.length} cặp (hồ sơ, vendor): ${f}`); } catch { /* chỉ gợi ý */ }
}
if (doc.is_sample) finish('FAIL nhãn mẫu (is_sample=true): chỉ để kiểm cách chạy, không có giá trị đạt/không đạt; cần nhãn thật', 1);
if (!r.pass) finish(`FAIL ${CATEGORIES.filter((c) => !r.categories[c].pass).map((c) => `${c}: ${r.categories[c].reasons.join('; ')}`).join(' | ')}`, 1);
if (base && !cmp) {
  for (const c of CATEGORIES) console.log(`baseline cũ ${c}: ${base.rates[c].toFixed(1)}% -> tỉ lệ mới (nhãn khác) ${r.categories[c].ratePct.toFixed(1)}% (${(r.categories[c].ratePct - base.rates[c] >= 0 ? '+' : '') + (r.categories[c].ratePct - base.rates[c]).toFixed(1)})`);
  finish('FAIL nhãn hoặc hồ sơ đã đổi so với lúc ghi baseline: baseline vô hiệu; chấm thêm nghĩa là đặt lại baseline (xoá baseline.json rồi --save-baseline) là quyết định của Capu, xem tỉ lệ cũ cạnh tỉ lệ mới ở trên (ghi decisions/)', 1);
}
if (base && args.includes('--save-baseline')) finish('FAIL baseline đã có: không ghi đè; đặt baseline mới là quyết định của Capu (ghi decisions/)', 1);
const rates = CATEGORIES.map((c) => `${c} ${r.categories[c].ratePct.toFixed(1)}%`).join(', ');
if (cmp) {
  const bad = CATEGORIES.filter((c) => !cmp[c].pass);
  if (bad.length) finish(`FAIL tụt quá ${MAX_DROP_PT} điểm so với baseline: ${bad.map((c) => `${c} ${cmp[c].delta.toFixed(1)}`).join(', ')}`, 1);
  finish(`PASS không hạng mục nào tụt quá ${MAX_DROP_PT} điểm so với baseline (${rates})`, 0);
}
if (args.includes('--save-baseline')) {
  fs.writeFileSync(baselinePath, JSON.stringify({ schema: 't074-baseline/v1', recorded: new Date().toISOString().slice(0, 10), profiles_sha: profilesSha, labels_sha: labelsSha, pool_sha: poolSha,
    rates: Object.fromEntries(CATEGORIES.map((c) => [c, Number(r.categories[c].ratePct.toFixed(4))])) }, null, 1) + '\n');
  finish(`PASS đã ghi baseline ${path.relative(process.cwd(), baselinePath)} (${rates})`, 0);
}
finish(`PASS baseline lần đầu, không có ngưỡng đạt/rớt (${rates}); ghi lại bằng --save-baseline (Capu duyệt)`, 0);
