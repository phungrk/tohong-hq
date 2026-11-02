/**
 * Eval tầng 1 của T-043 (back): danh sách thành viên admin kèm tên cô dâu, chú rể.
 * Phủ tiêu chí 1, 2, 3, 4, 5 phần máy chủ (hợp đồng ở products/T-043-danh-sach-thanh-vien.md).
 *
 * Chạy (cwd BẮT BUỘC là repo tohong-back, vì test nạp worker.js và test/helpers của repo đó):
 *   cd /home/user/tohong-back && node --test /home/user/tohong-hq/eval/T-043/members_list.test.js
 * Khi Engineering thêm file này vào repo: chép vào test/test_member_list.js và đưa vào script "test".
 *
 * Không cần mạng, không đọc dữ liệu thật: R2 giả (MemoryBucket của repo), Clerk giả qua globalThis.fetch.
 * Chỉ kiểm hành vi nhìn thấy qua HTTP; không import module mới nào của Engineering, trừ hai hàm reset đã có:
 * resetMemberStatsCache (lib/memberStats.js, spec bắt buộc nó cũng xoá bộ nhớ đệm của danh sách) và resetClerkCache.
 * Tên, email, số điện thoại dưới đây là dữ liệu bịa.
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
const CONSOLE_KEYS = ["log", "info", "warn", "error", "debug"];
const ORIGINAL_CONSOLE = Object.fromEntries(CONSOLE_KEYS.map((k) => [k, console[k]]));
const ADMIN = "user_admin";
const ROUTE = "/api/admin/members-list";

let bucket;
let consoleLines;
let clerkUrls; // mọi URL gọi ra ngoài
let clerkLookups; // user id đã tra email (cả tra từng người lẫn tra theo lô)
let clerkMode; // "ok" | "throw" | "http500"
let deletes;
let lists; // số lần bucket.list (liệt kê R2)
let clerkNoUserIdFilter = false; // Clerk bỏ qua tham số user_id (giả lập khi tham số này không tồn tại)
let manyUsers = 0; // số user_x… có thật ở Clerk (bộ dữ liệu lớn)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ───────────── dữ liệu giả ───────────── */

const EMAILS = {
  user_a1: "lan.nguyen@example.com",
  user_a2: "hoa.le@example.com",
  user_a3: "binh.vo@example.com",
  user_a4: "tu.ha@example.com",
  user_a5: "zung.do@example.com",
  user_a6: "an.pham@example.com",
};
const PHONES = ["+84901234567", "0912345678", "0987654321"];

// Người thật trong EMAILS, cộng mọi "user_x…" của bộ dữ liệu lớn (email = <id>@example.com).
const emailOf = (id) => EMAILS[id] || (/^user_x\d+$/.test(id) ? `${id}@example.com` : null);

function clerkUser(id) {
  return {
    id,
    primary_email_address_id: `idn_${id}`,
    email_addresses: [{ id: `idn_${id}`, email_address: emailOf(id) }],
    primary_phone_number_id: `ph_${id}`,
    phone_numbers: [{ id: `ph_${id}`, phone_number: PHONES[0] }],
    first_name: "Tên-Bịa",
  };
}

// Clerk giả theo hành vi Clerk thật (đã biết/giả định): GET /v1/users mặc định trả 10 người mỗi trang,
// tôn trọng limit (tối đa 500) và offset; tham số user_id (lặp lại) lọc theo mã. /v1/users/<id> trả một người.
function allUsers() {
  return [...Object.keys(EMAILS), ...Array.from({ length: manyUsers }, (_, i) => `user_x${i}`)].filter((id) => emailOf(id));
}
function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    clerkUrls.push(u);
    if (clerkMode === "throw") throw new Error("clerk down for lan.nguyen@example.com Nguyễn Thị Lan");
    if (clerkMode === "http500") return json({ errors: [{ message: "lan.nguyen@example.com" }] }, 500);
    const one = /^https:\/\/api\.clerk\.com\/v1\/users\/([^/?]+)$/.exec(u);
    if (one) {
      const id = decodeURIComponent(one[1]);
      clerkLookups.push(id);
      return emailOf(id) ? json(clerkUser(id)) : json({ errors: [] }, 404);
    }
    if (u.startsWith("https://api.clerk.com/v1/users?")) {
      const sp = new URL(u).searchParams;
      const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "10", 10) || 10));
      const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
      const wanted = sp.getAll("user_id");
      let pool = allUsers();
      if (wanted.length && !clerkNoUserIdFilter) pool = pool.filter((id) => wanted.includes(id));
      const page = pool.slice(offset, offset + limit);
      clerkLookups.push(...page);
      return json(page.map(clerkUser));
    }
    throw new Error(`fetch ngoài dự kiến: ${u}`);
  };
}

const profile = (bride, groom, extra = "") =>
  `couple:\n${bride === undefined ? "" : `  bride_name: ${JSON.stringify(bride)}\n`}${
    groom === undefined ? "" : `  groom_name: ${JSON.stringify(groom)}\n`
  }  phone: "${PHONES[1]}"\n${extra}`;

