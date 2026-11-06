// T-074 tiêu chí 7: định nghĩa "vendor phù hợp" và cách tính tỉ lệ đúng theo spec. Kiểm hàm tính bằng dữ liệu giả có đáp án biết trước.
import { evaluate, majority, THRESHOLD_PCT } from './lib/metric.mjs';
import { cardSha } from './lib/candidates.mjs';
let bad = 0; const t = (ok, m) => { if (!ok) { bad++; console.log('  sai: ' + m); } };
const mk = (id, o = {}) => ({ id, category: 'makeup', city: 'HCMC', isVerified: true, rating: 4.5, reviewCount: 10, priceMin: 5, priceMax: 8, name: id, description: 'd', photos: [], ...o });
const prof = (id) => ({ id, city: 'HCMC', budgetByCategory: { photography: 10, makeup: 8, attire: 10, venue: 10 } });
const rowsFor = (p, cat, v, votes, role = 'system', card) => votes.map((fit, i) => ({ profile: p, category: cat, vendor: v.id, grader: `G${i + 1}`, fit, role, card: card ?? cardSha(v) }));
const run = (vendors, profiles, rows, top) => evaluate({ profiles, rows, poolById: Object.fromEntries(vendors.map((v) => [v.id, v])), topFn: (p, c) => (c === 'makeup' ? top[p.id] : []) });
t(majority([true, true, false]) === true, '2/3 phải là phù hợp');
t(majority([true, false, false]) === false, '1/3 không phù hợp');
t(majority([true, true, false, false]) === false, '2/4 hoà phải là không phù hợp');
t(majority([true, true, true, false, false]) === true, '3/5 phải là phù hợp');
t(majority([true, true]) === null, '2 người chưa đủ nhãn');
// một ô, 5 vendor, đa số 3/3 -> 100%
const V = ['a', 'b', 'c', 'd', 'e'].map((x) => mk(x)); const P1 = prof('P1');
let rows = V.flatMap((v) => rowsFor('P1', 'makeup', v, [true, true, true]));
let r = run(V, [P1], rows, { P1: V.map((v) => v.id) }).categories.makeup;
t(r.fit === 5 && r.ratePct === 100, `5/5 phù hợp phải ra 100%, ra ${r.ratePct}`);
// luật máy: trượt giá/xác minh/rating/thành phố/hạng mục thì không phù hợp dù 3/3 nói có
const traps = [mk('p', { priceMin: 9 }), mk('u', { isVerified: false }), mk('r', { rating: 3.4 }), mk('c', { city: 'HANOI' }), mk('k', { category: 'venue' })];
rows = traps.flatMap((v) => rowsFor('P1', 'makeup', v, [true, true, true]));
r = run(traps, [P1], rows, { P1: traps.map((v) => v.id) }).categories.makeup;
t(r.fit === 0 && r.machineFail === 5 && r.unlabeled === 0, `5 vendor trượt luật máy phải ra 0 phù hợp, 0 chưa chấm; ra fit=${r.fit} machineFail=${r.machineFail} unl=${r.unlabeled}`);
// giá thấp nhất đúng bằng ngân sách thì vẫn đạt; rating chưa có (0) thì đạt
const edge = [mk('e1', { priceMin: 8 }), mk('e2', { rating: 0 })];
r = run(edge, [P1], edge.flatMap((v) => rowsFor('P1', 'makeup', v, [true, true, true])), { P1: ['e1', 'e2'] }).categories.makeup;
t(r.fit === 2, `giá thấp nhất = ngân sách và rating 0 phải đạt luật máy, ra fit=${r.fit}`);
// thiếu nhãn: vendor vào top 5 mà 2 người chấm -> chưa chấm, hạng mục không đạt
rows = V.flatMap((v) => rowsFor('P1', 'makeup', v, v.id === 'e' ? [true, true] : [true, true, true]));
r = run(V, [P1], rows, { P1: V.map((v) => v.id) }).categories.makeup;
t(r.unlabeled === 1 && !r.pass && r.reasons.some((x) => x.includes('chưa đủ')), 'vendor mới vào top 5 mà chưa đủ 3 nhãn phải bị báo chưa chấm và hạng mục không đạt');
// nhãn cũ khi thẻ vendor đã đổi (giá đổi) không còn hiệu lực
rows = V.flatMap((v) => rowsFor('P1', 'makeup', v, [true, true, true], 'system', 'khac'));
r = run(V, [P1], rows, { P1: V.map((v) => v.id) }).categories.makeup;
t(r.unlabeled === 5, `nhãn gắn thẻ cũ phải coi là chưa chấm, ra ${r.unlabeled}`);
// ngưỡng biên: 2 hồ sơ x 5 = 10 ô; 8/10 đạt tỉ lệ, 7/10 trượt (đối chứng 0% nên lift không cản)
const W = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((x) => mk(x)); const P2 = prof('P2');
const filler = mk('z'); const fr = (p) => rowsFor(p, 'makeup', filler, [false, false, false], 'filler');
const build = (fitCount) => {
  let rr = [...fr('P1'), ...fr('P2')];
  W.forEach((v, i) => { const p = i < 5 ? 'P1' : 'P2'; rr = rr.concat(rowsFor(p, 'makeup', v, i < fitCount ? [true, true, true] : [false, false, false])); });
  return run([...W, filler], [P1, P2], rr, { P1: W.slice(0, 5).map((v) => v.id), P2: W.slice(5).map((v) => v.id) }).categories.makeup;
};
t(THRESHOLD_PCT === 80, 'ngưỡng mặc định phải là 80');
let b8 = build(8), b7 = build(7);
t(b8.ratePct === 80 && b8.pass, `8/10 = đúng ngưỡng phải đạt, ra ${b8.ratePct} pass=${b8.pass}`);
t(b7.ratePct === 70 && !b7.pass, `7/10 phải trượt, ra ${b7.ratePct} pass=${b7.pass}`);
// đối chứng: người chấm khen tất cả (kể cả vendor ngẫu nhiên) thì không được PASS
let rr = [...rowsFor('P1', 'makeup', filler, [true, true, true], 'filler'), ...rowsFor('P2', 'makeup', filler, [true, true, true], 'filler')];
W.forEach((v, i) => { rr = rr.concat(rowsFor(i < 5 ? 'P1' : 'P2', 'makeup', v, [true, true, true])); });
r = run([...W, filler], [P1, P2], rr, { P1: W.slice(0, 5).map((v) => v.id), P2: W.slice(5).map((v) => v.id) }).categories.makeup;
t(r.ratePct === 100 && !r.pass && r.lift === 0, `người chấm khen cả đối chứng phải không PASS (lift 0), ra pass=${r.pass} lift=${r.lift}`);
// hệ thống trả ít hơn 5: ô thiếu tính là không phù hợp (mẫu số vẫn là 5)
r = run(V, [P1], V.slice(0, 3).flatMap((v) => rowsFor('P1', 'makeup', v, [true, true, true])), { P1: ['a', 'b', 'c'] }).categories.makeup;
t(r.fit === 3 && r.slots === 5 && r.short === 2, `trả 3/5 vendor phải ra 3 trên 5 ô, ra ${r.fit}/${r.slots}`);
if (bad) { console.log(`FAIL ${bad} kiểm tra cách tính sai`); process.exit(1); }
console.log('PASS cách tính: đa số tuyệt đối, hoà là không, luật máy loại giá/xác minh/rating/thành phố/hạng mục, thiếu nhãn và thẻ đổi = chưa chấm, ngưỡng biên 80%, đối chứng chặn người chấm khen cả');
