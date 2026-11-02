/**
 * Eval đối kháng (tầng 3) của T-044, phần back. Adversary viết 2026-11-02.
 * Hợp đồng: products/T-043-danh-sach-thanh-vien.md (v2). Dữ liệu bịa, không mạng, không dữ liệu thật.
 * cwd BẮT BUỘC là repo tohong-back (nạp worker.js và test/helpers của repo đó).
 * Lọc bằng --test-name-pattern='ADV-0n '.
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

const ORIGINAL_FETCH = globalThis.fetch;
const ADMIN = "user_admin";
const ROUTE = "/api/admin/members-list";
const json = (body, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let bucket, clerkCalls, clerkHandler, puts;
const EMAIL = (id) => `${id.replace(/[^a-z0-9]/gi, "")}@example.com`;
const okUser = (id) => ({ id, primary_email_address_id: `idn_${id}`, email_addresses: [{ id: `idn_${id}`, email_address: EMAIL(id) }] });

// Clerk giả mặc định: tôn trọng user_id (lặp lại), limit (mặc định 10, tối đa 500), offset.
function defaultClerk(u, known) {
  const sp = new URL(u).searchParams;
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "10", 10) || 10));
  const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
  const wanted = sp.getAll("user_id");
  let pool = known;
  if (wanted.length) pool = pool.filter((id) => wanted.includes(id));
  return json(pool.slice(offset, offset + limit).map(okUser));
}

function installFetch(known) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    clerkCalls.push(u);
    if (!u.startsWith("https://api.clerk.com/")) throw new Error(`fetch ngoài dự kiến: ${u}`);
    return clerkHandler ? clerkHandler(u, known) : defaultClerk(u, known);
  };
}

const env = (extra = {}) => ({ CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADMIN, CLERK_SECRET_KEY: "sk_test_x", ...extra });
async function list(body, e = env()) {
  const init = { method: "POST", headers: { Authorization: `Bearer dev:${ADMIN}`, "Content-Type": "application/json" } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await worker.fetch(new Request(`http://localhost${ROUTE}`, init), e, { waitUntil() {} });
  const text = await res.text();
  let j = null;
  try { j = JSON.parse(text); } catch {}
  return { status: res.status, json: j, text };
}
const yaml = (b, g) => `couple:\n  bride_name: ${JSON.stringify(b)}\n  groom_name: ${JSON.stringify(g)}\n`;
function seed(id, members, bride, groom) {
  if (members !== undefined) {
    if (typeof members === "string") bucket.seedText(`data/couples/${id}/members.json`, members);
    else bucket.seedJson(`data/couples/${id}/members.json`, members);
  }
  bucket.seedText(`data/couples/${id}/profile.yaml`, yaml(bride, groom));
}

beforeEach(() => {
  bucket = new MemoryBucket();
  puts = 0;
  const op = bucket.put.bind(bucket);
  bucket.put = async (...a) => { puts++; return op(...a); };
  clerkCalls = [];
  clerkHandler = null;
  resetMemberStatsCache();
  resetClerkCache();
});
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

/* ADV-01: members.json có phần tử lạ */
test("ADV-01 members.json phần tử lạ (null, số, chuỗi, user_id không phải chuỗi, rỗng, trùng): đúng một dòng account vai trò của phần tử đầu; cặp đôi không có user_id hợp lệ là unknown", async () => {
  installFetch(["user_b1"]);
  seed("couple_20261101_aaaaaa", [null, 5, "user_z", { user_id: 7 }, { user_id: "" }, { user_id: ["user_q"] }, { user_id: { x: 1 } },
    { user_id: "user_b1", role: "owner" }, { user_id: "user_b1", role: "viewer" }, { role: "member" }], "Lan Một", "Minh Một");
  seed("couple_20261030_bbbbbb", [null, { user_id: 123 }, { user_id: "" }], "Lan Hai", "Minh Hai");
  seed("couple_20261029_cccccc", { user_id: "user_obj" }, "Lan Ba", "Minh Ba");
  seed("couple_20261028_dddddd", "{not json", "Lan Bốn", "Minh Bốn");
  seed("couple_20261027_eeeeee", [], "Lan Năm", "Minh Năm");
  const r = await list({});
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.counts, { account: 1, guest: 0, unknown: 4 });
  const acc = r.json.items.filter((i) => i.kind === "account");
  assert.equal(acc.length, 1);
  assert.equal(acc[0].email, EMAIL("user_b1"));
  assert.deepEqual(acc[0].couples, [{ bride_name: "Lan Một", groom_name: "Minh Một", role: "owner", created_at: "2026-11-01" }]);
  assert.deepEqual(r.json.items.filter((i) => i.kind === "unknown").map((i) => i.couples[0].bride_name), ["Lan Hai", "Lan Ba", "Lan Bốn", "Lan Năm"]);
  assert.ok(!/user_|couple_/.test(r.text));
  assert.equal(puts, 0);
});