function seedCouple(id, members, bride, groom, hasProfile = true) {
  if (members !== null) {
    bucket.seedJson(
      `data/couples/${id}/members.json`,
      members.map(([user_id, role]) => ({ user_id, role, email: "stale@example.com", phone: PHONES[2] })),
    );
  }
  if (hasProfile) bucket.seedText(`data/couples/${id}/profile.yaml`, profile(bride, groom));
  else if (members === null) bucket.seedText(`data/couples/${id}/memory.yaml`, "facts: []\n"); // để thư mục tồn tại
}

const C = {
  C10: "couple_20261101_mmmmmm", // user_a5 chủ, user_a6 thành viên
  C4: "couple_20261031_dddddd", // khách g1
  C1: "couple_20261030_aaaaaa", // user_a1
  C8: "couple_20261025_zzzzzz", // khách g3 (cùng ngày với C7)
  C7: "couple_20261025_aaaaaa", // khách g2
  C2: "couple_20261020_bbbbbb", // user_a2 chủ
  C9: "couple_20261010_hhhhhh", // user_a3 chủ, user_a2 người xem
  C3: "couple_20260915_cccccc", // user_a2 chủ, thiếu tên chú rể
  C11: "couple_20261025_kkkkkk", // user_a4, cùng ngày với C7, C8, C12
  C12: "couple_20261025_nnnnnn", // không có members.json, cùng ngày
  C6: "couple_20260802_ffffff", // không có members.json
  C5: "couple_20260801_eeeeee", // user_a3 chủ, không có profile.yaml
};

function seedWorld() {
  seedCouple(C.C10, [["user_a5", "owner"], ["user_a6", "member"]], "Trương Mỹ Linh", "Đinh Công Sơn");
  seedCouple(C.C4, [["guest_g1", "owner"]], "Võ Ngọc Ánh", "Bùi Văn Đông");
  seedCouple(C.C1, [["user_a1", "owner"]], "Nguyễn Thị Lan", "Trần Đức Minh");
  seedCouple(C.C8, [["guest_g3", "owner"]], "Cao Bảo Châu", "Lý Hải Nam");
  seedCouple(C.C7, [["guest_g2", "owner"]], "Âu Dương Mai", "Quách Tuấn Kiệt");
  seedCouple(C.C2, [["user_a2", "owner"]], "Lê Thị Hoa", "Phạm Quốc Đạt");
  seedCouple(C.C9, [["user_a3", "owner"], ["user_a2", "viewer"]], "Mai Phương", "Hồ Trung Kiên");
  seedCouple(C.C3, [["user_a2", "owner"]], "Đặng Thu Hằng", undefined);
  seedCouple(C.C6, null, "Hoàng Yến", "Ngô Quang Vinh");
  seedCouple(C.C11, [["user_a4", "owner"]], "Kiều Thanh Tú", "Lương Bảo Long");
  seedCouple(C.C12, null, "Tạ Minh Anh", "Giang Hữu Phước");
  seedCouple(C.C5, [["user_a3", "owner"]], undefined, undefined, false);
  bucket.putLog.length = 0;
  bucket.reads.length = 0;
}

// Thứ tự đúng của 11 dòng: ngày cặp đôi mới nhất giảm dần; cùng ngày thì account > guest > unknown;
// cùng loại thì khoá nội bộ ổn định (user_id tăng dần; dòng unknown theo mã cặp đôi tăng dần). Không phụ thuộc email/Clerk.
const EXPECTED = [
  { kind: "account", email: EMAILS.user_a5, status: "ok", couples: [[C.C10, "Trương Mỹ Linh", "Đinh Công Sơn", "owner", "2026-11-01"]] },
  { kind: "account", email: EMAILS.user_a6, status: "ok", couples: [[C.C10, "Trương Mỹ Linh", "Đinh Công Sơn", "member", "2026-11-01"]] },
  { kind: "guest", email: null, status: "guest", couples: [[C.C4, "Võ Ngọc Ánh", "Bùi Văn Đông", "owner", "2026-10-31"]] },
  { kind: "account", email: EMAILS.user_a1, status: "ok", couples: [[C.C1, "Nguyễn Thị Lan", "Trần Đức Minh", "owner", "2026-10-30"]] },
  { kind: "account", email: EMAILS.user_a4, status: "ok", couples: [[C.C11, "Kiều Thanh Tú", "Lương Bảo Long", "owner", "2026-10-25"]] },
  { kind: "guest", email: null, status: "guest", couples: [[C.C7, "Âu Dương Mai", "Quách Tuấn Kiệt", "owner", "2026-10-25"]] },
  { kind: "guest", email: null, status: "guest", couples: [[C.C8, "Cao Bảo Châu", "Lý Hải Nam", "owner", "2026-10-25"]] },
  { kind: "unknown", email: null, status: "none", couples: [[C.C12, "Tạ Minh Anh", "Giang Hữu Phước", null, "2026-10-25"]] },
  {
    kind: "account",
    email: EMAILS.user_a2,
    status: "ok",
    couples: [
      [C.C2, "Lê Thị Hoa", "Phạm Quốc Đạt", "owner", "2026-10-20"],
      [C.C9, "Mai Phương", "Hồ Trung Kiên", "viewer", "2026-10-10"],
      [C.C3, "Đặng Thu Hằng", null, "owner", "2026-09-15"],
    ],
  },
  {
    kind: "account",
    email: EMAILS.user_a3,
    status: "ok",
    couples: [
      [C.C9, "Mai Phương", "Hồ Trung Kiên", "owner", "2026-10-10"],
      [C.C5, null, null, "owner", "2026-08-01"],
    ],
  },
  { kind: "unknown", email: null, status: "none", couples: [[C.C6, "Hoàng Yến", "Ngô Quang Vinh", null, "2026-08-02"]] },
];
const shape = (row) => ({
  kind: row.kind,
  email: row.email,
  status: row.email_status,
  couples: row.couples.map((c) => [null, c.bride_name, c.groom_name, c.role, c.created_at]),
});
const expectShape = (e) => ({ ...e, couples: e.couples.map(([, b, g, r, d]) => [null, b, g, r, d]) });

