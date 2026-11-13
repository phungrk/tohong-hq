#!/usr/bin/env python3
"""Nguồn: T-140 (spec products/T-140-chat-ghep-vendor-computematches.md v2, "Bất biến đề xuất" INV-A; Hành vi 1; ADR-077 mục 1), qua Spec Gate 2026-11-13 (spec-critic).
Nằm ở eval/T-140/bat-bien-cho-merge/ cho tới khi PR code bước 1 của T-140 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào
eval/invariants/planner/vendor/images/.
INV-A · Đường chat dựng ứng viên KHÔNG gọi mạng và có ứng viên: buildChatContext với mọi fetch bị thay bằng hàm ném lỗi, cặp đôi HCMC,
"Tìm photographer chụp ảnh cưới giúp anh chị 30tr", có hoặc không có MATCHER_URL/MATCHER_API_KEY trong env -> không ném, không gọi fetch lần nào,
khối [VENDOR CANDIDATES] có 1..5 vendor, và hai lần (có/không MATCHER_URL) cho cùng danh sách. Với 5 hạng mục chat còn lại (áo, makeup, hoa, xe, nhà hàng)
cũng không gọi fetch, không ném (không đòi có ứng viên: pool có thể thiếu hạng mục).
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo. Chạy không tham số (python3 -I). In PASS / FAIL <lý do>."""
JS = r'''
const M = await mods(B);
const msg = "Tìm photographer chụp ảnh cưới giúp anh chị 30tr";
const a = await chat(M, msg), b = await chat(M, msg, { env: { MATCHER_URL: "https://m.test", MATCHER_API_KEY: "k" } });
for (const [lb, r] of [["không MATCHER_URL", a], ["có MATCHER_URL", b]]) {
  if (r.err) fails.push(`${lb}: buildChatContext ném: ${r.err.message}`);
  if (r.net) fails.push(`${lb}: gọi mạng ${r.net} lần`);
  if (r.cands.length < 1 || r.cands.length > 5) fails.push(`${lb}: khối ứng viên có ${r.cands.length} vendor (mong 1..5)`);
}
if (JSON.stringify(a.ids) !== JSON.stringify(b.ids)) fails.push("có/không MATCHER_URL cho danh sách khác nhau");
const other = [["Tìm áo cưới đẹp 20tr", null], ["Gợi ý makeup cô dâu 10tr", null], ["Kiếm hoa cưới cầm tay 10tr", null], ["Tìm xe hoa 10tr", null], ["Tìm nhà hàng tiệc cưới 300tr", 150]];
for (const [m, g] of other) {
  const r = await chat(M, m, { profile: { couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: [] }, ...(g ? { guest_count: g } : {}) }, env: { MATCHER_URL: "https://m.test", MATCHER_API_KEY: "k" } });
  if (r.err) fails.push(`'${m}': ném ${r.err.message}`);
  if (r.net) fails.push(`'${m}': gọi mạng ${r.net} lần`);
}
globalThis.OKMSG = `chat có ${a.cands.length} ứng viên, không gọi mạng`;
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
