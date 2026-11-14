// T-164 tiêu chí 4 (back): MỌI bề mặt trả giá của vendor đều mang cùng một nhãn, và không bề mặt nào trả giá mà thiếu nhãn.
// Pool đóng dấu theo fixtures/expected-prices.json (867 vendor, ngày giả 2026-11-14, không overlay). Bề mặt: POST /api/vendors/status (mọi id), GET /api/vendors/match (mọi hạng mục, phân trang hết),
// GET /api/vendors/:id (mẫu), chat (khối [VENDOR CANDIDATES] + matchMetadata + hướng dẫn trả lời; các hạng mục chat hiện ghép được), admin: GET /api/admin/vendors (hàng + bộ lọc nhãn), GET /api/admin/vendors/:id.
// Nhãn mong đợi: legacy_marry "Giá marry.vn · 06/2026"; estimate_category và estimate_default cùng "Ước tính theo hạng mục". Khối chat ghi nhãn trong ngoặc, chữ đầu viết thường: "Giá: 3-7tr (ước tính theo hạng mục)".
import { stampedBack, loadModules, load, setNow, restoreNow, EXPECTED, LABEL, lowerFirst, near } from "./_lib.mjs";
import { tab, chat, MSG_BY_CAT, coupleProfile, CID, AUTH } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => { if (fails.length < 40) fails.push(m); };
const NOW = "2026-11-14T08:00:00Z";
const dir = stampedBack();
const M = await loadModules(dir);
const wantOf = (id) => { const e = EXPECTED.vendors[id]; return e.priceSource === "legacy_marry" ? { basis: "legacy_marry", label: LABEL.legacy(e.priceAsOf.slice(5) + "/" + e.priceAsOf.slice(0, 4), false) } : { basis: e.priceSource, label: LABEL.estimate }; };
const labelOK = (where, v, id = v?.id) => {
  const w = wantOf(id);
  if (typeof v?.price_label !== "string" || !v.price_label) return bad(`${where} ${id}: có giá nhưng thiếu price_label`);
  if (v.price_label !== w.label) bad(`${where} ${id}: nhãn "${v.price_label}", mong "${w.label}"`);
  if (v.price_basis !== w.basis) bad(`${where} ${id}: price_basis ${v.price_basis}, mong ${w.basis}`);
};
setNow(NOW);
/* a. POST /api/vendors/status */
const allIds = Object.keys(EXPECTED.vendors);
for (let i = 0; i < allIds.length; i += 50) {
  const batch = allIds.slice(i, i + 50); M.resetOverlayCache();
  const res = await M.handleVendors(new Request("http://localhost/api/vendors/status", { method: "POST", body: JSON.stringify({ ids: batch }) }), { CHAT_DATA: new M.MemoryBucket() }, AUTH, ["status"]);
  const body = await res.json();
  for (const id of batch) { const s = body.vendors?.[id]; if (!s) { bad(`status ${id}: thiếu`); continue; } labelOK("status", s, id); if (s.price_source !== "estimated") bad(`status ${id}: price_source cũ phải giữ "estimated"`); }
}
/* b. GET /match mọi hạng mục, phân trang hết */
for (const cat of M.CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id)) {
  let off = 0, total = Infinity, seen = 0;
  while (off < total) {
    const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50&offset=${off}`, profile: coupleProfile({ budget: 300 }) });
    if (r.err || r.status !== 200) { bad(`match ${cat}: lỗi ${r.err?.message || r.status}`); break; }
    total = r.body.total; for (const v of r.body.vendors) { seen++; labelOK("match", v); const e = EXPECTED.vendors[v.id]; if (!(near(v.priceMin, e.priceMin) && near(v.priceMax, e.priceMax))) bad(`match ${v.id}: giá ${v.priceMin}-${v.priceMax} khác pool ${e.priceMin}-${e.priceMax}`); }
    if (!r.body.vendors.length) break; off += 50;
  }
  if (seen !== total && total !== Infinity) bad(`match ${cat}: đọc ${seen}/${total} vendor`);
}
/* c. GET /:id mẫu mỗi 23 vendor */
for (let i = 0; i < allIds.length; i += 23) { const r = await tab(M, { url: `/api/vendors/${allIds[i]}`, profile: coupleProfile() }); if (r.err || r.status !== 200) bad(`chi tiết ${allIds[i]}: lỗi`); else labelOK("chi tiết", r.body.vendor, allIds[i]); }
/* d. chat: mỗi hạng mục có vendor; khối prompt, metadata, hướng dẫn */
let chatCands = 0;
for (const [cat, msg] of Object.entries(MSG_BY_CAT)) {
  const r = await chat(M, { message: msg, profile: coupleProfile({ budget: 300 }) });
  if (r.err) { bad(`chat ${cat}: lỗi ${r.err.message}`); continue; }
  if (!r.md?.matches?.length) continue;   // hạng mục mà chat hiện không có ý định ghép (thiệp, nhẫn) hoặc không ứng viên: không có giá để gắn nhãn
  const lines = (r.sp || "").split("\n"); const giaLines = lines.filter((l) => /^\s+Giá:/.test(l));
  if (giaLines.length !== r.md.matches.length) bad(`chat ${cat}: ${giaLines.length} dòng Giá cho ${r.md.matches.length} ứng viên`);
  r.md.matches.forEach((m, i) => {
    chatCands++; labelOK("chat metadata", m, m.vendor_id);
    const w = wantOf(m.vendor_id);
    if (!(giaLines[i] || "").includes(`(${lowerFirst(w.label)})`)) bad(`chat ${cat} ứng viên ${i + 1}: dòng giá "${(giaLines[i] || "").trim()}" thiếu "(${lowerFirst(w.label)})"`);
    if (/^\s+Giá: Liên hệ/.test(giaLines[i] || "")) bad(`chat ${cat} ứng viên ${i + 1}: vendor có giá mà ghi "Liên hệ"`);
  });
  if (r.md.matches.length && !/kèm nhãn giá/.test(r.sp)) bad(`chat ${cat}: hướng dẫn trả lời thiếu câu yêu cầu nêu kèm nhãn giá ("kèm nhãn giá")`);
}
if (chatCands < 25) bad(`chat: chỉ ${chatCands} ứng viên (eval không đo đủ, mong >= 25 trên 5 hạng mục có ý định ghép)`);
restoreNow();
/* e. admin (worker thật, pool đóng dấu) */
{
  const B = await load(dir); const bucket = new B.MemoryBucket(); const env = B.makeEnv(bucket, { ADMIN_USER_IDS: "user_admin", CAPU_USER_IDS: "user_capu" });
  setNow(NOW);
  const get = (p) => B.call(env, "GET", p, { token: "dev:user_admin" });
  const rows = []; for (let off = 0; off < 900; off += 200) { const r = await get(`/api/admin/vendors?limit=200&offset=${off}`); if (r.status !== 200) { bad(`admin list: ${r.status}`); break; } rows.push(...r.json.vendors); }
  if (rows.length !== allIds.length) bad(`admin list: ${rows.length}/${allIds.length} hàng`);
  for (const row of rows) { if (row.priceMin == null && row.priceMax == null) continue; labelOK("admin hàng", row, row.id); }
  const cnt = async (label) => { const r = await get(`/api/admin/vendors?limit=1&label=${label}`); return r.status === 200 ? r.json.total : `HTTP ${r.status}`; };
  const c = EXPECTED.counts;
  if ((await cnt("estimate_category")) !== c.estimate_category + c.estimate_default) bad(`admin lọc estimate_category: ${await cnt("estimate_category")}, mong ${c.estimate_category + c.estimate_default} (gồm cả estimate_default vì cùng nhãn)`);
  if ((await cnt("legacy_marry")) !== c.legacy_marry) bad(`admin lọc legacy_marry: ${await cnt("legacy_marry")}, mong ${c.legacy_marry}`);
  if ((await cnt("estimated")) !== c.pool) bad(`admin lọc estimated phải giữ nghĩa cũ (mọi vendor chưa xác minh): ${await cnt("estimated")}, mong ${c.pool}`);
  if ((await cnt("verified")) !== 0) bad("admin lọc verified phải là 0 khi chưa xác minh vendor nào");
  const one = allIds.find((id) => EXPECTED.vendors[id].priceSource === "legacy_marry");
  const d = await get(`/api/admin/vendors/${one}`); if (d.status !== 200) bad(`admin chi tiết: ${d.status}`); else labelOK("admin chi tiết effective", d.json.effective, one);
  // overlay giá + xác minh đổi nhãn ở cả hàng admin
  const put = await B.call(env, "PUT", `/api/admin/vendors/${one}/override`, { token: "dev:user_admin", body: { priceMin: 7, priceMax: 9, price_verified: true } });
  if (put.status === 200) { const d2 = await get(`/api/admin/vendors/${one}`); if (d2.json?.effective?.price_label !== LABEL.verified || d2.json?.effective?.price_basis !== "admin_verified") bad(`admin sau xác minh: effective ${d2.json?.effective?.price_basis}/${d2.json?.effective?.price_label}`); }
  else bad("admin PUT override giá lỗi " + put.status);
  restoreNow();
}
if (fails.length && process.env.T164_ALL) console.log(fails.map((f) => "  - " + f).join("\n"));
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS");
