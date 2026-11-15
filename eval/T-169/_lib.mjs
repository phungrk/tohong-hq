// T-169: khung chung cho eval (chạy từ gốc tohong-hq; TOHONG_BACK_REPO mặc định ../tohong-back). Không mạng, không Google, không ghi repo thật, không dữ liệu người dùng thật.
// Chép back sang thư mục tạm (pool đóng dấu giá như T-167), R2 giả trong bộ nhớ. CHỈ gọi hành vi công khai của back:
//   routeCouples (GET/PATCH /api/couples/:id, /summary, /budget, /guests, /timeline), handleVendors (match, chi tiết), buildChatContext (một lượt chat),
//   executeAction (hành động chat update_profile), handleBudget (GET/PUT). Không import hàm nội bộ của cách cài đặt.
import { setNow, restoreNow, stampedBack, loadModules, imp, NOW as _n } from "./_deps.mjs";
export { setNow, restoreNow };
export const CID = "c1", UID = "u1", AUTH = { userId: UID };
export const NOW = "2026-11-14T08:00:00Z";
export const KEY = { profile: `data/couples/${CID}/profile.yaml`, budget: `data/couples/${CID}/budget.json`, guests: `data/couples/${CID}/guests.json`, members: `data/couples/${CID}/members.json` };
export const ids = {};

export async function setup() {
  const dir = stampedBack({ mut: (arr) => {
    const pick = (cat, n, city = "HCMC") => arr.filter((v) => v.category === cat && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, n);
    const [r1, hn] = pick("venue", 2);
    Object.assign(r1, { priceMin: 3.9, priceMax: 3.9, priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 } }); ids.R1 = r1.id;
    Object.assign(hn, { city: "Hà Nội", priceMin: 3.9, priceMax: 3.9, priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 } }); ids.HN = hn.id; // vendor Hà Nội duy nhất
  } });
  const M = await loadModules(dir);
  M.dir = dir;
  const [couples, summary, guests, timeline, budget, actions, fstore] = await Promise.all(["api/couples.js", "api/summary.js", "api/guests.js", "api/timeline.js", "api/budget.js", "lib/actionExecutor.js", "lib/fileStore.js"].map((p) => imp(dir, p)));
  Object.assign(M, { makeStore: fstore.makeStore, routeCouples: couples.routeCouples, handleBudget: budget.handleBudget, executeAction: actions.executeAction });
  M.hideAllBut = (keep) => Object.fromEntries(M.POOL.filter((v) => v.category === "venue" && !keep.includes(v.id)).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-169" }]));
  setNow(NOW);
  return M;
}

/** R2 giả có sẵn một cặp đôi c1, người dùng u1 là owner. `profile` là object (lưu thành YAML-JSON như các eval trước), `budget` / `guests` tuỳ chọn. */
export function bucket(M, { profile, budget, guests, overlay } = {}) {
  const b = new M.MemoryBucket();
  b.data.set(KEY.profile, JSON.stringify(profile));
  b.data.set(KEY.members, JSON.stringify([{ user_id: UID, email: "a@example.invalid", role: "owner" }]));
  if (budget !== undefined) b.data.set(KEY.budget, JSON.stringify(budget));
  if (guests !== undefined) b.data.set(KEY.guests, JSON.stringify(guests));
  if (overlay) b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  return b;
}
// Đọc dữ liệu ĐÃ LƯU trong R2 giả (để kiểm "không mất dữ liệu" và trường nào đã bị ghi).
export const storedProfile = async (M, b) => (await M.makeStore({ CHAT_DATA: b }).getYaml(KEY.profile))?.value ?? null;
export const storedBudget = async (M, b) => (await M.makeStore({ CHAT_DATA: b }).getJson(KEY.budget))?.value ?? null;

// Chạy một việc không được gọi mạng; fetch bị chặn, console im.
async function guarded(fn) {
  const f = globalThis.fetch, w = console.warn, l = console.log, e = console.error; let net = 0;
  globalThis.fetch = async (u) => { net++; throw new Error("không được gọi mạng: " + u); }; console.warn = () => {}; console.log = () => {}; console.error = () => {};
  try { return await fn(); } finally { globalThis.fetch = f; console.warn = w; console.log = l; console.error = e; }
}
const parse = async (res) => { try { return await res.json(); } catch { return null; } };