/* ───────────── gọi worker ───────────── */

function makeEnv(extra = {}) {
  return { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADMIN, CLERK_SECRET_KEY: "sk_test_x", ...extra };
}

async function call(method, urlPath, opts = {}) {
  const { env = makeEnv(), body } = opts;
  const token = "token" in opts ? opts.token : `dev:${ADMIN}`;
  const init = { method, headers: {} };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await worker.fetch(new Request(`http://localhost${urlPath}`, init), env, { waitUntil() {} });
  const text = await res.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {}
  return { status: res.status, json: j, text, headers: res.headers };
}
const list = (body, opts = {}) => call("POST", ROUTE, { body, ...opts });

const SECRETS = [
  "Nguyễn Thị Lan", "Trần Đức Minh", "Đặng Thu Hằng", "Bùi Văn Đông", "Hoàng Yến", "Lê Thị Hoa",
  ...Object.values(EMAILS), "stale@example.com",
];
function noLeakInConsole(label) {
  const joined = consoleLines.join("\n");
  const norm = joined.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const s of SECRETS) {
    const n = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    assert.ok(!joined.includes(s) && !norm.includes(n), `${label}: console lộ "${s}"`);
  }
  assert.ok(!/user_a\d|guest_g\d|couple_2026/.test(joined), `${label}: console lộ mã người dùng/cặp đôi`);
}

beforeEach(() => {
  bucket = new MemoryBucket();
  deletes = 0;
  const origDelete = bucket.delete.bind(bucket);
  bucket.delete = async (k) => {
    deletes++;
    return origDelete(k);
  };
  lists = 0;
  const origList = bucket.list.bind(bucket);
  bucket.list = async (...a) => {
    lists++;
    return origList(...a);
  };
  clerkNoUserIdFilter = false;
  manyUsers = 0;
  clerkUrls = [];
  clerkLookups = [];
  clerkMode = "ok";
  consoleLines = [];
  for (const k of CONSOLE_KEYS) console[k] = (...a) => consoleLines.push(a.map(String).join(" "));
  resetMemberStatsCache();
  resetClerkCache();
  installFetch();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  for (const k of CONSOLE_KEYS) console[k] = ORIGINAL_CONSOLE[k];
});

/* ───────────── tiêu chí 3: chỉ admin ───────────── */

test("TC3 mọi lý do không phải admin -> 403 forbidden, trước khi đọc R2 hay gọi Clerk, cả POST lẫn GET", async () => {
  seedWorld();
  const cases = [
    ["không header", makeEnv(), undefined],
    ["guest", makeEnv(), "guest_x"],
    ["guest trùng id trong danh sách admin", makeEnv({ ADMIN_USER_IDS: "guest_x" }), "guest_x"],
    ["user thường", makeEnv(), "dev:user_regular"],
    ["ADMIN_USER_IDS rỗng", makeEnv({ ADMIN_USER_IDS: "" }), `dev:${ADMIN}`],
    ["token rác", makeEnv(), "rac-khong-parse-duoc"],
  ];
  for (const [label, env, token] of cases) {
    for (const [method, body] of [["POST", { page: 1, size: 5, q: "lan" }], ["POST", "khong-phai-json"], ["GET", undefined]]) {
      const r = await call(method, ROUTE, { env, token, body });
      assert.equal(r.status, 403, `${label}: ${method} -> ${r.status} ${r.text}`);
      assert.equal(r.text, '{"error":"forbidden"}', `${label}: ${method}`);
    }
  }
  assert.deepEqual(bucket.reads, [], "từ chối không được đọc dữ liệu");
  assert.equal(lists, 0, "từ chối không được liệt kê R2 (list)");
  assert.deepEqual(bucket.putLog, []);
  assert.deepEqual(clerkUrls, [], "từ chối không được gọi Clerk");
  const ok = await list({ page: 1, size: 5 });
  assert.equal(ok.status, 200, `admin hợp lệ phải xem được: ${ok.status} ${ok.text}`);
});

/* ───────────── tiêu chí 1: nội dung từng dòng ───────────── */

