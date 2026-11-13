// T-143 adv-01 (adversary, tầng 3): tab Vendor qua ĐƯỜNG HTTP (api/vendors.js handleVendors) không đổi một byte so với main trước T-143.
// Eval 7 chỉ gọi computeMatches; adv này phủ thêm: buildMatchProfile của api/vendors.js, tham số query (limit/offset/minScore rác),
// /categories, /:id, POST /status, có overlay admin (ẩn + đổi giá), hồ sơ cặp đôi thật trong bucket.
// Pool đông cứng eval/T-140/fixtures/pool-frozen.json. Golden: fixtures/adv-01-golden.json chụp từ tohong-back main @ 77ea5e8 (2026-11-13).
// Chạy: bash eval/T-143/adv-01-tab-http-khong-doi.sh  (--make-golden để chụp lại; chỉ adversary dùng, trên main).
import { existsSync, mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from "fs";
import { tmpdir } from "os"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url"; import { createHash } from "crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url)); const HQ = path.resolve(HERE, "..", "..", "..");
const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].find((c) => c && existsSync(path.join(c, "api", "vendors.js")));
if (!BACK) { console.log("PASS chưa áp dụng (thiếu tohong-back)"); process.exit(0); }
const FROZEN = JSON.parse(readFileSync(path.join(HQ, "eval", "T-140", "fixtures", "pool-frozen.json"), "utf8")).vendors;
const t = mkdtempSync(path.join(tmpdir(), "t143a1-"));
process.on("exit", () => rmSync(t, { recursive: true, force: true }));
for (const d of ["lib", "providers", "api"]) if (existsSync(path.join(BACK, d))) cpSync(path.join(BACK, d), path.join(t, d), { recursive: true });
cpSync(path.join(BACK, "test", "helpers"), path.join(t, "test", "helpers"), { recursive: true });
cpSync(path.join(BACK, "package.json"), path.join(t, "package.json"));
symlinkSync(realpathSync(path.join(BACK, "node_modules")), path.join(t, "node_modules"));
writeFileSync(path.join(t, "lib", "vendorPool.generated.js"), "export const GENERATED_VENDOR_POOL = " + JSON.stringify(FROZEN) + ";\n");
const imp = (p) => import(pathToFileURL(path.join(t, p)).href);
const { handleVendors } = await imp("api/vendors.js");
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const { resetOverlayCache } = await imp("lib/vendorOverlay.js");

const CID = "couple_20260604_q4m3st"; const AUTH = { userId: "user_dev" };
const byCat = (c) => FROZEN.filter((v) => v.category === c);
const ph = byCat("photography");
const OVERLAY = { seq: 3, vendors: { [ph[0].id]: { hidden: true, hidden_reason: "adv" }, [ph[1].id]: { priceMin: 7, priceMax: 9, price_verified: true }, [byCat("makeup")[0].id]: { hidden: true } } };
const PROFILES = {
  none: null,
  full: { couple: { city: "TP.HCM", wedding_date: "2029-03-20" }, budget: 500, guest_count: 200, preferences: { style_tags: ["korean", "minimalist"] } },
  hanoi: { couple: { city: "Hà Nội", wedding_date: "2029-12-01" }, budget: 300, preferences: { style_tags: ["vintage"] } },
  rac: { couple: { city: "", wedding_date: "không biết" }, budget: "abc", preferences: { style_tags: [] } },
  am: { couple: { city: "HCMC" }, budget: -50, budget_by_category: { photography: 0 } },
};
function env(profile, overlay) {
  const b = new MemoryBucket();
  b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
  if (profile) b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  if (overlay) b.data.set("data/admin/vendor_overrides.json", JSON.stringify(overlay));
  return { CHAT_DATA: b };
}
const reqs = [];
for (const [pk] of Object.entries(PROFILES)) for (const ov of [false, true]) {
  const q = pk === "none" ? "" : `coupleId=${CID}&`;
  for (const cat of ["", "photography", "makeup", "venue", "stationery", "khong-co"]) reqs.push({ pk, ov, m: "GET", u: `/api/vendors/match?${q}category=${cat}` });
  for (const extra of ["limit=5&offset=5", "limit=999", "limit=abc&offset=-3", "minScore=60", "minScore=abc&offset=10000"]) reqs.push({ pk, ov, m: "GET", u: `/api/vendors/match?${q}category=photography&${extra}` });
  reqs.push({ pk, ov, m: "GET", u: `/api/vendors/categories?${q}` });
  reqs.push({ pk, ov, m: "GET", u: `/api/vendors/${ph[0].id}` }, { pk, ov, m: "GET", u: `/api/vendors/${ph[1].id}` }, { pk, ov, m: "GET", u: `/api/vendors/khong_ton_tai` });
  reqs.push({ pk, ov, m: "POST", u: `/api/vendors/status`, body: { ids: [ph[0].id, ph[1].id, "khong_ton_tai"] } });
}
const origFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error("không mạng " + u); };
const origNow = Date.now;
const out = [];
for (const r of reqs) {
  resetOverlayCache();
  const e = env(PROFILES[r.pk], r.ov ? OVERLAY : null);
  const url = new URL("http://localhost" + r.u);
  const segs = url.pathname.replace(/^\/api\/vendors\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const req = new Request(url, r.body ? { method: r.m, body: JSON.stringify(r.body), headers: { "content-type": "application/json" } } : { method: r.m });
  let body, status;
  try { const res = await handleVendors(req, e, AUTH, segs); status = res.status; body = await res.text(); } catch (err) { status = "throw"; body = String(err?.message || err); }
  out.push({ label: `${r.pk}${r.ov ? "+ov" : ""} ${r.m} ${r.u}`, status, sha256: createHash("sha256").update(body).digest("hex") });
}
globalThis.fetch = origFetch; Date.now = origNow;
const G = path.join(HERE, "..", "fixtures", "adv-01-golden.json");
if (process.argv.includes("--make-golden")) { writeFileSync(G, JSON.stringify({ from: "tohong-back main @ 77ea5e8", cases: out }, null, 1)); console.log(`golden ${out.length} ca`); process.exit(0); }
const golden = JSON.parse(readFileSync(G, "utf8")).cases; const fails = [];
if (golden.length !== out.length) fails.push(`số ca ${out.length} != golden ${golden.length}`);
golden.forEach((g, i) => { const o = out[i]; if (!o || o.label !== g.label || o.status !== g.status || o.sha256 !== g.sha256) fails.push(`${g.label}: đầu ra HTTP đổi (status ${o?.status} vs ${g.status})`); });
if (fails.length) { console.log(`FAIL ${fails.length}/${golden.length} ca: ` + fails.slice(0, 5).join("; ")); process.exit(1); }
console.log(`PASS ${out.length} ca HTTP tab Vendor y nguyên main`);
