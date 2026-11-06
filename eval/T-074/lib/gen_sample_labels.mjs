// T-074 · sinh labels.sample.json: NHÃN GIẢ LẬP để kiểm đường chạy. Phán quyết = chẵn/lẻ của băm, KHÔNG phải đánh giá người.
// Chạy: node eval/T-074/lib/gen_sample_labels.mjs   (phủ 6 hồ sơ: hồ sơ đầu của mỗi style)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, sha, cardSha, buildCandidates } from './candidates.mjs';
import { SCHEMA } from './metric.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(HERE, '..', 'profiles.json'), 'utf8');
const profiles = JSON.parse(raw).profiles.filter((p) => ['P01', 'P06', 'P11', 'P16', 'P21', 'P26'].includes(p.id));
const back = path.resolve(process.env.TOHONG_BACK || path.join(HERE, '..', '..', '..', '..', 'tohong-back'));
const mod = await import(pathToFileURL(path.join(back, 'lib', 'vendorMatcher.js')).href);
const pool = mod.VENDOR_POOL, byId = Object.fromEntries(pool.map((v) => [v.id, v]));
const graders = ['SAMPLE-1', 'SAMPLE-2', 'SAMPLE-3'];
const labels = [];
for (const p of profiles) for (const c of CATEGORIES) {
  const top = mod.computeMatches(p, { category: c, limit: 5 }).vendors.map((v) => v.id);
  for (const cand of buildCandidates(p, c, top, pool)) for (const g of graders)
    labels.push({ profile: p.id, category: c, vendor: cand.vendor, grader: g,
      fit: parseInt(sha(`${g}|${p.id}|${cand.vendor}`, 2), 16) % 2 === 0, role: cand.role, card: cardSha(byId[cand.vendor]) });
}
const doc = { schema: SCHEMA, is_sample: true, profiles_sha: sha(raw, 16),
  graders: graders.map((id) => ({ id, relationship: 'external', declaration: { saw_system_scores: false, touched_matching_weights: false } })),
  labels };
const out = path.join(HERE, '..', 'labels.sample.json');
fs.writeFileSync(out, '{"schema":"' + SCHEMA + '","is_sample":true,"profiles_sha":"' + doc.profiles_sha + '",\n"graders":' + JSON.stringify(doc.graders) + ',\n"labels":[\n' + labels.map((l) => JSON.stringify(l)).join(',\n') + '\n]}\n');
console.log('ghi', labels.length, 'nhãn mẫu ->', out);
