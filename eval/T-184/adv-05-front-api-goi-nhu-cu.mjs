// T-184 adv-05 (adversary): front src/api.js sau khi bỏ scoreEpoch: getBudget/putBudget/updateProfile vẫn gọi đúng MỘT fetch,
// cùng method, URL, body như trước; tham số thừa { track:false } / { userView } (useBudget.js, savedBudgetSig.js vẫn truyền) bị bỏ qua vô hại;
// 404 của getBudget -> null; lỗi PUT/PATCH vẫn ném (status giữ). Nạp api.js thật, thay import.meta.env, stub fetch/localStorage; thư mục tạm xoá khi xong.
import p from "path"; import os from "os"; import fs from "fs"; import { pathToFileURL as u } from "url";
const front = process.env.TOHONG_FRONT_REPO || p.resolve(p.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "tohong-front");
const src = fs.readFileSync(p.join(front, "src", "api.js"), "utf8");
const fails = []; const bad = (m) => fails.push(m);
if (/from ['"]\.\//.test(src)) bad("api.js còn nhập module nội bộ (mong: không còn ./scoreEpoch.js)");
const tmp = fs.mkdtempSync(p.join(os.tmpdir(), "t184-adv05-"));
let n = 0;
try {
  const f = p.join(tmp, "api.mjs");
  fs.writeFileSync(f, src.replace(/import\.meta\.env/g, "({})"));
  const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
  const calls = []; let next = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, method: init.method, body: init.body, ct: init.headers["Content-Type"] }); const r = next.shift(); return { ok: r.status < 400, status: r.status, json: async () => r.data }; };
  const { api } = await import(u(f).href);
  const B = "http://localhost:8787";
  const doc = { total_tr: 500, guests: 300, categories: [{ id: "venue", allocated_tr: 139.5 }] };
  const exp = async (name, fn, resp, want, check) => {
    n++; calls.length = 0; next = resp.slice();
    let out, err; try { out = await fn(); } catch (e) { err = e; }
    if (calls.length !== want.length) return bad(`${name}: ${calls.length} fetch, mong ${want.length}`);
    want.forEach((w, i) => { const c = calls[i]; if (c.url !== B + w.url || c.method !== w.method || c.body !== w.body) bad(`${name}: gọi ${JSON.stringify(c)} mong ${JSON.stringify(w)}`); });
    check(out, err);
  };
  await exp("getBudget", () => api.getBudget("c1"), [{ status: 200, data: doc }], [{ method: "GET", url: "/api/couples/c1/budget" }], (o) => { if (JSON.stringify(o) !== JSON.stringify(doc)) bad("getBudget trả khác doc"); });
  await exp("getBudget track:false", () => api.getBudget("c1", { track: false }), [{ status: 200, data: doc }], [{ method: "GET", url: "/api/couples/c1/budget" }], (o) => { if (o?.total_tr !== 500) bad("getBudget {track:false} trả sai"); });
  await exp("getBudget 404", () => api.getBudget("c1"), [{ status: 404, data: {} }], [{ method: "GET", url: "/api/couples/c1/budget" }], (o, e) => { if (o !== null || e) bad("404 phải trả null"); });
  await exp("putBudget userView", () => api.putBudget("c1", doc, { userView: { x: 1 } }), [{ status: 200, data: { ok: true } }], [{ method: "PUT", url: "/api/couples/c1/budget", body: JSON.stringify(doc) }], (o) => { if (!o?.ok) bad("putBudget phải trả phản hồi server"); });
  await exp("putBudget lỗi", () => api.putBudget("c1", doc), [{ status: 409, data: { error: "conflict" } }], [{ method: "PUT", url: "/api/couples/c1/budget", body: JSON.stringify(doc) }], (o, e) => { if (!e || e.status !== 409 || e.code !== "conflict") bad("lỗi PUT phải ném với status/code"); });
  const patch = { couple: { guest_count: 300 } };
  await exp("updateProfile", () => api.updateProfile("c1", patch), [{ status: 200, data: { id: "c1" } }], [{ method: "PATCH", url: "/api/couples/c1", body: JSON.stringify(patch) }], (o) => { if (o?.id !== "c1") bad("updateProfile phải trả phản hồi"); });
  await exp("updateProfile lỗi", () => api.updateProfile("c1", null), [{ status: 500, data: {} }], [{ method: "PATCH", url: "/api/couples/c1", body: undefined }], (o, e) => { if (!e || e.status !== 500) bad("lỗi PATCH phải ném"); });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
if (fails.length) { console.log("FAIL\n" + fails.join("\n")); process.exit(1); }
console.log(`PASS (${n} phép thử)`);