test("TC1 mỗi dòng một tài khoản/khách/không rõ, đủ cặp đôi, tên có dấu, 'chưa điền' = null, vai trò, ngày tạo, thứ tự mới nhất trước", async () => {
  seedWorld();
  const r = await list({ page: 1, size: 50 });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.total, 11);
  assert.deepEqual(r.json.counts, { account: 6, guest: 3, unknown: 2 });
  assert.equal(r.json.total_pages, 1);
  assert.equal(r.json.page, 1);
  assert.equal(r.json.size, 50);
  assert.equal(r.json.email_complete, true);
  assert.equal(r.json.items.length, 11);
  assert.deepEqual(r.json.items.map(shape), EXPECTED.map(expectShape));
});

test("TC1 mặc định không gửi gì: trang 1, cỡ 20; thân rỗng cũng được", async () => {
  seedWorld();
  for (const body of [{}, undefined]) {
    const r = await list(body);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.page, 1);
    assert.equal(r.json.size, 20);
    assert.equal(r.json.items.length, 11);
  }
});

test("TC1 tên rỗng hoặc chỉ khoảng trắng hoặc không phải chuỗi -> null, tên có khoảng trắng thừa được cắt", async () => {
  seedCouple("couple_20261102_qqqqqq", [["user_a1", "owner"]], "   ", "  Trần Đức Minh  ");
  bucket.seedText("data/couples/couple_20261102_rrrrrr/profile.yaml", "couple:\n  bride_name: 12345\n  groom_name: [a, b]\n");
  bucket.seedJson("data/couples/couple_20261102_rrrrrr/members.json", [{ user_id: "user_a1", role: "owner" }]);
  bucket.seedText("data/couples/couple_20261102_ssssss/profile.yaml", ":::không phải yaml {{{");
  bucket.seedJson("data/couples/couple_20261102_ssssss/members.json", [{ user_id: "user_a1", role: "co-pho" }]);
  const r = await list({ size: 50 });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.total, 1);
  const cs = r.json.items[0].couples.map((c) => [c.bride_name, c.groom_name, c.role]);
  assert.deepEqual(cs, [
    [null, null, null], // ssssss: yaml hỏng, vai trò lạ -> null
    [null, null, "owner"], // rrrrrr: tên không phải chuỗi
    [null, "Trần Đức Minh", "owner"], // qqqqqq: tên rỗng -> null, tên có khoảng trắng thừa được cắt
  ]);
});

test("TC1 members.json hỏng hoặc không có chủ hợp lệ -> dòng 'unknown', không làm lỗi cả danh sách", async () => {
  seedWorld();
  bucket.seedText("data/couples/couple_20260701_gggggg/members.json", "{không phải json");
  bucket.seedJson("data/couples/couple_20260702_hhhhhh/members.json", { khong: "phai mang" });
  const r = await list({ size: 50 });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.total, 13);
  assert.equal(r.json.items.filter((i) => i.kind === "unknown").length, 4);
});

test("TC1 chưa có cặp đôi nào: 200, danh sách rỗng", async () => {
  const r = await list({});
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.total, 0);
  assert.equal(r.json.total_pages, 0);
  assert.deepEqual(r.json.items, []);
});

/* ───────────── tiêu chí 2: chia trang, tìm kiếm ───────────── */

test("TC2 chia trang: cỡ 4 -> 4,4,1; ghép lại bằng danh sách đầy đủ; trang quá cuối -> 200 rỗng; Clerk chỉ tra tài khoản của trang", async () => {
  seedWorld();
  const full = (await list({ size: 50 })).json.items.map(shape);
  const got = [];
  const sizes = [];
  for (const page of [1, 2, 3]) {
    resetClerkCache();
    clerkLookups.length = 0;
    const r = await list({ page, size: 4 });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.total, 11);
    assert.equal(r.json.total_pages, 3);
    assert.equal(r.json.page, page);
    sizes.push(r.json.items.length);
    got.push(...r.json.items.map(shape));
    const onPage = new Set(r.json.items.filter((i) => i.kind === "account").map((i) => i.email));
    const wanted = Object.entries(EMAILS).filter(([, e]) => onPage.has(e)).map(([id]) => id);
    for (const id of clerkLookups) assert.ok(wanted.includes(id), `trang ${page} tra Clerk người không nằm trên trang: ${id}`);
    assert.ok(new Set(clerkLookups).size <= wanted.length);
  }
  assert.deepEqual(sizes, [4, 4, 3]);
  assert.deepEqual(got, full);
  const past = await list({ page: 4, size: 4 });
  assert.equal(past.status, 200);
  assert.deepEqual(past.json.items, []);
  assert.equal(past.json.total, 11);
});

test("TC2 đầu vào sai -> 400 bad_request, không đọc dữ liệu", async () => {
  seedWorld();
  const bad = [
    { page: 0 }, { page: -1 }, { page: 1.5 }, { page: "2" }, { page: null },
    { size: 0 }, { size: 51 }, { size: "x" }, { size: 2.5 },
    { q: 5 }, { q: ["lan"] }, { q: "a".repeat(101) },
    "{không phải json", "[]", "null",
  ];
  for (const body of bad) {
    const r = await list(body);
    assert.equal(r.status, 400, `${JSON.stringify(body)} -> ${r.status} ${r.text}`);
    assert.deepEqual(r.json, { error: "bad_request" });
    assert.match(r.headers.get("cache-control") || "", /no-store/);
  }
  assert.deepEqual(bucket.reads, []);
  assert.equal(lists, 0, "đầu vào sai không được liệt kê R2");
  // ranh giới hợp lệ
  for (const body of [{ size: 1 }, { size: 50 }, { q: "a".repeat(100) }, { q: "" }, { q: "   " }]) {
    const r = await list(body);
    assert.equal(r.status, 200, `${JSON.stringify(body).slice(0, 40)} -> ${r.status} ${r.text}`);
  }
});

