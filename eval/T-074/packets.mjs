#!/usr/bin/env node
// T-074 · gói chấm mù.
//   node eval/T-074/packets.mjs make   --graders N(3-5) --out <thư mục NGOÀI repo>
//   node eval/T-074/packets.mjs import --dir <thư mục> --out <labels.json> [--sample]
// make: mỗi người một file G<k>.csv (hạng mục × hồ sơ × ứng viên đã trộn: top 15 của máy qua luật A+B và 5 vendor ngẫu nhiên) cùng HUONG_DAN.md; KHÔNG có điểm, hạng, style, tag, vai trò.
// Bí mật (không gửi người chấm) nằm ở <dir>/_private/key.json. import: đọc cột "phu_hop" (co/khong) thành labels.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, sha, cardOf, cardSha, profileText, buildCandidates, TOP_CANDIDATES, RANDOM_PER_CELL } from './lib/candidates.mjs';
import { MIN_GRADERS, MAX_GRADERS, SCHEMA } from './lib/metric.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
const die = (m) => { console.error(`FAIL ${m}`); process.exit(1); };
const profilesRaw = fs.readFileSync(path.join(HERE, 'profiles.json'), 'utf8');
const profiles = JSON.parse(profilesRaw).profiles, profilesSha = sha(profilesRaw, 16);

const COLS = ['o_cham', 'mo_ta_cap_doi', 'ma_vendor', 'ten', 'mo_ta', 'gia_hien_thi', 'danh_gia', 'so_review', 'anh_1', 'anh_2', 'anh_3', 'phu_hop'];
const q = (s) => { s = String(s ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function parseCsv(t) {
  const rows = []; let row = [], f = '', inq = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inq) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some((x) => x !== '')) rows.push(row); }
  return rows;
}


// Hướng dẫn chấm: gửi kèm mọi gói. Không nhắc tên cột máy, điểm, hạng, trọng số.
export const QUESTION = 'Với cặp đôi này, anh/chị có khuyên họ liên hệ vendor này không?';
const GUIDE = `# Hướng dẫn chấm

Mỗi dòng trong file CSV của anh/chị là một vendor cưới (nhà cung cấp dịch vụ) và mô tả một cặp đôi ở cột mo_ta_cap_doi.
Với mỗi dòng, trả lời câu hỏi sau bằng cách điền cột phu_hop (viết co hoặc khong, không để trống):

**${QUESTION}**

Cách xét:
- Đặt mình vào vị trí người tư vấn cho đúng cặp đôi ở cột mo_ta_cap_doi: phong cách họ thích, số khách, ngân sách.
- Dựa vào tên, mô tả, ảnh, giá, đánh giá trên thẻ. Anh/chị không cần và không nên tra thêm thông tin ngoài.
- Về giá: mọi vendor anh/chị thấy đều có ít nhất một gói trong ngân sách của hạng mục đó (giá thấp nhất không vượt ngân sách). Đừng trừ điểm chỉ vì giá cao nhất của khoảng giá vượt ngân sách.
- Địa điểm tiệc: giá và ngân sách đều tính triệu đồng mỗi bàn.
- Khuyên liên hệ vì thấy hợp với cặp đôi này, không phải vì thẻ đầy đủ hay đẹp. Mỗi dòng chấm độc lập, không so với dòng khác.
- Không trao đổi với người chấm khác. Không tìm hiểu cách hệ thống xếp hạng.

Ví dụ minh hoạ (vendor và cặp đôi giả, không có trong dữ liệu):
- Cặp đôi thích phong cách truyền thống, ngân sách chụp ảnh 20 triệu. Thẻ: "Studio chuyên phóng sự cưới truyền thống, áo dài, lễ gia tiên", giá 12–25 triệu, 4,8 sao. Trả lời: co (hợp phong cách, có gói trong ngân sách).
- Cùng cặp đôi. Thẻ: "Chuyên chụp concept Hàn Quốc ngoại cảnh, nền studio màu pastel", giá 10–18 triệu. Trả lời: khong (giá vừa nhưng phong cách lệch hẳn).
- Cặp đôi thích hiện đại, ngân sách makeup 8 triệu. Thẻ: "Makeup cô dâu phong cách hiện đại, tối giản, lớp nền mỏng", giá 3–8 triệu, ảnh khách cưới. Trả lời: co.
`;

async function loadMatcher() {
  const back = path.resolve(process.env.TOHONG_BACK || path.join(HERE, '..', '..', '..', 'tohong-back'));
  return import(pathToFileURL(path.join(back, 'lib', 'vendorMatcher.js')).href);
}