/* ADV-02: thân yêu cầu ở biên */
test("ADV-02 thân yêu cầu biên: page rất lớn, q 100 khoảng trắng, q 100 ký tự, q 101 khoảng trắng, refresh sai kiểu, size 50/51, q chỉ dấu kết hợp, q dạng NFD, q nối hai tên", async () => {
  installFetch(["user_c1", "user_c2"]);
  seed("couple_20261101_aaaaaa", [{ user_id: "user_c1", role: "owner" }], "Nguyễn Thị Lan", "Trần Đức Minh");
  seed("couple_20261020_bbbbbb", [{ user_id: "user_c2", role: "owner" }], "Lê Thị Hoa", "Phạm Quốc Đạt");
  const full = await list({});
  assert.equal(full.json.total, 2);

  const big = await list({ page: 1e15 });
  assert.equal(big.status, 200, big.text);
  assert.deepEqual(big.json.items, []);
  assert.equal(big.json.total, 2);

  const sp = await list({ q: " ".repeat(100) });
  assert.equal(sp.status, 200, sp.text);
  assert.equal(sp.json.total, 2, "q toàn khoảng trắng phải là không lọc");
  assert.equal((await list({ q: " 　\t\n " })).json.total, 2, "khoảng trắng Unicode cũng là không lọc");
  assert.equal((await list({ q: "a".repeat(100) })).status, 200);
  assert.equal((await list({ q: " ".repeat(101) })).status, 400, "quá 100 ký tự tính trước khi cắt");
  for (const refresh of ["true", 1, null, [], {}]) assert.equal((await list({ refresh })).status, 400, `refresh=${JSON.stringify(refresh)}`);
  for (const page of [0, -1, 1.5, "1", null, true, 1e400]) assert.equal((await list({ page })).status, 400, `page=${page}`);
  assert.equal((await list({ size: 50 })).status, 200);
  assert.equal((await list({ size: 51 })).status, 400);
  for (const body of ["[]", "null", "\"x\"", "42", "{\"q\":", "true"]) assert.equal((await list(body)).status, 400, `body=${body}`);

  assert.equal((await list({ q: "́̀" })).json.total, 2, "q chỉ có dấu kết hợp -> rỗng sau chuẩn hoá -> không lọc");
  const nfd = await list({ q: "ĐẠT".normalize("NFD") });
  assert.equal(nfd.json.total, 1);
  assert.equal(nfd.json.items[0].couples[0].groom_name, "Phạm Quốc Đạt");
  assert.equal((await list({ q: "LAN   TRẦN" })).json.total, 0, "không nối bride + groom");
  assert.equal((await list({ q: "%" })).json.total, 0);
  assert.equal((await list({ q: "." })).json.total, 2, "dấu chấm là ký tự thường, khớp email");
});