test("TC2 chỉ POST: GET (kể cả ?q=) và PUT, DELETE, PATCH -> 405, không xử lý q trên URL", async () => {
  seedWorld();
  for (const [method, p] of [["GET", ROUTE], ["GET", `${ROUTE}?q=lan&page=2`], ["PUT", ROUTE], ["DELETE", ROUTE], ["PATCH", ROUTE]]) {
    const r = await call(method, p, { body: method === "GET" ? undefined : {} });
    assert.equal(r.status, 405, `${method} ${p} -> ${r.status}`);
    assert.match(r.headers.get("cache-control") || "", /no-store/, `405 ${method}`);
  }
  assert.deepEqual(bucket.reads, []);
  assert.equal(lists, 0);
});

async function ids(q) {
  const r = await list({ q, size: 50 });
  assert.equal(r.status, 200, `${q}: ${r.text}`);
  return r.json;
}
const emailsOf = (j) => j.items.map((i) => i.email || i.kind);

test("TC2 tìm không phân biệt dấu và hoa thường: tên (cô dâu, chú rể), cả đ/Đ", async () => {
  seedWorld();
  for (const q of ["nguyen thi lan", "NGUYỄN THỊ LAN", "Nguyễn thị lan", "nguyễn  thị   lan", "  nguyen thi lan  "]) {
    const j = await ids(q);
    assert.equal(j.total, 1, q);
    assert.equal(j.items[0].email, EMAILS.user_a1, q);
  }
  assert.equal((await ids("tran duc minh")).items[0].email, EMAILS.user_a1, "tên chú rể");
  const dong = await ids("ĐÔNG");
  assert.equal(dong.total, 1, "Đông");
  assert.equal(dong.items[0].kind, "guest");
  assert.equal((await ids("dong")).total, 1);
  assert.equal((await ids("dang thu hang")).total, 1, "Đặng Thu Hằng");
  assert.equal((await ids("ĐẶNG")).total, 1);
});

test("TC2 tìm theo email; dòng khớp vẫn hiện đủ mọi cặp đôi của nó; khách và dòng không rõ không khớp email", async () => {
  seedWorld();
  const z = await ids("ZUNG.DO");
  assert.equal(z.total, 1);
  assert.equal(z.items[0].email, EMAILS.user_a5);
  const ex = await ids("example.com");
  assert.equal(ex.total, 6);
  assert.ok(ex.items.every((i) => i.kind === "account"));
  const hang = await ids("hang");
  assert.equal(hang.total, 1);
  assert.equal(hang.items[0].couples.length, 3, "dòng khớp giữ đủ 3 cặp đôi, không bị lọc theo cặp đôi");
  assert.deepEqual(emailsOf(await ids("mai phuong")), [EMAILS.user_a2, EMAILS.user_a3], "cặp đôi chung xuất hiện ở cả hai dòng, giữ thứ tự");
});

test("TC2 nhãn hiển thị và ký tự đặc biệt không phải là nội dung tìm kiếm", async () => {
  seedWorld();
  for (const q of ["khach", "khách", "chua dien", "chưa điền", "owner", "viewer", "user_a1", "couple_2026", "guest_g1", "2026-10-30"]) {
    assert.equal((await ids(q)).total, 0, `"${q}" không được khớp`);
  }
  for (const q of ["a(b[", "%", "_", ".*", "\\", "'; DROP", "<script>"]) {
    assert.equal((await ids(q)).total, 0, `"${q}" phải được coi là chuỗi thường`);
  }
});

test("TC2 tìm có phân trang: total và total_pages theo kết quả đã lọc", async () => {
  seedWorld();
  const r = await list({ q: "example.com", page: 2, size: 2 });
  assert.equal(r.json.total, 6);
  assert.equal(r.json.total_pages, 3);
  assert.deepEqual(r.json.items.map((i) => i.email), [EMAILS.user_a1, EMAILS.user_a4]);
});

/* ───────────── tiêu chí 4: riêng tư ───────────── */

const ALLOWED_TOP = ["cached", "computed_at", "counts", "email_complete", "items", "page", "size", "total", "total_pages"];
const ALLOWED_ITEM = ["couples", "email", "email_status", "kind"];
const ALLOWED_COUPLE = ["bride_name", "created_at", "groom_name", "role"];

