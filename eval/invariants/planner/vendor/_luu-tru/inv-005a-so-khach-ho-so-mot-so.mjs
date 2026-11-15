// INV-005 (ADR-094, thăng từ T-165 adv-01): một số khách hiệu lực cho tab, chat, seed GET /budget.
// T-165 adv-01 (Code Gate, tầng 3). Spec T-164 H7.2: MỘT số khách hiệu lực cho cả back: budget.json.guests (nguyên > 0),
// "ngược lại guest_count của hồ sơ (đúng số GET /api/couples/:id/budget seed khi chưa có bảng)".
// Input phá: hồ sơ có HAI số khách khác nhau, top-level guest_count = 300 và preferences.guest_count = 150. Đây là trạng thái thật:
// onboarding (front App.jsx) ghi cả hai, rồi hành động chat cập nhật hồ sơ (lib/actionExecutor.js) chỉ ghi top-level guest_count.
// Không có bảng dự toán. Mong đợi: số GET /budget seed (300), số bàn tab Vendor, số bàn khối chat, chip "Đủ N khách" là cùng MỘT số.
// Eval 9 chỉ dùng hồ sơ có một trường guest_count nên không chạm ca này.
import { existsSync as __ex } from "fs"; import { fileURLToPath as __f, pathToFileURL as __u } from "url"; import __p from "path";
// ADR-070: tìm gốc HQ bằng cách đi lên tới scripts/gate.py.
let __hq = __p.dirname(__f(import.meta.url)); while (!__ex(__p.join(__hq, "scripts", "gate.py")) && __p.dirname(__hq) !== __hq) __hq = __p.dirname(__hq);
const __L = (t) => import(__u(__p.join(__hq, "eval", t, "_lib.mjs")).href);
const { stampedBack, loadModules, setNow, restoreNow, imp } = await __L("T-164");
const { tab, chat, coupleProfile, CID, AUTH } = await __L("T-159");
const fails = []; const bad = (m) => fails.push(m);
const R = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "legacy_marry", priceAsOf: "2026-06" });
const ids = {};
const dir = stampedBack({ mut: (arr) => {
  const tw = arr.filter((v) => v.category === "venue" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 1);
  Object.assign(tw[0], R(4, 4.6), { capacity: { min: 50, max: 500 } }); ids.R1 = tw[0].id;
} });
const M = await loadModules(dir);
const B = await imp(dir, "api/budget.js");
const ov = Object.fromEntries(M.POOL.filter((v) => v.category === "venue" && v.id !== ids.R1).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-165" }]));
setNow("2026-11-14T08:00:00Z");
const profile = coupleProfile({ budget: 300, guest_count: 300, budget_by_category: { venue: 200 }, preferences: { style_tags: [], guest_count: 150 } });

// 1. Số GET /budget seed khi chưa có bảng (định nghĩa của spec cho "guest_count của hồ sơ").
const bk = new M.MemoryBucket();
bk.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
bk.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
const seed = await (await B.handleBudget(new Request(`http://localhost/api/couples/${CID}/budget`), { CHAT_DATA: bk }, AUTH, CID, "")).json();
const G = Number(seed?.guests); const T = Math.ceil(G / 10);
if (!(G > 0)) bad(`GET /budget seed không có số khách: ${JSON.stringify(seed?.guests)}`);

// 2. Tab Vendor (match venue): chip "≈ 4.6tr/bàn × T bàn" và "Đủ G khách".
const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=venue&limit=50`, profile, overlay: ov });
const labels = (r.body?.vendors?.find((v) => v.id === ids.R1)?.match?.reasons || []).map((x) => x.label);
if (!labels.includes(`≈ 4.6tr/bàn × ${T} bàn`)) bad(`tab: GET /budget seed ${G} khách => mong chip "≈ 4.6tr/bàn × ${T} bàn", thấy ${JSON.stringify(labels)}`);
if (!labels.includes(`Đủ ${G} khách`)) bad(`tab: mong chip "Đủ ${G} khách" (số hiệu lực), thấy ${JSON.stringify(labels)}`);

// 3. Chat venue: dòng "Theo số bàn" cùng T.
const c = await chat(M, { message: "Tìm nhà hàng tiệc cưới giúp anh chị 200tr", profile, overlay: ov });
if (c.err || !c.ids.includes(ids.R1)) bad(`chat venue lỗi/không ra R1: ${c.err?.message || c.md?.error || c.ids.length}`);
else if (!new RegExp(`Theo số bàn: ≈ 4\\.6tr/bàn × ${T} bàn`).test(c.sp || "")) bad(`chat: mong "Theo số bàn: ≈ 4.6tr/bàn × ${T} bàn", thấy "${((c.sp || "").match(/Theo số bàn:[^\n]*/) || ["(không có)"])[0]}"`);
restoreNow();
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
