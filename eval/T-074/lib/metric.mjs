// T-074 · cách tính tỉ lệ trùng top 5 và kiểm nhãn. Hàm thuần, không đọc file, không gọi matcher.
import { CATEGORIES, machineCheck, cardSha } from './candidates.mjs';

export const MAX_DROP_PT = 10;    // NGUONG_TUT_TOI_DA trong spec: so với baseline, tụt quá số điểm này là FAIL (Capu chốt)
export const COVERAGE_PCT = 80;   // NGUONG_PHU_NHAN trong spec: tối thiểu % vị trí top 5 đã có nhãn (Spec Writer đề xuất)
export const MIN_GRADERS = 3, MAX_GRADERS = 5;
export const SCHEMA = 't074-labels/v1';

// Đa số tuyệt đối trong >= 3 người; hoà (vd 2/4) = không phù hợp; ít hơn 3 người = chưa đủ nhãn (null).
export function majority(votes) {
  if (votes.length < MIN_GRADERS) return null;
  return votes.filter(Boolean).length * 2 > votes.length;
}

const GRADER_KEYS = new Set(['id', 'relationship', 'declaration']);
const DECL_KEYS = new Set(['saw_system_scores', 'touched_matching_weights']);
const ROW_KEYS = new Set(['profile', 'category', 'vendor', 'grader', 'fit', 'role', 'card']);

export function validateLabels(doc, { profilesSha } = {}) {
  const e = [];
  if (!doc || typeof doc !== 'object') return ['file nhãn không phải object JSON'];
  if (doc.schema !== SCHEMA) e.push(`schema phải là ${SCHEMA}`);
  if (typeof doc.is_sample !== 'boolean') e.push('is_sample phải là true/false');
  if (profilesSha && doc.profiles_sha !== profilesSha) e.push('profiles_sha không khớp profiles.json: hồ sơ đã đổi sau khi chấm, nhãn vô hiệu');
  const gs = Array.isArray(doc.graders) ? doc.graders : [];
  if (gs.length < MIN_GRADERS || gs.length > MAX_GRADERS) e.push(`cần ${MIN_GRADERS}-${MAX_GRADERS} người chấm, có ${gs.length}`);
  const ids = new Set();
  for (const g of gs) {
    if (!g || typeof g.id !== 'string' || !g.id) { e.push('người chấm thiếu id'); continue; }
    if (ids.has(g.id)) e.push(`trùng id người chấm ${g.id}`);
    ids.add(g.id);
    for (const k of Object.keys(g)) if (!GRADER_KEYS.has(k)) e.push(`người chấm ${g.id} có trường lạ "${k}" (không đưa dữ liệu cá nhân vào repo)`);
    if (g.relationship !== 'external') e.push(`người chấm ${g.id} phải là external (người ngoài, không phải Capu hay agent)`);
    const d = g.declaration || {};
    for (const k of Object.keys(d)) if (!DECL_KEYS.has(k)) e.push(`khai báo của ${g.id} có trường lạ "${k}"`);
    if (d.saw_system_scores !== false) e.push(`người chấm ${g.id} chưa khai saw_system_scores=false`);
    if (d.touched_matching_weights !== false) e.push(`người chấm ${g.id} chưa khai touched_matching_weights=false`);
  }
  const seen = new Set();
  const rows = Array.isArray(doc.labels) ? doc.labels : [];
  if (!rows.length) e.push('không có nhãn nào');
  rows.forEach((r, i) => {
    const at = `nhãn #${i}`;
    for (const k of Object.keys(r)) if (!ROW_KEYS.has(k)) e.push(`${at} có trường lạ "${k}"`);
    if (!ids.has(r.grader)) e.push(`${at} ghi người chấm "${r.grader}" không có trong graders`);
    if (!CATEGORIES.includes(r.category)) e.push(`${at} hạng mục "${r.category}" ngoài 4 hạng mục chính`);
    if (typeof r.fit !== 'boolean') e.push(`${at} fit phải là true/false`);
    if (r.role !== 'system' && r.role !== 'filler') e.push(`${at} role phải là system hoặc filler`);
    if (!r.vendor || !r.profile || !r.card) e.push(`${at} thiếu profile/vendor/card`);
    const k = [r.profile, r.category, r.vendor, r.grader].join('|');
    if (seen.has(k)) e.push(`${at} trùng nhãn ${k}`);
    seen.add(k);
  });
  return [...new Set(e)].slice(0, 30);
}