/** Gọi route /api/couples/:id/<tail> như production. Trả { status, body }. */
export async function api(M, b, method, tail = "", body) {
  const segs = [CID, ...tail.split("/").filter(Boolean)];
  M.resetOverlayCache();
  return guarded(async () => {
    try {
      const req = new Request(`http://localhost/api/couples/${segs.join("/")}`, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
      const res = await M.routeCouples(req, { CHAT_DATA: b }, AUTH, {}, segs);
      return { status: res.status, body: await parse(res) };
    } catch (err) { return { status: err?.status ?? 0, body: null, err }; }
  });
}
/** GET /api/vendors/match (tab Vendor). */
export async function match(M, b, category = "venue") {
  M.resetOverlayCache();
  return guarded(async () => {
    try { const u = new URL(`http://localhost/api/vendors/match?coupleId=${CID}&category=${category}&limit=50`);
      const res = await M.handleVendors(new Request(u), { CHAT_DATA: b }, AUTH, ["match"]); return { status: res.status, body: await parse(res) };
    } catch (err) { return { status: 0, body: null, err }; }
  });
}
/** Một lượt chat có ý định ghép. Trả { sp, md, ids, block } với block = đối tượng JSON trong khối "## Hồ sơ cặp đôi" của prompt hệ thống. */
export async function chat(M, b, message = "Tìm nhà hàng tiệc cưới giúp anh chị 2000tr") {
  M.resetOverlayCache();
  return guarded(async () => {
    try {
      const r = await M.buildChatContext({ CHAT_DATA: b }, CID, null, message, null, UID);
      const sp = r.systemPrompt || "";
      const i = sp.indexOf("## Hồ sơ cặp đôi\n"); let block = null;
      if (i >= 0) { const s = sp.indexOf("{", i); let depth = 0, e = s; for (; e < sp.length; e++) { if (sp[e] === "{") depth++; else if (sp[e] === "}" && --depth === 0) break; } try { block = JSON.parse(sp.slice(s, e + 1)); } catch { /* */ } }
      return { sp, md: r.matchMetadata, ids: (r.matchMetadata?.matches || []).map((m) => m.vendor_id), block };
    } catch (err) { return { err, sp: "", md: null, ids: [], block: null }; }
  });
}
/** Hành động chat update_profile, như khi AI trả khối ACTION. */
export async function chatAction(M, b, action) { return guarded(async () => { try { return await M.executeAction({ type: "update_profile", ...action }, { CHAT_DATA: b }, CID); } catch (err) { return { success: false, err }; } }); }

export function done(fails) { restoreNow(); if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); } console.log("PASS"); }

