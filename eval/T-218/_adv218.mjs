// T-218 adversary: khung nạp back như eval/T-217/_back217.mjs nhưng sinh đôi do người gọi đặt (để so vi phân verified với legacy_marry cùng giá).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BACK } from "../T-217/_back217.mjs";
export * from "../T-217/_back217.mjs";
const tmps = [];
process.on("exit", () => { for (const t of tmps) fs.rmSync(t, { recursive: true, force: true }); });
/** specs: mảng n object giá (priceMin, priceMax, priceSource, priceAsOf?) cho n venue sinh đôi; trả M và ids theo thứ tự. */
export async function loadTwins(specs) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "t218-adv-")); tmps.push(t);
  for (const d of ["lib", "providers", "api"]) if (fs.existsSync(path.join(BACK, d))) fs.cpSync(path.join(BACK, d), path.join(t, d), { recursive: true });
  fs.cpSync(path.join(BACK, "test", "helpers"), path.join(t, "test", "helpers"), { recursive: true });
  fs.cpSync(path.join(BACK, "package.json"), path.join(t, "package.json"));
  fs.symlinkSync(fs.realpathSync(path.join(BACK, "node_modules")), path.join(t, "node_modules"));
  const f = path.join(t, "lib", "vendorPool.generated.js"); const txt = fs.readFileSync(f, "utf8");
  const k = "export const GENERATED_VENDOR_POOL = "; const i = txt.indexOf(k) + k.length; const e = txt.indexOf("];", i) + 1; const arr = JSON.parse(txt.slice(i, e));
  const tw = arr.filter((v) => v.category === "venue" && v.isVerified && v.city === "HCMC" && v.id !== "marry_b92e8a86175d").slice(0, specs.length);
  const tmpl = { ...tw[0] };
  const ids = [];
  tw.forEach((v, n) => {
    const id = v.id, name = v.name;
    for (const key of Object.keys(v)) delete v[key];
    Object.assign(v, JSON.parse(JSON.stringify(tmpl)), { id, name, rating: 0, reviewCount: 0, styles: [], tags: [], availability: [1,2,3,4,5,6,7,8,9,10,11,12], capacity: { min: 1, max: 5000 } });
    for (const x of ["priceMin", "priceMax", "priceSource", "priceAsOf"]) delete v[x];
    Object.assign(v, specs[n]); ids.push(id);
  });
  fs.writeFileSync(f, txt.slice(0, i) + JSON.stringify(arr) + txt.slice(e));
  const imp = (p) => import(pathToFileURL(path.join(t, p)).href);
  const [cc, mb, vm, vo, vapi, vp] = await Promise.all([imp("lib/contextBuilder.js"), imp("test/helpers/memoryBucket.js"), imp("lib/vendorMatcher.js"), imp("lib/vendorOverlay.js"), imp("api/vendors.js"), imp("lib/vendorPrice.js")]);
  return { M: { buildChatContext: cc.buildChatContext, MemoryBucket: mb.MemoryBucket, POOL: vm.VENDOR_POOL, resetOverlayCache: vo.resetOverlayCache, handleVendors: vapi.handleVendors, vo, vp }, ids, dir: t };
}