/* ADV-03: Clerk trả dữ liệu dị dạng */
test("ADV-03 Clerk dị dạng (200 thân không phải mảng, JSON hỏng, 429, người không có email, email rỗng): vẫn 200, tên đủ, unavailable, email_complete=false, <= 20 lần gọi", async () => {
  const ids = ["user_d1", "user_d2"];
  seed("couple_20261101_aaaaaa", [{ user_id: "user_d1", role: "owner" }], "Lan", "Minh");
  seed("couple_20261020_bbbbbb", [{ user_id: "user_d2", role: "member" }], "Hoa", "Đạt");
  const cases = {
    object: () => json({ data: ids.map(okUser), total_count: 2 }),
    badjson: () => json("<html>gateway</html>"),
    r429: () => json({ errors: [] }, 429),
    noemail: () => json(ids.map((id) => ({ id, email_addresses: [] }))),
    emptyemail: () => json(ids.map((id) => ({ id, primary_email_address_id: "x", email_addresses: [{ id: "x", email_address: "" }] }))),
    strangeaddrs: () => json(ids.map((id) => ({ id, email_addresses: "x@example.com" }))),
    nullusers: () => json([null, 7, "user_d1", { id: 5 }]),
  };
  for (const [name, h] of Object.entries(cases)) {
    resetMemberStatsCache();
    resetClerkCache();
    clerkCalls = [];
    clerkHandler = h;
    installFetch(ids);
    for (const body of [{}, { q: "lan" }]) {
      const r = await list(body);
      assert.equal(r.status, 200, `${name} ${JSON.stringify(body)}: ${r.text}`);
      assert.equal(r.json.email_complete, false, name);
      for (const it of r.json.items) {
        assert.equal(it.email, null, name);
        assert.equal(it.email_status, "unavailable", name);
      }
    }
    assert.ok(clerkCalls.length <= 40, `${name}: ${clerkCalls.length} lần gọi cho 2 request`);
  }
});

/* ADV-04: hai request đồng thời cùng dựng cache */
test("ADV-04 hai request đồng thời lúc cache trống (và một refresh chen giữa): cả hai 200, ghép hai trang bằng danh sách tuần tự, không ghi R2", async () => {
  const ids = Array.from({ length: 30 }, (_, i) => `user_e${String(i).padStart(2, "0")}`);
  installFetch(ids);
  ids.forEach((id, i) => seed(`couple_202610${String((i % 28) + 1).padStart(2, "0")}_${String(i).padStart(6, "a")}`, [{ user_id: id, role: "owner" }], `Cô dâu ${i}`, `Chú rể ${i}`));
  const seq = (await list({ size: 50 })).json.items;
  resetMemberStatsCache();
  resetClerkCache();
  const [p1, p2, p3] = await Promise.all([list({ page: 1, size: 15 }), list({ page: 2, size: 15 }), list({ page: 1, size: 15, refresh: true })]);
  for (const r of [p1, p2, p3]) assert.equal(r.status, 200, r.text);
  assert.deepEqual([...p1.json.items, ...p2.json.items], seq);
  assert.deepEqual(p3.json.items, p1.json.items);
  assert.equal(puts, 0);
});

/* ADV-05: tên chứa HTML hoặc chuỗi giống email */
test("ADV-05 tên chứa HTML và chuỗi giống email: trả nguyên văn, không coi là email (Clerk lỗi -> vẫn unavailable), tìm theo tên vẫn khớp", async () => {
  clerkHandler = () => json({ errors: [] }, 500);
  installFetch([]);
  seed("couple_20261101_aaaaaa", [{ user_id: "user_f1", role: "owner" }], "<img src=x onerror=alert(1)>", "fake.admin@example.com");
  const r = await list({});
  assert.equal(r.status, 200, r.text);
  const it = r.json.items[0];
  assert.equal(it.email, null);
  assert.equal(it.email_status, "unavailable");
  assert.equal(it.couples[0].bride_name, "<img src=x onerror=alert(1)>");
  assert.equal(it.couples[0].groom_name, "fake.admin@example.com");
  const s = await list({ q: "FAKE.ADMIN@" });
  assert.equal(s.json.total, 1, "tên là nội dung tìm");
  assert.equal(s.json.items[0].email, null);
});

/* ADV-06: user_id có ký tự đặc biệt; Clerk chỉ nhận mã người dùng */
test("ADV-06 user_id có ký tự đặc biệt (&, =, #, dấu cách): được mã hoá, không tách thành tham số khác, Clerk chỉ nhận user_id/limit/offset", async () => {
  const ids = ["user_a&limit=1", "user_b#x", "user c=d"];
  installFetch(ids);
  ids.forEach((id, i) => seed(`couple_2026110${i + 1}_aaaaaa`, [{ user_id: id, role: "owner" }], `Lan ${i}`, `Minh ${i}`));
  const r = await list({ q: "lan" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.email_complete, true);
  assert.deepEqual(r.json.items.map((i) => i.email).sort(), ids.map(EMAIL).sort());
  for (const u of clerkCalls) {
    const keys = [...new URL(u).searchParams.keys()];
    assert.ok(keys.every((k) => ["user_id", "limit", "offset"].includes(k)), u);
    assert.ok(!/lan|minh/i.test(decodeURIComponent(u)), u);
  }
});