/** Đọc MỌI bề mặt của một cặp đôi trong một lần; mỗi bề mặt trả đúng thứ người dùng/AI nhận. Không ghi gì (người gọi kiểm putLog nếu cần). */
export async function readAll(M, b) {
  // tuần tự (guarded thay/khôi phục fetch và console toàn cục)
  const prof = await api(M, b, "GET", ""), summ = await api(M, b, "GET", "summary"), gst = await api(M, b, "GET", "guests"), bud = await api(M, b, "GET", "budget"), tab = await match(M, b), ch = await chat(M, b);
  const snap = tab.body?.profileSnapshot ?? null;
  const chip = (tab.body?.vendors || []).find((v) => v.id === ids.R1 || v.id === ids.HN)?.match?.reasons?.map((r) => r.label).find((l) => /^Còn lịch/.test(l)) ?? null;
  const tables = Number(/× (\d+) bàn/.exec(ch.sp || "")?.[1]) || null;
  return {
    profile: prof.body?.profile ?? null, summary: summ.body, guestsDoc: gst.body, budget: bud.body, snap, chip, chatBlock: ch.block, chatIds: ch.ids, tabIds: (tab.body?.vendors || []).map((v) => v.id), tables,
    err: [prof, summ, gst, bud, tab, ch].map((r, i) => r.err ? ["profile", "summary", "guests", "budget", "match", "chat"][i] + ": " + r.err.message : (r.status && r.status >= 400 ? ["profile", "summary", "guests", "budget", "match", "chat"][i] + " HTTP " + r.status : null)).filter(Boolean),
  };
}
// Độc lập với cách cài đặt: chip "Còn lịch d.m" theo ngày kỳ vọng.
export const chipOf = (iso) => { const d = new Date(iso); return `Còn lịch ${d.getDate()}.${d.getMonth() + 1}`; };
export const daysLeftOf = (iso) => Math.ceil((new Date(iso) - new Date(NOW)) / 86400000);
/** Gom lỗi so sánh: eq(nhãn, thật, mong). So sánh sâu bằng JSON. */
export function checker() { const fails = []; const eq = (label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${label}: mong ${JSON.stringify(want)}, thấy ${JSON.stringify(got)}`); }; return { fails, eq }; }
/** Hồ sơ "lệch" mẫu: mỗi thông tin nằm ở nhiều trường với giá trị khác nhau. Không dữ liệu thật (tên giả, @example.invalid). */
export const LECH = () => ({
  couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-31", guest_count: 100 },
  wedding_date: "2027-12-29", guest_count: 200, budget: 300,
  families: { bride_region: "Nam", groom_region: "Bac" },
  preferences: { style_tags: ["korean"], guest_count: 150, dealbreakers: ["cheesy"] },
  style_tags: ["rustic"],
  shortlisted_vendor_ids: ["vx1", "vx2"], excluded_vendor_ids: ["vx9"], x_ghi_chu_la: { giu: "nguyen" },
});
export const BANG = (o = {}) => ({ categories: [{ id: "venue", name: "Tiệc cưới", allocated_tr: 150, items: [{ id: "i1", name: "Cọc", amt: 5 }] }], total_tr: 500, guests: 0, mung_tr: 7, updated_at: "2026-11-01T00:00:00.000Z", ...o });

/* ---- khẳng định theo bề mặt (mỗi hàm: một thông tin, mọi bề mặt phải bằng cùng một giá trị kỳ vọng) ---- */
export function dateAll(eq, tag, r, iso) {
  const d10 = (x) => (x == null ? null : String(x).slice(0, 10));
  eq(`${tag} hồ sơ (GET /couples/:id) couple.wedding_date`, d10(r.profile?.couple?.wedding_date), iso);
  eq(`${tag} màn hồ sơ (summary) wedding_date`, d10(r.summary?.profile?.wedding_date), iso);
  eq(`${tag} màn hồ sơ (summary) days_left`, r.summary?.days_left ?? null, iso ? daysLeftOf(iso) : null);
  eq(`${tag} ghép vendor (profileSnapshot) weddingDate`, d10(r.snap?.weddingDate), iso);
  eq(`${tag} chip "Còn lịch" của thẻ vendor`, r.chip, iso ? chipOf(iso) : null);
  eq(`${tag} chat: couple.wedding_date trong khối hồ sơ`, d10(r.chatBlock?.couple?.wedding_date), iso);
  if (r.chatBlock && "wedding_date" in r.chatBlock) eq(`${tag} chat: wedding_date top-level trong khối hồ sơ`, d10(r.chatBlock.wedding_date), iso);
}
// g = số hiển thị (hồ sơ, Khách mời, summary, GET /budget); gm = số dùng để GHÉP (profileSnapshot, số bàn, khối hồ sơ chat), mặc định = g.
export function guestsAll(eq, tag, r, g, gm = g) {
  const n = g ?? 0, nm = gm ?? 0;
  eq(`${tag} hồ sơ guest_count`, r.profile?.guest_count ?? 0, n);
  eq(`${tag} màn Khách mời (GET /guests) capacity`, r.guestsDoc?.capacity ?? 0, n);
  eq(`${tag} màn hồ sơ (summary) guests.capacity`, r.summary?.guests?.capacity ?? 0, n);
  eq(`${tag} màn Ngân sách (GET /budget) guests`, r.budget?.guests ?? 0, n);
  eq(`${tag} ghép vendor (profileSnapshot) guestCount`, r.snap?.guestCount ?? null, gm ?? null);
  eq(`${tag} chat: số bàn trong khối ứng viên`, r.tables, gm ? Math.ceil(gm / 10) : null);
  eq(`${tag} chat: guest_count trong khối hồ sơ`, r.chatBlock?.guest_count ?? 0, nm);
  if (r.chatBlock?.preferences && "guest_count" in r.chatBlock.preferences) eq(`${tag} chat: preferences.guest_count trong khối hồ sơ`, r.chatBlock.preferences.guest_count ?? 0, nm);
  if (r.chatBlock?.couple && "guest_count" in r.chatBlock.couple) eq(`${tag} chat: couple.guest_count trong khối hồ sơ`, r.chatBlock.couple.guest_count ?? 0, nm);
}
// tr = tổng hiển thị (hồ sơ, summary, GET /budget); trm = tổng dùng để GHÉP (profileSnapshot, khối hồ sơ chat), mặc định = tr. Bảng chỉ có total_tr: hiển thị theo bảng, ghép như cũ (không ngân sách).
export function budgetAll(eq, tag, r, tr, trm = tr) {
  const n = tr ?? 0, nm = trm ?? 0;
  eq(`${tag} hồ sơ budget`, r.profile?.budget ?? 0, n);
  eq(`${tag} màn hồ sơ (summary) budget.total_tr`, r.summary?.budget?.total_tr ?? 0, n);
  eq(`${tag} màn Ngân sách (GET /budget) total_tr`, r.budget?.total_tr ?? 0, n);
  eq(`${tag} ghép vendor (profileSnapshot) budgetTotal`, r.snap?.budgetTotal ?? null, trm ?? null);
  eq(`${tag} chat: budget trong khối hồ sơ`, r.chatBlock?.budget ?? 0, nm);
}
