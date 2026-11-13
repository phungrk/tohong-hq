#!/usr/bin/env python3
"""Nguồn: T-140 (spec products/T-140-chat-ghep-vendor-computematches.md v2, "Bất biến đề xuất" INV-B; Hành vi 1, 2, 3; bản thay inv-034 do Spec Gate soạn
ở handoffs/T-140-D1.md, Chief of Staff ghi ADR), qua Spec Gate 2026-11-13 (spec-critic). THAY planner/vendor/images/inv-034 (vế dương của inv-034 dùng matcher giả
qua fetch, đường chat T-140 không còn gọi matcher). Nằm ở eval/T-140/bat-bien-cho-merge/ cho tới khi PR code bước 1 T-140 merge (ADR-028).
INV-B · Mọi ứng viên chat lấy từ pool hiện hành + overlay admin (thay inv-034):
 (i)   fetch bị cấm, có/không MATCHER_URL: buildChatContext không ném, không gọi fetch;
 (ii)  mỗi matchMetadata.matches[i].vendor_id thuộc lib/vendorPool.generated.js, tên dòng i của khối [VENDOR CANDIDATES] == tên pool, cùng thứ tự, cùng số lượng;
 (iii) overlay giữ đúng 3 photographer đủ điều kiện (ẩn mọi photographer khác) -> ứng viên đúng 3 vendor đó, không tên vendor ẩn nào lọt prompt;
 (iv)  trong (iii), một vendor có giá admin 7-9tr, price_verified -> price_range {7e6, 9e6} và dòng giá "7-9tr (giá đã xác minh)";
 (v)   với nhiều hạng mục/ngân sách: không vendor 0<rating<3,5; ứng viên có giá thì price_range == giá pool x 1e6 và min_vnd <= ngân sách
       (<= trunc(ngân sách x 1,2) khi relaxations_applied không rỗng); vendor không giá thì price_range null;
 (vi)  không ứng viên nào mang phone/contact.
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo. Chạy không tham số (python3 -I). In PASS / FAIL <lý do>."""
JS = r'''
const M = await mods(B);
const byId = new Map(M.POOL.map((v) => [v.id, v]));
const prof = (g) => ({ couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: [] }, ...(g ? { guest_count: g } : {}) });
const shape = (lb, r) => {
  if (r.err) { fails.push(`${lb}: ném ${r.err.message}`); return; }
  if (r.net) fails.push(`${lb}: gọi mạng ${r.net} lần`);
  if (r.ids.length !== r.cands.length) fails.push(`${lb}: matchMetadata ${r.ids.length} ứng viên, prompt ${r.cands.length}`);
  r.ids.forEach((id, i) => { const v = byId.get(id); if (!v) fails.push(`${lb}: id ngoài pool ${id}`); else if (r.cands[i]?.name !== v.name) fails.push(`${lb}: vị trí ${i + 1} prompt '${r.cands[i]?.name}' khác tên pool '${v.name}'`); });
  for (const m of r.md?.matches || []) if (m && ("phone" in m || "contact" in m || (m.vendor && ("phone" in m.vendor || "contact" in m.vendor)))) fails.push(`${lb}: ứng viên mang phone/contact`);
};
const msg = "Tìm photographer chụp ảnh cưới giúp anh chị 30tr";
shape("không MATCHER_URL", await chat(M, msg));
shape("có MATCHER_URL", await chat(M, msg, { env: { MATCHER_URL: "https://m.test", MATCHER_API_KEY: "k" } }));
// (iii)(iv)
const el = M.POOL.filter((v) => v.category === "photography" && eligible(v) && v.priceMin > 0 && v.priceMin <= 25 && M.POOL.filter((x) => x.name === v.name).length === 1);
if (el.length >= 3) {
  const [ver, o1, o2] = el, keep = new Set([ver.id, o1.id, o2.id]), ov = {};
  for (const v of M.POOL) if (v.category === "photography" && !keep.has(v.id)) ov[v.id] = { hidden: true, hidden_reason: "INV-B" };
  ov[ver.id] = { priceMin: 7, priceMax: 9, price_verified: true }; ov[o1.id] = {}; ov[o2.id] = {};
  const r = await chat(M, msg, { overlay: ov }); shape("overlay", r);
  if (JSON.stringify([...r.ids].sort()) !== JSON.stringify([...keep].sort())) fails.push(`overlay: ứng viên ${JSON.stringify(r.ids)}, mong đúng 3 vendor còn lại`);
  const hiddenNames = new Set(M.POOL.filter((v) => ov[v.id]?.hidden).map((v) => v.name));
  for (const c of r.cands) if (hiddenNames.has(c.name) && !r.ids.some((id) => byId.get(id)?.name === c.name)) fails.push(`tên vendor ẩn lọt prompt: ${c.name}`);
  const iv = r.ids.indexOf(ver.id), m = r.md?.matches?.[iv];
  if (iv >= 0 && !(m?.price_range?.min_vnd === 7e6 && m?.price_range?.max_vnd === 9e6)) fails.push(`giá admin chưa vào price_range: ${JSON.stringify(m?.price_range)}`);
  if (iv >= 0 && !/7-9tr \(giá đã xác minh\)/.test(r.cands[iv]?.price || "")) fails.push(`dòng giá admin: '${r.cands[iv]?.price}'`);
}
// (v)
const cases = [["Tìm photographer chụp ảnh cưới giúp anh chị 20tr", 20e6], ["Tìm photographer chụp ảnh cưới giúp anh chị 3tr", 3e6], ["Gợi ý makeup cô dâu 5tr", 5e6],
  ["Kiếm hoa cưới cầm tay 10tr", 10e6], ["Tìm áo cưới đẹp 8tr", 8e6], ["Tìm xe hoa 4tr", 4e6], ["Tìm nhà hàng tiệc cưới 100tr", 100e6, 150]];
for (const [m, b, g] of cases) {
  const r = await chat(M, m, { profile: prof(g) }); shape(m, r);
  const cap = r.md?.relaxations_applied?.length ? Math.trunc(b * 1.2) : b;
  for (const x of r.md?.matches || []) {
    const v = byId.get(x?.vendor_id); if (!v) continue;
    if (v.rating > 0 && v.rating < 3.5) fails.push(`${m}: ${v.id} rating ${v.rating}`);
    const has = v.priceMin > 0 || v.priceMax > 0;
    if (!has && x.price_range != null) fails.push(`${m}: ${v.id} không giá mà price_range ${JSON.stringify(x.price_range)}`);
    if (has && !(x.price_range && x.price_range.min_vnd === (v.priceMin || 0) * 1e6 && x.price_range.max_vnd === (v.priceMax || 0) * 1e6)) fails.push(`${m}: ${v.id} price_range ${JSON.stringify(x.price_range)} khác giá pool ${v.priceMin}-${v.priceMax}tr`);
    if (v.priceMin > 0 && v.priceMin * 1e6 > cap) fails.push(`${m}: ${v.id} giá từ ${v.priceMin}tr vượt trần ${cap}`);
  }
}
globalThis.OKMSG = "ứng viên chat đúng pool + overlay, không mạng, đúng ngân sách";
done();
'''
import os, shutil, subprocess, sys, tempfile

HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # tìm gốc tohong-hq ở mọi độ sâu (ADR-057/070)
    HQ = os.path.dirname(HQ)
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-back"))
          if c and os.path.isfile(os.path.join(c, "lib", "contextBuilder.js"))), None)
if not B:
    print("PASS chưa áp dụng (không thấy tohong-back)"); sys.exit(0)
PRE = r'''
import { pathToFileURL } from "url"; import path from "path";
import { mkdtempSync, cpSync, writeFileSync, symlinkSync, realpathSync, existsSync } from "fs";
const B = process.env.INV_BACK, TMP = process.env.INV_TMP;
const imp = (root, p) => import(pathToFileURL(path.join(root, p)).href);
// Bản chép repo back vào thư mục tạm với pool tự dựng (chỉ dùng khi cần pool điều khiển; repo thật không bị ghi).
function rootWithPool(pool) {
  const t = mkdtempSync(path.join(TMP, "p-"));
  for (const d of ["lib", "providers"]) if (existsSync(path.join(B, d))) cpSync(path.join(B, d), path.join(t, d), { recursive: true });
  cpSync(path.join(B, "test", "helpers"), path.join(t, "test", "helpers"), { recursive: true });
  cpSync(path.join(B, "package.json"), path.join(t, "package.json"));
  if (existsSync(path.join(B, "node_modules"))) symlinkSync(realpathSync(path.join(B, "node_modules")), path.join(t, "node_modules"));
  writeFileSync(path.join(t, "lib", "vendorPool.generated.js"), "export const GENERATED_VENDOR_POOL = " + JSON.stringify(pool) + ";\n");
  return t;
}
async function mods(root) {
  const [cc, mb, vo, pl, sc] = await Promise.all([imp(root, "lib/contextBuilder.js"), imp(root, "test/helpers/memoryBucket.js"),
    imp(root, "lib/vendorOverlay.js"), imp(root, "lib/vendorPool.generated.js"), imp(root, "lib/styleContract.js")]);
  return { buildChatContext: cc.buildChatContext, MemoryBucket: mb.MemoryBucket, resetOverlayCache: vo.resetOverlayCache, POOL: pl.GENERATED_VENDOR_POOL, satisfiedStyles: sc.satisfiedStyles };
}
// Gọi buildChatContext như production; mọi fetch bị cấm và bị đếm. profile = null: không có profile.yaml.
async function chat(M, message, { profile = { couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: [] } }, overlay = null, overlayRaw = null, env = {} } = {}) {
  const bucket = new M.MemoryBucket();
  if (profile !== null) bucket.data.set("data/couples/c1/profile.yaml", JSON.stringify(profile));
  if (overlay) bucket.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  if (overlayRaw !== null) bucket.data.set("data/admin/vendor_overrides.json", overlayRaw);
  M.resetOverlayCache();
  const of = globalThis.fetch, ow = console.warn; let net = 0, err = null, r = null;
  globalThis.fetch = async (u) => { net++; throw new Error("không được gọi mạng: " + u); };
  console.warn = () => {};
  try { r = await M.buildChatContext({ CHAT_DATA: bucket, ...env }, "c1", null, message, null, "u1"); } catch (e) { err = e; }
  finally { globalThis.fetch = of; console.warn = ow; }
  const sp = r?.systemPrompt ?? "";
  return { err, net, sp, md: r?.matchMetadata, ids: (r?.matchMetadata?.matches || []).map((m) => m?.vendor_id), cands: candidates(sp) };
}
function candidates(sp) {
  const i = sp.search(/^\[VENDOR CANDIDATES/m); if (i < 0) return [];
  const rest = sp.slice(i), e = rest.indexOf("\n\n## "), blk = e < 0 ? rest : rest.slice(0, e), out = [], L = blk.split("\n");
  for (let k = 0; k < L.length; k++) { const m = L[k].match(/^\d+\. (.+)$/); if (m) out.push({ name: m[1], price: ((L[k + 1] || "").match(/^\s+Giá: (.*)$/) || [])[1] ?? "" }); }
  return out;
}
const eligible = (v) => v.isVerified && !(v.rating > 0 && v.rating < 3.5) && v.city === "HCMC";
const fails = []; const done = () => { if (fails.length) { console.log("FAIL " + fails.slice(0, 6).join("; ")); process.exit(1); } console.log("PASS " + (globalThis.OKMSG || "")); };
'''
T = tempfile.mkdtemp(prefix="inv-t140-")
try:
    f = os.path.join(T, "inv.mjs"); open(f, "w", encoding="utf-8").write(PRE + JS)
    try:
        p = subprocess.run(["node", f], env=dict(os.environ, INV_BACK=B, INV_TMP=T), capture_output=True, text=True, timeout=600)
    except FileNotFoundError:
        print("FAIL không có node trên PATH"); sys.exit(1)
    out = (p.stdout.strip().splitlines() or [""])[-1]
    if p.returncode == 0 and out.startswith("PASS"):
        print(out); sys.exit(0)
    print(out if out.startswith("FAIL") else "FAIL " + (p.stderr.strip().splitlines() or ["node lỗi"])[-1]); sys.exit(1)
finally:
    shutil.rmtree(T, ignore_errors=True)
