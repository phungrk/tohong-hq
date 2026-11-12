// Dùng chung cho check_a*.mjs. Chỉ ĐỌC tohong-back (TOHONG_BACK_REPO hoặc ../tohong-back cạnh tohong-hq). Không gọi mạng thật: fetch bị thay bằng matcher giả.
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].find((c) => c && existsSync(path.join(c, "lib", "contextBuilder.js")));
if (!BACK) { console.log("PASS chưa áp dụng (thiếu tohong-back)"); process.exit(0); }
const imp = (p) => import(pathToFileURL(path.join(BACK, p)).href);
export const { buildChatContext } = await imp("lib/contextBuilder.js");
export const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
export const { GENERATED_VENDOR_POOL: POOL } = await imp("lib/vendorPool.generated.js");
export const { resetOverlayCache } = await imp("lib/vendorOverlay.js");
export const MSG = "Tìm photographer chụp ảnh cưới giúp anh chị 30tr";
export const poolPhotographers = POOL.filter((v) => v.category === "photography");
// Matcher giả: trả payload cho /match; mode "500" / "throw" / "timeout-ish" giả lỗi.
export async function chat(payloadOrMode, { overlay } = {}) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!String(url).startsWith("https://m.test/match")) throw new Error("không được gọi mạng: " + url);
    if (payloadOrMode === "throw") throw new TypeError("network down");
    if (payloadOrMode === "500") return new Response(JSON.stringify({ detail: "boom" }), { status: 500 });
    return new Response(JSON.stringify(payloadOrMode), { status: 200 });
  };
  const bucket = new MemoryBucket();
  if (overlay) bucket.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  resetOverlayCache();
  try {
    return await buildChatContext({ CHAT_DATA: bucket, MATCHER_URL: "https://m.test", MATCHER_API_KEY: "k" }, "c1", null, MSG, null, "u1");
  } finally { globalThis.fetch = orig; }
}
export const item = (id, name, minM = 1, maxM = 2) => ({ vendor_id: id, name, final_score: 80, price_range: { min_vnd: minM * 1e6, max_vnd: maxM * 1e6 }, style_tags: [] });
export function done(fails) { if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); } console.log("PASS"); }