function index(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = `${r.profile}|${r.category}|${r.vendor}`;
    if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(r.grader, r);
  }
  return m;
}
function votesFor(idx, key, currentCard) {
  const g = idx.get(key);
  if (!g) return [];
  return [...g.values()].filter((r) => r.card === currentCard).map((r) => r.fit);
}

// Vị trí top 5: ô thiếu (hệ thống trả < 5) và vendor trượt luật máy A/B tính là KHÔNG phù hợp, vẫn nằm trong mẫu số.
// Vendor chưa có đủ 3 nhãn (hoặc thẻ đã đổi) là CHƯA CHẤM: ra khỏi mẫu số và tử số, được báo riêng (phủ nhãn), để vendor mới vào top 5
// không làm tỉ lệ tụt giả.
export function evaluate({ profiles, rows, poolById, topFn, coveragePct = COVERAGE_PCT }) {
  const idx = index(rows);
  const out = { categories: {}, unlabeled: [] };
  for (const cat of CATEGORIES) {
    let fit = 0, slots = 0, covered = 0, machineFail = 0, short = 0;
    const perProfile = [], unl = [];
    for (const p of profiles) {
      const top = topFn(p, cat).slice(0, 5);
      let pf = 0, pc = 0;
      for (let i = 0; i < 5; i++) {
        slots++;
        const id = top[i];
        if (!id) { short++; covered++; pc++; continue; }
        const v = poolById[id];
        const mc = machineCheck(v, p, cat);
        if (!mc.a || !mc.b) { machineFail++; covered++; pc++; continue; }
        const m = majority(votesFor(idx, `${p.id}|${cat}|${id}`, cardSha(v)));
        if (m === null) { unl.push({ profile: p.id, category: cat, vendor: id }); continue; }
        covered++; pc++;
        if (m) { fit++; pf++; }
      }
      if (pc) perProfile.push(pf / pc);
    }
    // đối chứng ngẫu nhiên: chỉ để tham khảo, không có ngưỡng
    let fN = 0, fFit = 0;
    const inScope = new Set(profiles.map((p) => p.id));
    const pById = Object.fromEntries(profiles.map((p) => [p.id, p]));
    const seenF = new Set();
    for (const r of rows) {
      if (r.role !== 'filler' || r.category !== cat || !inScope.has(r.profile)) continue;
      const key = `${r.profile}|${cat}|${r.vendor}`;
      if (seenF.has(key)) continue;
      seenF.add(key);
      const v = poolById[r.vendor];
      const mc = machineCheck(v, pById[r.profile], cat);
      if (!mc.a || !mc.b) continue;
      const m = majority(votesFor(idx, key, cardSha(v)));
      if (m === null) continue;
      fN++; if (m) fFit++;
    }
    const n = perProfile.length, mean = perProfile.reduce((a, b) => a + b, 0) / (n || 1);
    const sd = Math.sqrt(perProfile.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
    const ratePct = covered ? (fit * 100) / covered : 0;
    const coverPct = slots ? (covered * 100) / slots : 0;
    const fillerPct = fN ? (fFit * 100) / fN : null;
    const reasons = [];
    if (coverPct < coveragePct) reasons.push(`phủ nhãn ${coverPct.toFixed(1)}% < ${coveragePct}% (${unl.length} vị trí top 5 chưa đủ ${MIN_GRADERS} nhãn, cần chấm thêm)`);
    out.categories[cat] = {
      cells: profiles.length, slots, covered, fit, machineFail, short, unlabeled: unl.length, coveragePct: coverPct, ratePct,
      ci95Pct: n > 1 ? 196 * sd / Math.sqrt(n) : null, fillerPct, fillerN: fN, lift: fillerPct === null ? null : ratePct - fillerPct,
      pass: reasons.length === 0, reasons,
    };
    out.unlabeled.push(...unl);
  }
  out.pass = CATEGORIES.every((c) => out.categories[c].pass);
  return out;
}

// So với baseline: rates = {category: ratePct}. Tụt NHIỀU HƠN MAX_DROP_PT điểm là FAIL; đúng bằng thì đạt.
export function compareBaseline(cur, baseRates, maxDrop = MAX_DROP_PT) {
  const res = {};
  for (const c of CATEGORIES) {
    const delta = cur.categories[c].ratePct - baseRates[c];
    res[c] = { delta, pass: delta >= -maxDrop - 1e-9 };
  }
  return res;
}