if (cmd === 'make') {
  const n = Number(opt('--graders')), out = opt('--out');
  if (!(n >= MIN_GRADERS && n <= MAX_GRADERS)) die(`--graders phải từ ${MIN_GRADERS} đến ${MAX_GRADERS}`);
  if (!out) die('thiếu --out');
  const mod = await loadMatcher(), pool = mod.VENDOR_POOL, byId = Object.fromEntries(pool.map((v) => [v.id, v]));
  fs.mkdirSync(path.join(out, '_private'), { recursive: true });
  const perGrader = Array.from({ length: n }, () => []);
  const key = { schema: 't074-key/v1', profiles_sha: profilesSha, graders: n, cells: [] };
  let cell = 0;
  for (const p of profiles) for (const cat of CATEGORIES) {
    const top = mod.computeMatches(p, { category: cat, limit: TOP_CANDIDATES }).vendors.map((v) => v.id);
    const cands = buildCandidates(p, cat, top, pool);
    const cellId = `${p.id}-${cat}`;
    const assigned = [0, 1, 2].map((d) => (cell + d) % n);   // đúng 3 người mỗi ô, xoay vòng
    key.cells.push({ cell: cellId, profile: p.id, category: cat, graders: assigned.map((i) => `G${i + 1}`),
      candidates: cands.map((c) => ({ ...c, card: cardSha(byId[c.vendor]) })) });
    for (const gi of assigned) for (const c of cands) {
      const k = cardOf(byId[c.vendor]);
      perGrader[gi].push([cellId, profileText(p), c.vendor, k.name, k.description, k.price, k.rating ?? '', k.reviewCount, k.photos[0] ?? '', k.photos[1] ?? '', k.photos[2] ?? '', '']);
    }
    cell++;
  }
  perGrader.forEach((rows, i) => fs.writeFileSync(path.join(out, `G${i + 1}.csv`), [COLS, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n'));
  fs.writeFileSync(path.join(out, '_private', 'key.json'), JSON.stringify(key, null, 1));
  fs.writeFileSync(path.join(out, '_private', 'declarations.template.json'), JSON.stringify(
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`G${i + 1}`, { is_external: null, saw_system_scores: null, touched_matching_weights: null }])), null, 1));
  fs.writeFileSync(path.join(out, 'HUONG_DAN.md'), GUIDE);
  const short = key.cells.filter((c) => c.candidates.filter((x) => x.role === 'filler').length < RANDOM_PER_CELL).length;
  console.log(`PASS ghi ${n} gói chấm + _private/ vào ${out} (${cell} ô, mỗi ô 3 người; ô thiếu vendor ngẫu nhiên (ít hơn ${RANDOM_PER_CELL} vendor qua A+B ngoài top ${TOP_CANDIDATES}): ${short})`);
} else if (cmd === 'import') {
  const dir = opt('--dir'), out = opt('--out');
  if (!dir || !out) die('thiếu --dir hoặc --out');
  const key = JSON.parse(fs.readFileSync(path.join(dir, '_private', 'key.json'), 'utf8'));
  if (key.profiles_sha !== profilesSha) die('profiles.json đã đổi sau khi tạo gói chấm');
  const decl = JSON.parse(fs.readFileSync(path.join(dir, '_private', 'declarations.json'), 'utf8'));
  const cellMap = Object.fromEntries(key.cells.map((c) => [c.cell, c]));
  const labels = [], graders = [];
  for (let i = 1; i <= key.graders; i++) {
    const g = `G${i}`, d = decl[g] || {};
    graders.push({ id: g, relationship: d.is_external === true ? 'external' : d.is_external === false ? 'internal' : null, declaration: { saw_system_scores: d.saw_system_scores, touched_matching_weights: d.touched_matching_weights } });
    const rows = parseCsv(fs.readFileSync(path.join(dir, `${g}.csv`), 'utf8')).slice(1);
    for (const r of rows) {
      const c = cellMap[r[0]]; if (!c) die(`${g}: ô lạ ${r[0]}`);
      const cand = c.candidates.find((x) => x.vendor === r[2]); if (!cand) die(`${g}: vendor lạ ${r[2]} ở ${r[0]}`);
      const v = r[11].trim().toLowerCase();
      if (v !== 'co' && v !== 'khong') die(`${g}: ô ${r[0]} vendor ${r[2]} chưa điền phu_hop (co/khong), đang là "${r[11]}"`);
      labels.push({ profile: c.profile, category: c.category, vendor: r[2], grader: g, fit: v === 'co', role: cand.role, card: cand.card });
    }
  }
  fs.writeFileSync(out, JSON.stringify({ schema: SCHEMA, is_sample: process.argv.includes('--sample'), profiles_sha: profilesSha, graders, labels }));
  console.log(`PASS ghi ${labels.length} nhãn từ ${key.graders} người chấm -> ${out} (chạy: node eval/T-074/match_eval.mjs --validate ${out})`);
} else die('dùng: make | import');
