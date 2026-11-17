// T-197: khung giao diện. Build front (vite, token admin dev, API giả địa chỉ http://api.test), phục vụ bản build, và chuyển MỌI request /api/* của trang
// thẳng vào worker thật của tohong-back (R2 giả, đã gieo review). Không giả logic lọc: cái trang thấy là cái back trả. Mạng ngoài bị chặn.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { MemoryBucket, makeEnv, seed, pickSeeds, worker, outbound, ADMIN, CAPU, LABEL, STATUS, shown } from "./common.mjs";

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

let DIST = arg("--dist");
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), "t197-dist-"));
  try { execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: "", VITE_ADMIN_DEV_TOKEN: `dev:${ADMIN}`, VITE_API_BASE: "http://api.test" } }); }
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
export const closeAll = async () => { await browser.close(); server.close(); };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

export const PAGE = 50;
export const CHIPS = { all: "Tất cả", full: "Enrich 100%", no_google_photo: "Chưa có ảnh Google", name_similar: "Tên hơi giống", addr_diff: "Địa chỉ khác marry" };
// profile: "small" | "big" (xem lib/common.mjs pickSeeds). Trả S: { page, st (id -> {byCapu}), lists (query string các lần gọi danh sách), writes, ... }
export async function scenario(profile = "small", viewport = { width: 1280, height: 900 }) {
  const bucket = new MemoryBucket();
  const env = makeEnv(bucket);
  const st = await seed(env, pickSeeds(profile));
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const S = { page, ctx, st, env, bucket, lists: [], writes: [], external: [] };
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(S.base) || u.startsWith("http://api.test/")) return route.fallback();
    if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) S.external.push(u);
    return route.abort();
  });
  await page.route("http://api.test/**", async (route) => {
    const rq = route.request(); const u = new URL(rq.url());
    if (rq.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/api/admin/vendor-enrich" && rq.method() === "GET") S.lists.push(u.search);
    if (/^\/api\/admin\/vendor-enrich\/[^/]+\/review$/.test(u.pathname) && ["PUT", "DELETE"].includes(rq.method())) S.writes.push(rq.method() + " " + u.pathname);
    const headers = { ...rq.headers() }; delete headers.host;
    const body = rq.postData();
    const res = await worker.fetch(new Request("http://localhost" + u.pathname + u.search, { method: rq.method(), headers, body: body == null || ["GET", "HEAD"].includes(rq.method()) ? undefined : body }), env, { waitUntil() {} });
    const text = await res.text();
    return route.fulfill({ status: res.status, contentType: "application/json", headers: CORS, body: text });
  });
  S.base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${S.base}/?admin`);
  await page.getByRole("button", { name: "Dữ liệu vendor" }).first().click();
  const table = page.getByRole("table", { name: "Bảng enrich vendor" });
  if ((await table.count()) === 0) await page.getByRole("button", { name: "Enrich Google Maps" }).click();
  S.table = table;
  await table.waitFor();
  S.select = page.getByRole("combobox", { name: "Status", exact: true });
  S.pager = () => page.getByText(/^Hiển thị \d+–\d+ \/ \d+$/);
  S.chip = (key) => page.getByRole("button", { name: new RegExp("^" + CHIPS[key].replace(/[%]/g, "\\$&") + " · \\d+$") });
  return S;
}
// Đọc bảng: [{ n, name, status }] theo chữ người dùng thấy ở cột có tiêu đề "Status".
export async function readRows(S) {
  const heads = await S.table.getByRole("columnheader").allTextContents();
  const si = heads.map((h) => h.trim()).indexOf("Status");
  return S.table.locator("tbody tr").evaluateAll((trs, si) => trs.map((tr) => { const td = tr.querySelectorAll("td"); if (td.length < 5) return { empty: tr.innerText.replace(/\s+/g, " ").trim() };
    return { n: Number(td[0].innerText.trim()), name: td[1].innerText.split("\n")[0].replace(/\s+/g, " ").trim(), status: td[si].innerText.replace(/\s+/g, " ").trim() }; }), si);
}
export const pagerText = async (S) => (await S.pager().innerText()).trim();
export const hien = (off, total) => `Hiển thị ${total === 0 ? 0 : off + 1}–${Math.min(off + PAGE, total)} / ${total}`;
// Chờ tới khi chữ phân trang bằng `want` và bảng không còn đang tải.
export async function settle(S, want) {
  await S.page.waitForFunction((w) => [...document.querySelectorAll("*")].some((e) => e.children.length === 0 && e.textContent.trim() === w), want);
  await S.table.waitFor();
}
export async function pickStatus(S, label) { await S.select.selectOption({ label }); }
// Đi qua mọi trang từ trang 1 (đang ở đâu thì về trang đầu bằng Trang trước), trả mọi hàng theo thứ tự.
export async function readAllPages(S, total) {
  const out = [];
  for (let off = 0; ; off += PAGE) {
    await settle(S, hien(off, total));
    out.push(...(await readRows(S)));
    const next = S.page.getByRole("button", { name: "Trang sau" });
    if (await next.isDisabled()) break;
    await next.click();
  }
  return out;
}
export const chipNames = async (S) => (await S.page.getByRole("button", { name: / · \d+$/ }).allInnerTexts()).map((x) => x.trim());
// Làm một thao tác rồi chờ đúng một lần gọi danh sách mới (để không đọc bảng cũ).
export async function act(S, fn) { const n0 = S.lists.length; await fn(); for (let i = 0; i < 100 && S.lists.length === n0; i++) await S.page.waitForTimeout(50); }
export { STATUS, LABEL, shown, outbound };