test("TC4 phản hồi chỉ có đúng các trường cho phép; không điện thoại, không mã người dùng, không mã cặp đôi, không email cũ trong members.json", async () => {
  seedWorld();
  const r = await list({ size: 50 });
  assert.deepEqual(Object.keys(r.json).sort(), ALLOWED_TOP);
  for (const it of r.json.items) {
    assert.deepEqual(Object.keys(it).sort(), ALLOWED_ITEM);
    for (const c of it.couples) assert.deepEqual(Object.keys(c).sort(), ALLOWED_COUPLE);
  }
  for (const p of [...PHONES, "84901234567", "901234567", "912345678", "987654321"]) {
    assert.ok(!r.text.includes(p), `lộ số điện thoại ${p}`);
  }
  assert.ok(!/phone|dien_thoai|sdt|mobile/i.test(r.text), "có trường điện thoại");
  assert.ok(!/user_[a-z0-9]|guest_[a-z0-9]|couple_\d|idn_|ph_user/i.test(r.text), "lộ mã người dùng/cặp đôi/mã Clerk");
  assert.ok(!r.text.includes("stale@example.com"), "email phải lấy từ Clerk, không lấy bản sao trong members.json");
});

test("TC4 chỉ trả về ngày (YYYY-MM-DD), không giờ", async () => {
  seedWorld();
  const r = await list({ size: 50 });
  for (const it of r.json.items) for (const c of it.couples) assert.match(c.created_at, /^\d{4}-\d{2}-\d{2}$/);
  seedCouple("couple_khongcongay", [["user_a1", "owner"]], "A", "B");
  resetMemberStatsCache();
  const r2 = await list({ q: "lan", size: 50 });
  assert.ok(r2.json.items[0].couples.some((c) => c.created_at === null), "id không có ngày -> created_at null");
});

test("TC4 mọi phản hồi của route cấm bộ nhớ đệm trung gian (Cache-Control: no-store)", async () => {
  seedWorld();
  for (const body of [{}, { q: "lan" }, { page: 9 }, { size: 0 }]) {
    const r = await list(body);
    const cc = (r.headers.get("cache-control") || "").toLowerCase();
    assert.match(cc, /no-store/, `${JSON.stringify(body)} -> "${cc}"`);
    assert.ok(!/public|max-age=[1-9]|s-maxage/.test(cc), cc);
  }
});

test("TC4 từ khoá tìm và tên không bị gửi cho Clerk, không vào console, kể cả khi Clerk lỗi", async () => {
  seedWorld();
  assert.equal((await list({ q: "nguyễn thị lan", size: 50 })).status, 200);
  await list({ q: "trần đức minh" });
  for (const u of clerkUrls) {
    assert.ok(!/nguy|lan|tran|minh|duc/i.test(decodeURIComponent(u).normalize("NFD").replace(/[̀-ͯ]/g, "")), `URL Clerk chứa từ khoá/tên: ${u}`);
    assert.ok(u.startsWith("https://api.clerk.com/"), `gọi ra ngoài lạ: ${u}`);
  }
  for (const mode of ["throw", "http500"]) {
    clerkMode = mode;
    resetMemberStatsCache();
    resetClerkCache();
    await list({ q: "nguyễn thị lan" });
    await list({});
  }
  noLeakInConsole("TC4");
});

/* ───────────── tiêu chí 5: Clerk lỗi ───────────── */

test("TC5 Clerk lỗi (ném lỗi, HTTP 500) hoặc thiếu khoá: vẫn 200, đủ tên, email_status unavailable, khách không đổi", async () => {
  for (const [label, mode, envExtra] of [
    ["ném lỗi", "throw", {}],
    ["http 500", "http500", {}],
    ["thiếu khoá", "ok", { CLERK_SECRET_KEY: undefined }],
  ]) {
    bucket = new MemoryBucket();
    const env = makeEnv(envExtra);
    seedWorld();
    clerkMode = mode;
    clerkUrls.length = 0;
    resetMemberStatsCache();
    resetClerkCache();
    const r = await list({ size: 50 }, { env });
    assert.equal(r.status, 200, `${label}: ${r.text}`);
    assert.equal(r.json.total, 11, label);
    assert.equal(r.json.email_complete, false, label);
    const got = r.json.items.map(shape);
    const want = EXPECTED.map(expectShape).map((e) =>
      e.kind === "account" ? { ...e, email: null, status: "unavailable" } : e,
    );
    assert.deepEqual(got, want, label);
    if (label === "thiếu khoá") assert.deepEqual(clerkUrls, [], "thiếu khoá thì không gọi mạng");
  }
});

test("TC5 Clerk lỗi + tìm theo tên vẫn ra; tìm theo email không ra và email_complete=false", async () => {
  seedWorld();
  clerkMode = "throw";
  const byName = await list({ q: "nguyen thi lan" });
  assert.equal(byName.status, 200);
  assert.equal(byName.json.total, 1);
  assert.equal(byName.json.items[0].email_status, "unavailable");
  const byMail = await list({ q: "lan.nguyen@example.com" });
  assert.equal(byMail.status, 200);
  assert.equal(byMail.json.total, 0);
  assert.equal(byMail.json.email_complete, false);
});

test("TC5 Clerk trả 404 cho một người (tài khoản đã xoá): chỉ dòng đó unavailable, các dòng khác bình thường", async () => {
  seedWorld();
  delete EMAILS.user_a3;
  try {
    const r = await list({ size: 50 });
    const a3 = r.json.items.find((i) => i.couples.some((c) => c.created_at === "2026-08-01"));
    assert.equal(a3.email_status, "unavailable");
    assert.equal(a3.email, null);
    assert.equal(r.json.items.filter((i) => i.email_status === "ok").length, 5);
    assert.equal(r.json.email_complete, false);
  } finally {
    EMAILS.user_a3 = "binh.vo@example.com";
  }
});

