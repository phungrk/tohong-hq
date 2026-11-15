// T-172: khung chung cho eval. Chạy từ gốc tohong-hq; TOHONG_BACK_REPO mặc định ../tohong-back. Không mạng thật: fetch toàn cục là LLM giả.
// Dùng lại khung của T-164 (pool đóng dấu giá theo spec) và T-159 (chat/tab như production). Không sửa hai khung đó.
import { stampedBack, loadModules, imp, setNow, restoreNow } from "../T-164/_lib.mjs";
import { coupleProfile, CID, AUTH, MSG_BY_CAT, BUDGET_KEY, doc, chat } from "../T-159/_lib.mjs";
export { stampedBack, loadModules, imp, setNow, restoreNow, coupleProfile, CID, AUTH, MSG_BY_CAT, BUDGET_KEY, doc, chat };

/* Chữ nguồn giá không được xuất hiện trong bất cứ thứ gì gửi cho AI hay AI trả về (ADR-099/ADR-100):
   "Giá marry.vn · 06/2026", "Giá cũ marry.vn", "Ước tính theo hạng mục", "giá ước tính", "Giá đã xác minh", "giá đã xác minh",
   "Giá do Tơ Hồng cập nhật", mọi chữ "nhãn giá"/"nguồn giá", và dạng "· tháng/năm" của nguồn (· 06/2026). */
export const FORBID = [/marry/i, /ước tính/i, /xác minh/i, /nhãn giá/i, /nguồn giá/i, /do Tơ Hồng cập nhật/i, /giá cũ/i, /·\s*(0[1-9]|1[0-2])\/20\d\d/];
export const leaks = (t) => FORBID.filter((r) => r.test(String(t ?? ""))).map((r) => String(r.exec(String(t))?.[0]));
/* Cờ nội bộ giữ inv-003: không có chữ nguồn giá, chỉ nói chưa đủ cơ sở để khẳng định ngân sách. Chữ cố định (hợp đồng của prompt). */
export const FLAG_LINE = "   Ngân sách: chưa đủ cơ sở để khẳng định vendor này hợp hoặc nằm trong ngân sách";
export const GUIDE_LINE = '- Vendor có dòng "Ngân sách: chưa đủ cơ sở": không khẳng định vendor hợp hoặc nằm trong ngân sách của anh chị.';
export const WHY_FLAG = "Ngân sách: chưa đủ cơ sở để khẳng định vendor này hợp hoặc nằm trong ngân sách";

export const profileFor = (cat) => coupleProfile(cat === "venue" ? { budget: 300, guest_count: 200 } : { budget: 300 });
export const reporter = () => {
  const fails = []; const bad = (m) => { if (fails.length < 40) fails.push(m); };
  const end = () => { restoreNow(); if (fails.length && process.env.T172_ALL) console.log(fails.map((f) => "  - " + f).join("\n")); if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); } console.log("PASS"); };
  return { fails, bad, end };
};

