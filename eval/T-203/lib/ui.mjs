// T-203: khung giao diện. Build front (vite, token admin dev, API giả địa chỉ http://api.test), phục vụ bản build, và chuyển MỌI request /api/* của trang
// thẳng vào worker thật của tohong-back (R2 giả). Không giả logic xoá: cái trang thấy là cái back trả. Mạng ngoài bị chặn.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fresh, worker, outbound, ADMIN, VENDOR_POOL } from "./common.mjs";

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
export const REPO = arg("--repo") && path.resolve(arg("--repo"));
export const CASE = arg("--case");
if (!REPO || !fs.existsSync(path.join(REPO, "package.json"))) { console.log("FAIL thiếu --repo trỏ tới tohong-front"); process.exit(2); }
const req = createRequire(path.join(REPO, "x.js"));
function loadPlaywright() {
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, "node_modules/playwright"), "/opt/node-tools/node_modules/playwright", "playwright"].filter(Boolean)) { try { return req(t); } catch { /* thử tiếp */ } }
  console.log("FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)"); process.exit(2);
}
const { chromium } = loadPlaywright();
let DIST = arg("--dist"); const OWN_DIST = !DIST;
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), "t203-dist-"));
  try { execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "", VITE_ADMIN_DEV_TOKEN: `dev:${ADMIN}`, VITE_API_BASE: "http://api.test", VITE_ADMIN_OPEN: "" } }); }
  catch (e) { console.log("FAIL build lỗi: " + String(e.stderr || e.message).split("\n").filter(Boolean).slice(-2).join(" | ")); process.exit(1); }
}
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer((rq, res) => {
  const p = decodeURIComponent(new URL(rq.url, "http://x").pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
export const browser = await chromium.launch();
export const closeAll = async () => { await browser.close(); server.close(); if (OWN_DIST) fs.rmSync(DIST, { recursive: true, force: true }); };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

// Vendor có tên duy nhất để tìm bằng ô "Tìm theo tên"
export const uniqueVendor = (category) => VENDOR_POOL.find((v) => v.category === category && v.name.length > 4 && VENDOR_POOL.filter((x) => x.name === v.name).length === 1 && !/[<>&"']/.test(v.name));

export async function scenario() {
  const { env, bucket } = fresh();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const S = { page, ctx, env, bucket, calls: [], external: [] };
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(S.base) || u.startsWith("http://api.test/")) return route.fallback();
    if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) S.external.push(u);
    return route.abort();
  });
  await page.route("http://api.test/**", async (route) => {
    const rq = route.request(); const u = new URL(rq.url());
    if (rq.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (rq.method() !== "GET") S.calls.push(rq.method() + " " + u.pathname);
    const headers = { ...rq.headers() }; delete headers.host;
    const body = rq.postData();
    const res = await worker.fetch(new Request("http://localhost" + u.pathname + u.search, { method: rq.method(), headers, body: body == null || ["GET", "HEAD"].includes(rq.method()) ? undefined : body }), env, { waitUntil() {} });
    const text = await res.text();
    return route.fulfill({ status: res.status, contentType: "application/json", headers: CORS, body: text });
  });
  S.base = `http://127.0.0.1:${server.address().port}`;
  // Mở tab "Dữ liệu vendor" > "Danh sách vendor"
  S.openList = async () => {
    await page.goto(`${S.base}/?admin`);
    await page.getByRole("button", { name: "Dữ liệu vendor" }).first().click();
    await page.getByRole("button", { name: "Danh sách vendor" }).click();
    await page.getByRole("table").first().waitFor();
  };
  S.search = async (name) => { await page.getByLabel("Tìm theo tên").fill(name); await page.getByRole("button", { name: "Tìm", exact: true }).click(); await page.waitForTimeout(300); };
  S.rowOf = (name) => page.getByRole("row").filter({ hasText: name }).first();
  S.pickLabel = async (label) => { await page.getByLabel("Nhãn", { exact: true }).selectOption({ label }); await page.waitForTimeout(300); };
  S.bodyText = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
  S.btn = (name, exact = true) => page.getByRole("button", { name, exact });
  S.writes = (re) => S.calls.filter((c) => re.test(c));
  return S;
}
export { outbound };
