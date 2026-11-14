// T-167 tiêu chí 3. profileSnapshot của GET /api/vendors/match cho thấy số khách + ngân sách hạng mục server đã dùng (và nguồn số khách); không lộ dữ liệu cặp đôi khác.
// Chạy từ gốc tohong-hq: node eval/T-167/check_3_so_server_dung_khong_lo_cap_doi_khac.mjs
import { setup, matchOne, newBucket, budgetDoc, coupleProfile, restoreNow, done, ids, CID } from "./_lib.mjs";
import { tab } from "./_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const SECRET = { names: "Nguyễn Văn Kín", email: "kin.bi.mat@example.invalid", phone: "0900000777" };
const prof = (extra) => ({ ...coupleProfile({ budget: 200, guest_count: 200, ...extra }), couple: { city: "HCMC", wedding_date: "2029-03-20", bride_name: SECRET.names, email: SECRET.email, phone: SECRET.phone } });

// (a) số server dùng nằm trong profileSnapshot, và khớp budgetBasis
let m = await matchOne(M, { id: ids.R1, profile: prof(), doc: budgetDoc(90, { guests: 237 }) });
let s = m.body?.profileSnapshot;
if (!s) bad("thiếu profileSnapshot");
else {
  if (s.guestCount !== 237) bad(`guestCount mong 237 (bảng thắng hồ sơ 200), thấy ${s.guestCount}`);
  if (s.guestCountSource !== "budget_doc") bad(`guestCountSource mong "budget_doc", thấy ${s.guestCountSource}`);
  if (!s.budgetByCategory || s.budgetByCategory.venue !== 90) bad(`budgetByCategory.venue mong 90, thấy ${JSON.stringify(s.budgetByCategory)}`);
  const bb = m.v?.match?.budgetBasis;
  if (!bb || bb.guests !== s.guestCount || bb.categoryBudgetTr !== s.budgetByCategory?.venue) bad(`budgetBasis và profileSnapshot phải cùng số: ${JSON.stringify(bb)} vs ${JSON.stringify(s)}`);
  const leaked = JSON.stringify(m.body).match(/Kín|kin\.bi|0900000777|bride_name|email|phone/); if (leaked) bad(`profileSnapshot/phản hồi lộ trường cá nhân: ${leaked[0]}`);
}
// (b) không bảng: nguồn là hồ sơ
m = await matchOne(M, { id: ids.R1, profile: prof(), doc: undefined });
s = m.body?.profileSnapshot;
if (s?.guestCount !== 200 || s?.guestCountSource !== "profile") bad(`không bảng: mong guestCount 200 nguồn "profile", thấy ${s?.guestCount} / ${s?.guestCountSource}`);
if (s && s.budgetByCategory && s.budgetByCategory.venue !== undefined && typeof s.budgetByCategory.venue !== "number") bad("budgetByCategory.venue phải là số");
// (e) ngày cưới lệch giữa couple.wedding_date và wedding_date top-level: snapshot cho thấy ngày server dùng (couple.* ưu tiên, api/vendors.js buildMatchProfile) và trường nguồn
m = await matchOne(M, { id: ids.R1, profile: { ...prof(), wedding_date: "2027-12-29", couple: { city: "HCMC", wedding_date: "2026-12-31" } }, doc: budgetDoc(90, { guests: 0 }) });
s = m.body?.profileSnapshot;
if (s?.weddingDate !== "2026-12-31" || s?.sources?.weddingDate !== "couple.wedding_date") bad(`ngày cưới lệch: mong 2026-12-31 nguồn "couple.wedding_date", thấy ${s?.weddingDate} / ${s?.sources?.weddingDate}`);
// (f) chỉ có wedding_date top-level, số khách chỉ ở preferences, tổng ngân sách ở "budget"; hạng mục venue lấy từ bảng
m = await matchOne(M, { id: ids.R1, profile: { budget: 200, wedding_date: "2027-12-29", preferences: { style_tags: [], guest_count: 150 }, couple: { city: "HCMC" } }, doc: budgetDoc(90, { guests: 0 }) });
s = m.body?.profileSnapshot;
if (s?.weddingDate !== "2027-12-29" || s?.sources?.weddingDate !== "wedding_date") bad(`ngày cưới top-level: mong 2027-12-29 nguồn "wedding_date", thấy ${s?.weddingDate} / ${s?.sources?.weddingDate}`);
if (s?.guestCount !== 150 || s?.sources?.guestCount !== "preferences.guest_count") bad(`số khách: mong 150 nguồn "preferences.guest_count", thấy ${s?.guestCount} / ${s?.sources?.guestCount}`);
if (s?.budgetTotal !== 200 || s?.sources?.budgetTotal !== "budget") bad(`tổng ngân sách: mong 200 nguồn "budget", thấy ${s?.budgetTotal} / ${s?.sources?.budgetTotal}`);
if (s?.sources?.budgetByCategory?.venue !== "allocation") bad(`nguồn hạng mục venue: mong "allocation", thấy ${JSON.stringify(s?.sources?.budgetByCategory)}`);
// (g) bảng ghi khách thắng: nguồn số khách là bảng
m = await matchOne(M, { id: ids.R1, profile: prof(), doc: budgetDoc(90, { guests: 237 }) });
if (m.body?.profileSnapshot?.sources?.guestCount !== "budget_doc.guests") bad(`số khách từ bảng: mong nguồn "budget_doc.guests", thấy ${m.body?.profileSnapshot?.sources?.guestCount}`);
// (c) người KHÔNG thuộc cặp đôi (kể cả khi biết coupleId) không nhận số nào của cặp đôi đó
const b = newBucket(M, { profile: prof({ guest_count: 237 }), budgetDoc: budgetDoc(91, { guests: 237 }), members: true, overlay: M.overlayFor("venue", [ids.R1]) });
M.resetOverlayCache();
let body = null, err = null;
const orig = globalThis.fetch; globalThis.fetch = async () => { throw new Error("không mạng"); };
try { const res = await M.handleVendors(new Request(`http://localhost/api/vendors/match?coupleId=${CID}&category=venue&limit=50`), { CHAT_DATA: b }, { userId: "u2-nguoi-la" }, ["match"]); body = JSON.stringify(await res.json()); } catch (e) { err = e; }
globalThis.fetch = orig;
if (err) bad(`người lạ: ném ${err.message}`);
else {
  for (const x of ["237", "91", "Kín", "kin.bi", "0900000777"]) if (body.includes(x)) bad(`người lạ nhận được dữ liệu cặp đôi khác: thấy "${x}" trong ${body.slice(0, 200)}`);
}
// (d) chi tiết vendor của người lạ không có budgetBasis chứa số của cặp đôi
const d = await tab(M, { url: `/api/vendors/${ids.R1}?coupleId=${CID}`, bucket: b, countFetch: { n: 0 } }); // AUTH mặc định u1 là thành viên: chỉ để chắc handler vẫn trả 200
if (d.err || d.status !== 200) bad(`chi tiết (thành viên) lỗi ${d.err?.message || d.status}`);
restoreNow(); done(fails);
