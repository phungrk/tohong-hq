#!/usr/bin/env python3
"""Nguồn: T-140 (spec products/T-140-chat-ghep-vendor-computematches.md v2, "Bất biến đề xuất" INV-E; Hành vi 4 "Hồ sơ chấm điểm"; ADR-026 mục 1; handoffs/T-140-D1.md),
qua Spec Gate 2026-11-13 (spec-critic). Nằm ở eval/T-140/bat-bien-cho-merge/ cho tới khi PR code bước 1 T-140 merge (ADR-028).
INV-E · Chat chấm điểm bằng ngân sách hạng mục GỐC, gu không đẩy vendor vượt ngân sách lên top (ADR-026 trên đường chat JS). Pool tự dựng (bản chép tạm của back, khuôn
vendor lấy từ một photographer thật để đủ trường):
 (i)  cặp đôi gu korean, ngân sách 30tr; 6 vendor khớp gu giá 30-90tr rating 3,6 (10 đánh giá) + 6 vendor không khớp giá 18-21tr rating 4,9 (300 đánh giá)
      -> có 5 ứng viên và không ứng viên nào là vendor khớp gu giá 30-90tr;
 (ii) ngân sách 10tr; 7 vendor giống hệt nhau, không gu; 4 vendor giá 11-12tr đứng trước trong pool, 3 vendor giá 5-10tr đứng sau -> đã nới (budget +20%),
      5 ứng viên, 3 vendor giá 5-10tr đứng đầu (chấm bằng ngân sách đã nới thì bốn vendor kia bằng điểm và đứng trước).
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo (chép sang thư mục tạm). Chạy không tham số (python3 -I)."""
JS = r'''
const real = (await imp(B, "lib/vendorPool.generated.js")).GENERATED_VENDOR_POOL;
const tpl = real.find((v) => v.category === "photography" && v.isVerified && v.city === "HCMC") || real[0];
const V = (id, styles, pmin, pmax, rating, rc) => ({ ...tpl, id, name: "INVE " + id, category: "photography", city: "HCMC", isVerified: true, styles, tags: [], priceMin: pmin, priceMax: pmax, rating, reviewCount: rc });
const prof = (st) => ({ couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: st } });
{
  const ut = [["editorial"], [], ["luxury"], ["rustic"], ["natural"], ["simple"]], up = [18, 19, 19.5, 20, 20.5, 21];
  const pool = [...[0, 1, 2, 3, 4, 5].map((i) => V("invE_m" + i, ["korean"], 30, 90, 3.6, 10)), ...[0, 1, 2, 3, 4, 5].map((i) => V("invE_u" + i, ut[i], up[i], up[i], 4.9, 300))];
  const M = await mods(rootWithPool(pool));
  const r = await chat(M, "Tìm photographer chụp ảnh cưới giúp anh chị 30tr", { profile: prof(["korean"]) });
  if (r.err) fails.push("(i) ném " + r.err.message);
  if (r.ids.length !== 5) fails.push(`(i) ${r.ids.length} ứng viên, mong 5`);
  const bad = r.ids.filter((i) => String(i).startsWith("invE_m"));
  if (bad.length) fails.push(`(i) ${bad.length}/5 ứng viên là vendor khớp gu giá 30-90tr (ngân sách 30tr) dù còn 6 vendor đúng ngân sách`);
}
{
  const pool = [...[0, 1, 2, 3].map((i) => V("invE_r" + i, [], 11, 12, 0, 0)), ...[0, 1, 2].map((i) => V("invE_b" + i, [], 5, 10, 0, 0))];
  const M = await mods(rootWithPool(pool));
  const r = await chat(M, "Tìm photographer chụp ảnh cưới giúp anh chị 10tr", { profile: prof([]) });
  if (r.err) fails.push("(ii) ném " + r.err.message);
  if (JSON.stringify(r.md?.relaxations_applied) !== '["budget +20%"]') fails.push(`(ii) tín hiệu thử hỏng: relaxations_applied ${JSON.stringify(r.md?.relaxations_applied)}`);
  const f3 = r.ids.slice(0, 3);
  if (r.ids.length !== 5 || !["invE_b0", "invE_b1", "invE_b2"].every((x) => f3.includes(x))) fails.push(`(ii) 3 vendor trong ngân sách gốc không đứng đầu: ${JSON.stringify(r.ids)} (chấm bằng ngân sách đã nới?)`);
}
globalThis.OKMSG = "chấm điểm chat theo ngân sách gốc (ADR-026 trên đường JS)";
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
