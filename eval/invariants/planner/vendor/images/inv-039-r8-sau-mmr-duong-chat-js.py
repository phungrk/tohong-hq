#!/usr/bin/env python3
"""Nguồn: T-140 (spec products/T-140-chat-ghep-vendor-computematches.md v2, "Bất biến đề xuất" INV-C; Hành vi 4 "R8 (T-072) giữ nguyên"; ADR-026 mục 3),
qua Spec Gate 2026-11-13 (spec-critic). Nằm ở eval/T-140/bat-bien-cho-merge/ cho tới khi PR code bước 1 T-140 merge (ADR-028).
INV-C · R8 sau MMR trên đường chat JS: với pool hiện hành, 6 hạng mục chat x 5 bộ gu x 3 ngân sách, trong danh sách ứng viên (matchMetadata.matches theo thứ tự)
không có cặp (khớp gu, không khớp gu) nào ở vị trí i<j mà final_score_i < final_score_j; bằng điểm thì vendor khớp gu đứng trên.
"Khớp gu" = satisfiedStyles(gu cặp đôi, tag vendor) của lib/styleContract.js không rỗng. (inv-003 mục (ii) chỉ phủ đường chat Python, nằm ở vùng matching.)
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo. Chạy không tham số (python3 -I). In PASS / FAIL <lý do>."""
JS = r'''
const M = await mods(B);
const byId = new Map(M.POOL.map((v) => [v.id, v]));
const MSG = { photography: (b) => `Tìm photographer chụp ảnh cưới giúp anh chị ${b}tr`, attire: (b) => `Tìm áo cưới đẹp ${b}tr`, makeup: (b) => `Gợi ý makeup cô dâu ${b}tr`,
  decor: (b) => `Kiếm hoa cưới cầm tay ${b}tr`, transport: (b) => `Tìm xe hoa ${b}tr`, venue: (b) => `Tìm nhà hàng tiệc cưới ${b * 10}tr` };
let n = 0, pairs = 0;
for (const cat of Object.keys(MSG)) for (const st of [["korean"], ["luxury", "modern"], ["rustic"], ["minimalist", "traditional"], ["  KOREAN ", "Soft"]]) for (const b of [3, 15, 50]) {
  const r = await chat(M, MSG[cat](b), { profile: { couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: st }, ...(cat === "venue" ? { guest_count: 150 } : {}) } });
  if (r.err) { fails.push(`${cat} ${b} [${st}]: ném ${r.err.message}`); continue; }
  const ms = r.md?.matches || []; n++;
  const grp = ms.map((m) => M.satisfiedStyles(st, byId.get(m.vendor_id)?.styles || m.style_tags || []).length > 0);
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    if (grp[i] === grp[j]) continue; pairs++;
    if (ms[i].final_score < ms[j].final_score || (ms[i].final_score === ms[j].final_score && !grp[i])) fails.push(`${cat} ${b} [${st}]: R8 đảo (vị trí ${i + 1} ${ms[i].final_score}${grp[i] ? " khớp" : ""} vs ${j + 1} ${ms[j].final_score}${grp[j] ? " khớp" : ""})`);
  }
}
globalThis.OKMSG = `R8 giữ trên ${n} lượt chat, ${pairs} cặp khác nhóm`;
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
