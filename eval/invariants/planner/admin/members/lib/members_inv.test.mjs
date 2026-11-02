/**
 * Bất biến tầng 2 của vùng planner/admin/members (phần back). Nguồn: T-043 (spec products/T-043-danh-sach-thanh-vien.md v2,
 * qua Spec Gate 2026-11-02, spec-critic). Sửa file này = sửa bất biến: qua Chief of Staff, ghi decisions/.
 *
 * Mỗi bất biến là một test có tiền tố "INV-00n "; file inv-00n-*.sh chạy đúng test đó.
 * Chạy: cd <tohong-back> && node --test --test-name-pattern='INV-001 ' <file này>
 *   (cwd phải là repo tohong-back: nạp worker.js, test/helpers/memoryBucket.js, lib/clerkUsers.js, lib/memberStats.js).
 *
 * ROUTES là danh sách route /api/admin/members-* của vùng. Việc nào thêm route members-* mới phải thêm nó vào đây
 * (Spec critic làm khi spec qua cổng). Chỉ đo hành vi qua HTTP; R2 giả, Clerk giả qua globalThis.fetch; dữ liệu bịa.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, beforeEach, afterEach } from "node:test";

const BACK = process.cwd();
const load = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
const { default: worker } = await load("worker.js");
const { MemoryBucket } = await load("test/helpers/memoryBucket.js");
const { resetClerkCache } = await load("lib/clerkUsers.js");
const { resetMemberStatsCache } = await load("lib/memberStats.js");

const ADMIN = "user_admin";
// [phương thức hợp lệ, đường dẫn, thân hợp lệ (undefined = không thân)]
const ROUTES = [
  ["GET", "/api/admin/members-summary", undefined],
  ["POST", "/api/admin/members-list", { page: 1, size: 50 }],
];
const PHONES = ["+84901234567", "0912345678", "0987654321"];
const EMAILS = { user_b1: "zeta@example.com", user_b2: "alpha@example.com", user_b3: "mid@example.com" }; // email ngược thứ tự user_id

const ORIGINAL_FETCH = globalThis.fetch;
let bucket, reads, lists, writes, clerkCalls, clerkMode;

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const clerkUser = (id) => ({
  id,
  primary_email_address_id: `idn_${id}`,
  email_addresses: [{ id: `idn_${id}`, email_address: EMAILS[id] }],
  primary_phone_number_id: `ph_${id}`,
  phone_numbers: [{ id: `ph_${id}`, phone_number: PHONES[0] }],
  created_at: Date.now(),
});

function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    clerkCalls.push(u);
    if (clerkMode === "down") throw new Error("clerk down");
    if (/\/v1\/users\/count/.test(u)) return json({ total_count: Object.keys(EMAILS).length, object: "total_count" });
    const one = /^https:\/\/api\.clerk\.com\/v1\/users\/([^/?]+)$/.exec(u);
    if (one) return EMAILS[one[1]] ? json(clerkUser(one[1])) : json({ errors: [] }, 404);
    if (u.startsWith("https://api.clerk.com/v1/users?")) {
      const sp = new URL(u).searchParams;
      const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "10", 10) || 10));
      const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
      const wanted = sp.getAll("user_id");
      let pool = Object.keys(EMAILS);
      if (wanted.length) pool = pool.filter((i) => wanted.includes(i));
      return json(pool.slice(offset, offset + limit).map(clerkUser));
    }
    return json({ errors: [] }, 404);
  };
}

function seed() {
  const couple = (id, members, bride, groom) => {
    if (members) {
      bucket.seedJson(`data/couples/${id}/members.json`,
        members.map(([user_id, role]) => ({ user_id, role, email: "stale@example.com", phone: PHONES[2] })));
    }
    bucket.seedText(`data/couples/${id}/profile.yaml`,
      `couple:\n  bride_name: "${bride}"\n  groom_name: "${groom}"\n  phone: "${PHONES[1]}"\n`);
  };
  // nhiều ca hoà cùng ngày, email ngược thứ tự mã
  couple("couple_20261025_aaaaaa", [["user_b1", "member"], ["user_b2", "viewer"]], "Cô Một", "Chú Một");
  couple("couple_20261025_bbbbbb", [["guest_q1", "owner"]], "Cô Hai", "Chú Hai");
  couple("couple_20261025_cccccc", [["user_b3", "owner"]], "Cô Ba", "Chú Ba");
  couple("couple_20261025_dddddd", null, "Cô Bốn", "Chú Bốn");
  couple("couple_20261020_eeeeee", [["user_b1", "owner"], ["guest_q2", "member"]], "Cô Năm", "Chú Năm");
  couple("couple_20261030_ffffff", [["user_b2", "owner"]], "Cô Sáu", "Chú Sáu");
}

async function call(method, p, { token = `dev:${ADMIN}`, body, env } = {}) {
  const init = { method, headers: {} };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const e = env || { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADMIN, CLERK_SECRET_KEY: "sk_test_x" };
  const res = await worker.fetch(new Request(`http://localhost${p}`, init), e, { waitUntil() {} });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

beforeEach(() => {
  bucket = new MemoryBucket();
  reads = 0; lists = 0; writes = 0;
  for (const [k, inc] of [["get", () => reads++], ["head", () => reads++], ["list", () => lists++], ["put", () => writes++], ["delete", () => writes++]]) {
    const orig = bucket[k].bind(bucket);
    bucket[k] = async (...a) => { inc(); return orig(...a); };
  }
  clerkCalls = [];
  clerkMode = "ok";
  resetMemberStatsCache();
  resetClerkCache();
  installFetch();
});
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

test("INV-001 route members-* không trả điện thoại, mã người dùng, mã cặp đôi hay email cũ trong members.json", async () => {
  seed();
  for (const [m, p, body] of ROUTES) {
    const r = await call(m, p, { body });
    assert.equal(r.status, 200, `${m} ${p}: ${r.status} ${r.text.slice(0, 120)}`);
    for (const ph of [...PHONES, "84901234567", "912345678", "987654321"]) assert.ok(!r.text.includes(ph), `${p} lộ số điện thoại`);
    assert.ok(!/phone|dien_thoai|sdt|mobile/i.test(r.text), `${p} có trường điện thoại`);
    assert.ok(!/user_[a-z0-9]|guest_[a-z0-9]|couple_\d|idn_|ph_user/i.test(r.text), `${p} lộ mã người dùng/cặp đôi/Clerk`);
    assert.ok(!r.text.includes("stale@example.com"), `${p} lộ email cũ trong members.json`);
  }
});

test("INV-002 không phải admin -> 403 forbidden ở mọi route members-*, mọi phương thức, trước khi đọc/liệt kê R2 hay gọi Clerk", async () => {
  seed();
  const base = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADMIN, CLERK_SECRET_KEY: "sk_test_x" };
  const who = [
    ["không token", base, null],
    ["khách", base, "guest_x"],
    ["người thường", base, "dev:user_regular"],
    ["danh sách admin rỗng", { ...base, ADMIN_USER_IDS: "" }, `dev:${ADMIN}`],
    ["token rác", base, "rac-khong-parse-duoc"],
  ];
  for (const [, p] of ROUTES) {
    for (const [label, env, token] of who) {
      for (const [m, body] of [["GET", undefined], ["POST", {}], ["POST", "khong-phai-json"], ["PUT", {}], ["DELETE", undefined]]) {
        const r = await call(m, p, { env, token, body });
        assert.equal(r.status, 403, `${label} ${m} ${p} -> ${r.status}`);
        assert.equal(r.text, '{"error":"forbidden"}', `${label} ${m} ${p}`);
      }
    }
  }
  assert.equal(reads, 0, "từ chối không được đọc R2");
  assert.equal(lists, 0, "từ chối không được liệt kê R2");
  assert.deepEqual(clerkCalls, [], "từ chối không được gọi Clerk");
});

test("INV-003 route members-* không ghi hay xoá R2, R2 y nguyên (kể cả refresh, Clerk lỗi)", async () => {
  seed();
  const snap = JSON.stringify([...bucket.data.entries()].sort());
  for (const mode of ["ok", "down"]) {
    clerkMode = mode;
    for (const [m, p, body] of ROUTES) {
      const r = await call(m, p, { body });
      assert.equal(r.status, 200, `${m} ${p}: ${r.status}`);
      await call(m, `${p}${m === "GET" ? "?refresh=1" : ""}`, { body: body && { ...body, refresh: true } });
    }
  }
  assert.equal(writes, 0, "không được put/delete R2");
  assert.equal(JSON.stringify([...bucket.data.entries()].sort()), snap, "R2 phải y nguyên");
});

test("INV-004 phản hồi 200 của mọi route members-* (và 405 của members-list) có Cache-Control: no-store, không public/max-age", async () => {
  seed();
  const cases = ROUTES.map(([m, p, body]) => [m, p, body, 200]);
  cases.push(["GET", "/api/admin/members-list", undefined, 405]);
  for (const [m, p, body, want] of cases) {
    const r = await call(m, p, { body });
    assert.equal(r.status, want, `${m} ${p}: ${r.status}`);
    const cc = (r.headers.get("cache-control") || "").toLowerCase();
    assert.match(cc, /no-store/, `${m} ${p} (${r.status}) thiếu no-store: "${cc}"`);
    assert.ok(!/public|max-age=[1-9]|s-maxage/.test(cc), `${m} ${p}: "${cc}"`);
  }
});

test("INV-005 thứ tự danh sách thành viên không phụ thuộc Clerk hay bộ nhớ đệm: cùng dữ liệu R2 thì cùng thứ tự", async () => {
  seed();
  const p = "/api/admin/members-list";
  const order = async (body = { page: 1, size: 50 }) => {
    const r = await call("POST", p, { body });
    assert.equal(r.status, 200, r.text.slice(0, 120));
    return JSON.parse(r.text).items.map((i) => `${i.kind}|${i.couples.map((c) => `${c.bride_name}:${c.role}`).join("/")}`);
  };
  const want = await order();
  assert.ok(want.length >= 6);
  clerkMode = "down"; resetMemberStatsCache(); resetClerkCache();
  assert.deepEqual(await order(), want, "Clerk xuống làm đổi thứ tự");
  clerkMode = "ok"; resetMemberStatsCache(); resetClerkCache();
  const pages = [];
  for (const page of [1, 2, 3, 4]) { resetMemberStatsCache(); resetClerkCache(); pages.push(...(await order({ page, size: 2 }))); }
  assert.deepEqual(pages, want, "ghép các trang (mỗi trang dựng lại, cache email trống) khác danh sách đầy đủ");
  resetMemberStatsCache(); resetClerkCache();
  await order({ page: 2, size: 2 });
  assert.deepEqual(await order({ page: 1, size: 2 }), want.slice(0, 2), "cache email một phần làm đổi trang 1");
  await order(); resetMemberStatsCache();
  assert.deepEqual(await order(), want, "cache email đầy làm đổi thứ tự");
});
