#!/usr/bin/env node
// T-074 · MỘT LỆNH: in tỉ lệ trùng top 5 theo hạng mục giữa matcher thật (pool thật) và nhãn người chấm mù.
//   node eval/T-074/match_eval.mjs [--labels <file>] [--validate <file>] [--print-threshold]
// Dòng cuối luôn là "PASS ..." hoặc "FAIL <lý do>"; mã thoát 0 chỉ khi PASS. Không sửa matcher, không sửa nhãn.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, sha } from './lib/candidates.mjs';
import { evaluate, validateLabels, THRESHOLD_PCT, LIFT_PCT, MIN_GRADERS } from './lib/metric.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const finish = (line, code) => { console.log(line); process.exit(code); };

if (args.includes('--print-threshold')) finish(`${THRESHOLD_PCT} ${LIFT_PCT}`, 0);

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

const head = `T-074 · pool=${pool.length} vendor (sha ${poolSha}) · hồ sơ=${allProfiles.length} · ngưỡng trùng top 5 >= ${THRESHOLD_PCT}%, hơn đối chứng >= ${LIFT_PCT} điểm`;
console.log(head);

if (!fs.existsSync(labelsPath)) {
  for (const c of CATEGORIES) console.log(`${c.padEnd(12)} tỉ lệ: chưa có nhãn`);
  finish(`FAIL chưa có nhãn thật: ${path.relative(process.cwd(), labelsPath)} không tồn tại; cần ${MIN_GRADERS}-5 người chấm ngoài do Capu mời (quy trình: products/T-074-bo-eval-top5.md)`, 1);
}
let doc;
try { doc = JSON.parse(fs.readFileSync(labelsPath, 'utf8')); } catch (e) { finish(`FAIL không đọc được nhãn: ${e.message}`, 1); }
const errs = validateLabels(doc, { profilesSha });
if (errs.length) finish(`FAIL nhãn không hợp lệ:\n - ${errs.join('\n - ')}`, 1);

// Nhãn mẫu chỉ phủ vài hồ sơ: chỉ tính trên hồ sơ có nhãn. Nhãn thật phải phủ cả 30.
const inLabels = new Set(doc.labels.map((r) => r.profile));
const profiles = doc.is_sample ? allProfiles.filter((p) => inLabels.has(p.id)) : allProfiles;
console.log(`nhãn: ${path.relative(process.cwd(), labelsPath)} · ${doc.graders.length} người chấm · ${doc.is_sample ? 'NHÃN MẪU (giả lập, không phải đánh giá người)' : 'nhãn thật'} · hồ sơ tính=${profiles.length}`);
const r = evaluate({ profiles, rows: doc.labels, poolById, topFn });
console.log('hạng mục      ô   trùng/top5  tỉ lệ    ±95%   đối chứng  hơn   kết quả');
for (const c of CATEGORIES) {
  const x = r.categories[c];
  console.log(`${c.padEnd(12)} ${String(x.cells).padStart(3)}  ${(`${x.fit}/${x.slots}`).padStart(9)}  ${x.ratePct.toFixed(1).padStart(5)}%  ` +
    `${x.ci95Pct == null ? '  n/a' : '±' + x.ci95Pct.toFixed(1).padStart(4)}  ${x.fillerPct == null ? '   n/a' : x.fillerPct.toFixed(1).padStart(5) + '%'}  ` +
    `${x.lift == null ? ' n/a' : (x.lift >= 0 ? '+' : '') + x.lift.toFixed(1)}  ${x.pass ? 'đạt' : 'chưa: ' + x.reasons.join('; ')}`);
}
if (r.unlabeled.length) {
  const f = path.join(process.env.T074_OUT || process.cwd(), 't074-unlabeled.json');
  try { fs.writeFileSync(f, JSON.stringify(r.unlabeled, null, 1)); console.log(`cần chấm thêm ${r.unlabeled.length} cặp (hồ sơ, vendor): ${f}`); } catch { /* chỉ gợi ý */ }
}
if (doc.is_sample) finish('FAIL nhãn mẫu (is_sample=true): chỉ để kiểm cách chạy, không có giá trị đạt/không đạt; cần nhãn thật', 1);
if (!r.pass) finish(`FAIL ${CATEGORIES.filter((c) => !r.categories[c].pass).map((c) => `${c}: ${r.categories[c].reasons.join('; ')}`).join(' | ')}`, 1);
finish(`PASS cả 4 hạng mục >= ${THRESHOLD_PCT}% và hơn đối chứng >= ${LIFT_PCT} điểm`, 0);
