// T-074 · phần dùng chung: luật "phù hợp" phía máy, thẻ vendor người chấm thấy, chọn ứng viên chấm.
// KHÔNG import matcher: luật máy ở đây viết lại từ dữ liệu thô của pool để eval không phụ thuộc cách matcher tính điểm.
import { createHash } from 'node:crypto';

export const CATEGORIES = ['photography', 'makeup', 'attire', 'venue'];
export const TOP_CANDIDATES = 15;   // top 15 của matcher hiện tại (chỉ giữ vendor qua luật máy A và B)
export const RANDOM_PER_CELL = 5;   // 5 vendor ngẫu nhiên (seed cố định) cùng qua luật máy, ngoài top 15: đối chứng
export const sha = (s, n = 12) => createHash('sha256').update(s).digest('hex').slice(0, n);

// (A) qua tầng lọc cứng với dữ liệu thật  +  (B) giá thấp nhất vendor công bố <= ngân sách hạng mục.
export function machineCheck(v, profile, category) {
  if (!v) return { a: false, b: false };
  const a = v.category === category && v.city === profile.city && v.isVerified === true &&
    !(v.rating > 0 && v.rating < 3.5);
  const budget = profile.budgetByCategory?.[category];
  const b = Number.isFinite(v.priceMin) && Number.isFinite(budget) && v.priceMin <= budget;
  return { a, b };
}
export const machinePass = (v, p, c) => { const m = machineCheck(v, p, c); return m.a && m.b; };

// Địa điểm tiệc: giá là triệu đồng MỖI BÀN (bằng chứng ~85% trong spec); hạng mục khác: triệu đồng.
export function priceLabel(v) {
  const unit = v.category === 'venue' ? ' triệu/bàn' : ' triệu';
  return (v.priceMin === v.priceMax ? `${v.priceMin}` : `${v.priceMin}–${v.priceMax}`) + unit;
}

// Thẻ = đúng những gì người chấm được thấy. Không có styles, tags, điểm, hạng.
export function cardOf(v) {
  return {
    name: v.name,
    description: String(v.description || '').replace(/\s+/g, ' ').slice(0, 400),
    price: priceLabel(v),
    rating: v.rating > 0 ? v.rating : null,
    reviewCount: v.reviewCount || 0,
    photos: (v.photos || []).slice(0, 3).map((p) => p.url),
  };
}
export const cardSha = (v) => sha(JSON.stringify(cardOf(v)));

export function profileText(p) {
  const VI = { traditional: 'truyền thống', luxury: 'sang trọng', modern: 'hiện đại', korean: 'kiểu Hàn Quốc', natural: 'tự nhiên', rustic: 'mộc mạc đồng quê' };
  const st = p.preferredStyles.map((x) => VI[x] || x).join(' + ');
  const b = p.budgetByCategory;
  return `Cặp đôi cưới tại TP.HCM, tháng ${Number(p.weddingDate.slice(5, 7))}/${p.weddingDate.slice(0, 4)}, khoảng ${p.guestCount} khách, thích phong cách ${st}. ` +
    `Ngân sách tối đa mỗi hạng mục (triệu đồng): chụp ảnh ${b.photography}, makeup ${b.makeup}, trang phục ${b.attire}, tiệc/địa điểm ${b.venue} (tiệc tính mỗi bàn).`;
}

function rng(seedStr) {
  let a = parseInt(sha(seedStr, 8), 16) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(arr, seed) {
  const r = rng(seed), a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Ứng viên chấm cho một ô (hồ sơ × hạng mục): top 15 của matcher hiện tại (topIds, đã lấy limit 15) giữ lại những vendor qua luật máy
// + TỐI ĐA RANDOM_PER_CELL vendor ngẫu nhiên (ít hơn nếu ngoài top 15 không đủ vendor qua A+B: lấy hết) cùng qua luật máy nhưng ngoài top 15, trộn thứ tự theo seed. Vendor trượt luật máy không cần người chấm.
export function buildCandidates(profile, category, topIds, pool) {
  const topSet = new Set(topIds.slice(0, TOP_CANDIDATES));
  const eligible = pool.filter((v) => machinePass(v, profile, category)).sort((x, y) => (x.id < y.id ? -1 : 1));
  const sys = eligible.filter((v) => topSet.has(v.id)).map((v) => ({ vendor: v.id, role: 'system' }));
  const fill = shuffled(eligible.filter((v) => !topSet.has(v.id)), `fill|${profile.id}|${category}`)
    .slice(0, RANDOM_PER_CELL).map((v) => ({ vendor: v.id, role: 'filler' }));
  return shuffled([...sys, ...fill], `order|${profile.id}|${category}`);
}