/* ───────────── tiêu chí 3: chỉ đọc ───────────── */

test("TC3 chỉ đọc: không ghi, không xoá, không đọc nhật ký admin hay hội thoại, R2 y nguyên sau mọi lời gọi", async () => {
  seedWorld();
  const snapshot = JSON.stringify([...bucket.data.entries()].sort());
  assert.equal((await list({})).status, 200, "route phải tồn tại và trả 200 cho admin");
  for (const body of [{}, { q: "lan" }, { page: 2, size: 3 }, { q: "x", refresh: true }, { size: 0 }]) await list(body);
  clerkMode = "throw";
  await list({ refresh: true });
  assert.deepEqual(bucket.putLog, [], "không được put");
  assert.equal(deletes, 0, "không được delete");
  assert.equal(JSON.stringify([...bucket.data.entries()].sort()), snapshot);
  assert.ok(!bucket.reads.some((k) => k.includes("conversations/") || k.startsWith("data/admin/")), "không đọc hội thoại/nhật ký");
  assert.deepEqual(bucket.keys("data/admin/"), [], "không tạo nhật ký admin");
});

test("TC3 route cũ members-summary không đổi (chỉ số tổng vẫn đúng)", async () => {
  seedWorld();
  const r = await call("GET", "/api/admin/members-summary");
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(Object.keys(r.json).sort(), ["accounts", "cached", "computed_at", "couples"]);
  assert.equal(r.json.couples.total, 12);
});

/* ───────────── hiệu năng: quét R2 có cache ───────────── */

function seedMany(n, off = 0) {
  for (let i = 0; i < n; i++) {
    const id = `couple_20261001_${String(i).padStart(6, "0")}`;
    bucket.seedJson(`data/couples/${id}/members.json`, [{ user_id: i % 3 === 0 ? `guest_x${i}` : `user_x${i + off}`, role: "owner" }]);
    bucket.seedText(`data/couples/${id}/profile.yaml`, `couple:\n  bride_name: "Cô Dâu ${i}"\n  groom_name: "Chú Rể ${i}"\n`);
  }
  bucket.putLog.length = 0;
  bucket.reads.length = 0;
}

test("TC2 hiệu năng: 1.000 cặp đôi, lần đầu <= 2 lần đọc R2 mỗi cặp và < 5 giây; lần sau trong 5 phút không đọc R2; refresh đọc lại; mỗi request <= 20 lần gọi Clerk, mỗi tài khoản tra tối đa một lần", async () => {
  seedMany(1000);
  manyUsers = 1000;
  const t0 = Date.now();
  const first = await list({ page: 1, size: 50 });
  assert.equal(first.status, 200, first.text);
  assert.equal(first.json.total, 1000);
  const acc = first.json.items.filter((i) => i.kind === "account");
  assert.ok(acc.length > 10, "trang 50 dòng phải có hơn 10 tài khoản (Clerk thật mặc định trả 10 mỗi trang nếu quên limit)");
  assert.ok(acc.every((i) => i.email_status === "ok" && i.email), "mọi tài khoản trên trang phải có email");
  assert.equal(first.json.email_complete, true);
  assert.ok(clerkUrls.length <= 20, `không tìm: ${clerkUrls.length} lần gọi Clerk > 20`);
  assert.ok(Date.now() - t0 < 5000, "lần đầu quá 5 giây");
  assert.ok(bucket.reads.length <= 2000, `đọc R2 ${bucket.reads.length} lần > 2 x 1000`);
  assert.equal(first.json.cached, false);

  bucket.reads.length = 0;
  const callsBefore = clerkUrls.length;
  const second = await list({ page: 2, size: 20, q: "chu re 5" });
  assert.equal(second.status, 200);
  assert.equal(bucket.reads.length, 0, "lần hai trong 5 phút không được đọc R2 lại");
  assert.ok(clerkUrls.length - callsBefore <= 20, `một request tìm kiếm gọi Clerk ${clerkUrls.length - callsBefore} lần > 20 (phải tra theo lô)`);
  assert.equal(second.json.cached, true);
  assert.ok(second.json.total >= 1);
  assert.equal(second.json.email_complete, true, "tìm: mọi 667 email phải tra được trong trần 20 lần gọi (phải đặt limit)");

  const third = await list({ page: 1, size: 20, refresh: true });
  assert.equal(third.json.cached, false);
  assert.ok(bucket.reads.length > 0, "refresh phải đọc lại R2");

  const seen = new Set();
  for (const id of clerkLookups) {
    assert.ok(!seen.has(id), `tra Clerk hai lần cho ${id}`);
    seen.add(id);
  }
  assert.deepEqual(bucket.putLog, []);
});

/* ───────────── bổ sung theo D1 ───────────── */