/* ---------- pool thử: các "twin" (vendor giống hệt, chỉ khác giá/nguồn) của một hạng mục, mọi vendor khác của hạng mục bị ẩn ---------- */
export const EST = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "estimate_category", priceAsOf: "2026-06" });
export const REAL = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "legacy_marry", priceAsOf: "2026-06" });
export const NOSRC = (a, b) => ({ priceMin: a, priceMax: b, __noSource: true });   // pool cũ: không priceSource
/** specs: [{ cat, price, ov? }]. Trả { M, ids[], ovOf(cat) }. Mỗi spec lấy một twin riêng của hạng mục. */
export async function twinBack(specs) {
  const ids = []; const used = {};
  const dir = stampedBack({ mut: (arr) => {
    for (const s of specs) {
      const pool = arr.filter((v) => v.category === s.cat && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC" && !(used[v.id]));
      const v = pool[0]; used[v.id] = 1; ids.push(v.id);
      const { __noSource, ...p } = s.price; Object.assign(v, p);
      if (__noSource) { delete v.priceSource; delete v.priceAsOf; }
      if (s.cat === "venue") v.capacity = { min: 50, max: 500 };
    }
  } });
  const M = await loadModules(dir);
  const ov = {};
  for (const cat of new Set(specs.map((s) => s.cat))) for (const v of M.POOL) if (v.category === cat && !ids.includes(v.id)) ov[v.id] = { hidden: true, hidden_reason: "eval T-172" };
  specs.forEach((s, i) => { if (s.ov) ov[ids[i]] = s.ov; });
  return { M, dir, ids, ov, nameOf: (id) => M.POOL.find((v) => v.id === id).name };
}

/* ---------- đọc khối ứng viên trong systemPrompt ---------- */
export const candBlock = (sp) => { const i = (sp || "").indexOf("## Vendor matching candidates\n"); if (i < 0) return ""; const rest = sp.slice(i + 31); const j = rest.indexOf("\n## "); return j < 0 ? rest : rest.slice(0, j); };
/** systemPrompt trừ phần "## Hồ sơ cặp đôi" (chữ của người dùng, không phải của mã). */
export const promptWithoutProfile = (sp) => (sp || "").replace(/## Hồ sơ cặp đôi\n[\s\S]*?(?=\n## |$)/, "");
/** { name: [dòng của ứng viên] } theo khối. */
export function entries(block, names) {
  const lines = block.split("\n"); const out = {};
  for (const [id, name] of Object.entries(names)) { const i = lines.findIndex((l) => /^\d+\./.test(l.trim()) && l.includes(name)); out[id] = i < 0 ? null : lines.slice(i + 1, (() => { const k = lines.findIndex((l, x) => x > i && (/^\d+\./.test(l.trim()) || l.trim() === "" || /^(Lưu ý|Hướng dẫn)/.test(l))); return k < 0 ? lines.length : k; })()); }
  return out;
}
export const guidance = (block) => { const i = block.indexOf("Hướng dẫn trả lời:"); return i < 0 ? "" : block.slice(i); };

/* ---------- LLM giả (Anthropic SSE) ---------- */
const sse = (t) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: t } })}\n\n`;
/** reply(system, user) -> chuỗi. Trả { calls: [{system,user}], restore }. Mọi URL khác đều bị chặn. */
export function fakeLLM(reply) {
  const orig = globalThis.fetch, ol = console.log, oe = console.error, ow = console.warn; const calls = [];
  globalThis.fetch = async (u, init) => {
    if (!/anthropic/.test(String(u))) throw new Error("không được gọi mạng: " + u);
    const b = JSON.parse(String(init?.body || "{}")); const system = String(b.system || ""); const user = (b.messages || []).map((m) => String(m.content)).join("\n");
    calls.push({ system, user });
    return new Response(sse(reply(system, user)), { status: 200, headers: { "Content-Type": "text/event-stream" } });
  };
  console.log = () => {}; console.error = () => {}; console.warn = () => {};
  return { calls, restore: () => { globalThis.fetch = orig; console.log = ol; console.error = oe; console.warn = ow; } };
}
export const ENV = { CLAUDE_API_KEY: "fake-eval" };

/** Một lượt chat thật (handleCoupleChat, SSE) với LLM giả. Trả { text (lời AI), system (prompt gửi AI), calls }. */
export async function chatTurn(M, dirRef, { message, profile = coupleProfile({ budget: 300 }), overlay = null, reply }) {
  const cc = await imp(dirRef, "api/coupleChat.js");
  const b = new M.MemoryBucket();
  b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
  if (overlay) b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  M.resetOverlayCache();
  const llm = fakeLLM(reply);
  try {
    const res = await cc.handleCoupleChat(new Request("http://localhost/api/couples/c1/chat", { method: "POST", body: JSON.stringify({ message }) }), { CHAT_DATA: b, ...ENV }, AUTH, CID, { waitUntil: () => {} });
    const raw = await res.text(); let text = "";
    for (const m of raw.matchAll(/event: chunk\ndata: (.*)\n/g)) text += JSON.parse(m[1]).text;
    return { status: res.status, text, system: llm.calls[0]?.system || "", calls: llm.calls };
  } finally { llm.restore(); }
}
/** LLM giả của chat: "học trò ngoan" — trích lại mọi dòng giá của khối ứng viên và mọi dòng hướng dẫn nhắc tới giá, y như cách một mô hình làm theo prompt. */
export const chatEcho = (system) => system.split("\n").filter((l) => /^\s+Giá:/.test(l) || (/^- /.test(l) && /giá/i.test(l))).join("\n");

/** GET /api/vendors/:id?coupleId=c1 với LLM giả. */
export async function openDetail(M, id, { overlay = null, profile = coupleProfile({ budget: 300 }), budgetDoc = null, bucket = null, reply }) {
  const b = bucket || new M.MemoryBucket();
  if (!bucket) {
    b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
    b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
    if (budgetDoc) b.data.set(BUDGET_KEY, JSON.stringify(budgetDoc));
    if (overlay) b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  }
  M.resetOverlayCache();
  const llm = fakeLLM(reply);
  try {
    const res = await M.handleVendors(new Request(`http://localhost/api/vendors/${id}?coupleId=${CID}`), { CHAT_DATA: b, ...ENV }, AUTH, [id]);
    const body = await res.json();
    return { status: res.status, body, calls: llm.calls, bucket: b };
  } finally { llm.restore(); }
}
/** LLM giả của câu "vì sao hợp": nhắc lại nguyên dòng "Nhà cung cấp: …" của prompt (học trò ngoan: lặp lại giá kèm mọi ngoặc nó thấy). */
export const whyEcho = (system, user) => "Em thấy " + (user.split("\n").find((l) => l.startsWith("Nhà cung cấp:")) || "").replace(/^Nhà cung cấp:\s*/, "") + ".";
