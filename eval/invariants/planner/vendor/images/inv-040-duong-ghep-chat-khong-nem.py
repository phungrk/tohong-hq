#!/usr/bin/env python3
"""Nguồn: T-140 (spec products/T-140-chat-ghep-vendor-computematches.md v2, "Bất biến đề xuất" INV-D; Hành vi 2 "không ném lỗi", 6 "Lỗi bộ ghép"; thay vế
"phần tử rác không làm ném" của inv-034), qua Spec Gate 2026-11-13 (spec-critic). Nằm ở eval/T-140/bat-bien-cho-merge/ cho tới khi PR code bước 1 T-140 merge (ADR-028).
INV-D · Đường ghép của chat không bao giờ ném: buildChatContext với đầu vào xấu (không có profile.yaml; ngân sách 0 / âm / chữ / cực lớn; thành phố lạ; gu, dealbreaker
không phải mảng hoặc chứa phần tử không phải chuỗi; nhà hàng thiếu số khách; overlay ẩn mọi vendor; overlay JSON hỏng; overlay có giá rác) trả systemPrompt là chuỗi,
không gọi fetch, khối [VENDOR CANDIDATES] có <= 5 vendor, và câu A9 ("Vendor: chỉ được giới thiệu hoặc đề xuất vendor cụ thể có trong khối [VENDOR CANDIDATES]") còn nguyên.
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo. Chạy không tham số (python3 -I). In PASS / FAIL <lý do>."""
JS = r'''
const M = await mods(B);
const A9 = "Vendor: chỉ được giới thiệu hoặc đề xuất vendor cụ thể có trong khối [VENDOR CANDIDATES] của lượt này";
const P = (x = {}) => ({ couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: [] }, ...x });
const allHidden = Object.fromEntries(M.POOL.map((v) => [v.id, { hidden: true }]));
const junkPrice = Object.fromEntries(M.POOL.filter((v) => v.category === "photography").map((v, i) => [v.id, i % 3 === 0 ? { priceMin: -5, priceMax: "abc" } : i % 3 === 1 ? { priceMin: 1e300, priceMax: null } : { priceMin: 0, priceMax: 0, price_verified: "yes" }]));
const ph = (b) => `Tìm photographer chụp ảnh cưới giúp anh chị ${b}`;
const cases = [
  ["không profile.yaml", ph("30tr"), { profile: null }],
  ["ngân sách 0", ph("0tr"), {}], ["ngân sách âm", ph("-5tr"), {}], ["ngân sách chữ", ph("vài chục tr"), {}],
  ["ngân sách cực lớn", ph("999999999999tr"), {}], ["ngân sách lẻ nhỏ", ph("0,001tr"), {}],
  ["thành phố lạ", ph("30tr"), { profile: P({ couple: { city: "Atlantis ??", wedding_date: "x" } }) }],
  ["profile rác", ph("30tr"), { profile: { couple: null, preferences: "abc", guest_count: "nhiều" } }],
  ["gu không phải mảng", ph("30tr"), { profile: P({ preferences: { style_tags: "korean", dealbreakers: "luxury" } }) }],
  ["gu phần tử rác", ph("30tr"), { profile: P({ preferences: { style_tags: [null, 7, {}, " "], dealbreakers: [null, 3, ["x"]] } }) }],
  ["nhà hàng thiếu khách", "Tìm nhà hàng tiệc cưới 300tr", {}],
  ["overlay ẩn hết", ph("30tr"), { overlay: allHidden }],
  ["overlay JSON hỏng", ph("30tr"), { overlayRaw: "{không phải json" }],
  ["overlay giá rác", ph("30tr"), { overlay: junkPrice }],
];
for (const [lb, m, o] of cases) {
  const r = await chat(M, m, o);
  if (r.err) { fails.push(`${lb}: ném ${r.err.message}`); continue; }
  if (typeof r.sp !== "string" || !r.sp) fails.push(`${lb}: systemPrompt không phải chuỗi`);
  if (r.net) fails.push(`${lb}: gọi mạng ${r.net} lần`);
  if (r.cands.length > 5) fails.push(`${lb}: ${r.cands.length} ứng viên`);
  if (!r.sp.includes(A9)) fails.push(`${lb}: mất câu A9`);
}
globalThis.OKMSG = `${cases.length} đầu vào xấu, không ném`;
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