test("TC2 thứ tự ổn định: giống nhau khi Clerk lên/xuống, cache email trống/đầy, cache danh sách hết hạn giữa các trang; ca hoà theo kind rồi khoá nội bộ", async () => {
  seedWorld();
  const want = EXPECTED.map(expectShape);
  const orderOf = (r) => r.json.items.map(shape).map((x) => x.couples.map((c) => `${c[1]}:${c[3]}`).join("/")); // tên cô dâu + vai trò theo thứ tự
  const wantNames = want.map((x) => x.couples.map((c) => `${c[1]}:${c[3]}`).join("/"));
  // 1) Clerk lên
  assert.deepEqual(orderOf(await list({ size: 50 })), wantNames);
  // 2) Clerk xuống (thứ tự không được đổi vì email không có)
  clerkMode = "throw";
  resetMemberStatsCache();
  resetClerkCache();
  assert.deepEqual(orderOf(await list({ size: 50 })), wantNames);
  // 3) ghép các trang cỡ 3, mỗi trang dựng lại danh sách và xoá cache email: phải bằng danh sách đầy đủ, không trùng, không sót
  clerkMode = "ok";
  const got = [];
  for (const page of [1, 2, 3, 4]) {
    resetMemberStatsCache();
    resetClerkCache();
    const r = await list({ page, size: 3 });
    got.push(...orderOf(r));
  }
  assert.deepEqual(got, wantNames);
  // 4) cache email chỉ có một phần (đã tra trang 2) rồi tra trang 1
  resetMemberStatsCache();
  resetClerkCache();
  await list({ page: 2, size: 3 });
  const p1 = await list({ page: 1, size: 3 });
  assert.deepEqual(orderOf(p1), wantNames.slice(0, 3));
  // 5) cache email đã đầy (ai cũng có email) nhưng danh sách dựng lại: thứ tự vẫn không đổi theo email
  await list({ size: 50 });
  resetMemberStatsCache();
  assert.deepEqual(orderOf(await list({ size: 50 })), wantNames);
  assert.equal(EMAILS.user_a6 < EMAILS.user_a5, true, "dữ liệu thử phải có email đảo ngược user_id để bắt cách xếp theo email");
  // ca hoà cụ thể: cùng ngày 2026-10-25: account (a4) trước guest (g2, g3 theo user_id) trước unknown
  assert.deepEqual(want.slice(4, 8).map((x) => x.kind), ["account", "guest", "guest", "unknown"]);
});

test("TC2 dòng chữ đếm: counts theo loại của các dòng khớp (account, guest, unknown)", async () => {
  seedWorld();
  assert.deepEqual((await list({})).json.counts, { account: 6, guest: 3, unknown: 2 });
  assert.deepEqual((await list({ q: "example.com" })).json.counts, { account: 6, guest: 0, unknown: 0 });
  assert.deepEqual((await list({ q: "dong" })).json.counts, { account: 0, guest: 1, unknown: 0 });
  assert.deepEqual((await list({ q: "khong-co-ai" })).json.counts, { account: 0, guest: 0, unknown: 0 });
  assert.deepEqual((await list({ page: 3, size: 4 })).json.counts, { account: 6, guest: 3, unknown: 2 }, "counts tính trên mọi dòng khớp, không chỉ trang hiện tại");
});

test("TC2 Clerk không hiểu user_id (trả danh sách không lọc, mặc định 10/trang): vẫn đủ email nhờ đọc theo trang có limit, trong trần 20 lần", async () => {
  seedMany(300);
  manyUsers = 300;
  clerkNoUserIdFilter = true;
  const r = await list({ page: 1, size: 50 });
  assert.equal(r.status, 200, r.text);
  const acc = r.json.items.filter((i) => i.kind === "account");
  assert.ok(acc.length > 10);
  assert.ok(acc.every((i) => i.email_status === "ok"), "đường lui phải lấy đủ email");
  assert.equal(r.json.email_complete, true);
  assert.ok(clerkUrls.length <= 20, `${clerkUrls.length} lần gọi Clerk > 20`);
  const t = await list({ q: "co dau 7", size: 50 });
  assert.equal(t.status, 200);
  assert.ok(clerkUrls.length <= 40, "request thứ hai cũng <= 20 lần");
});

test("TC2 vượt trần 20 lần gọi Clerk: không gọi quá 20, phần chưa tra được là unavailable, email_complete=false, vẫn 200", async () => {
  seedMany(30, 15000); // người cần tra nằm sau vị trí 15.000 trong danh sách Clerk, đọc theo trang 500 cần > 20 lần
  manyUsers = 16000;
  clerkNoUserIdFilter = true;
  const r = await list({ size: 50 });
  assert.equal(r.status, 200, r.text);
  assert.ok(clerkUrls.length <= 20, `${clerkUrls.length} lần gọi Clerk > 20`);
  assert.equal(r.json.email_complete, false);
  assert.ok(r.json.items.some((i) => i.kind === "account" && i.email_status === "unavailable" && i.email === null));
});

test("TC4 members-summary cũng có Cache-Control: no-store (bất biến cả vùng); 405 của route mới cũng vậy", async () => {
  seedWorld();
  const r = await call("GET", "/api/admin/members-summary");
  assert.equal(r.status, 200, r.text);
  assert.match(r.headers.get("cache-control") || "", /no-store/);
  const bad = await call("GET", "/api/admin/members-summary?refresh=1");
  assert.match(bad.headers.get("cache-control") || "", /no-store/);
});
