#!/usr/bin/env node
// T-199 adv-06 (tầng 3, adversary): mạng chậm, ghi xen giữa các lần tải KHÔNG đi qua reload (đổi Hạng mục, ô tìm, chip, đổi trang do useLoad tự gọi),
// và hai lần ghi liên tiếp trên hai hàng khác nhau. Spec T-197 mục 2, 3, 8 + ca biên "bảng đúng tại thời điểm tải": khi mọi yêu cầu đã xong (lặng),
// chữ cột Status của mọi hàng đang hiện phải khớp kho, và khi đang lọc Status thì mọi hàng mang giá trị đó, tổng đúng.
// Mạng chậm được giả ở trình duyệt: danh sách đọc kho NGAY khi trình duyệt gửi nhưng trả về CHẬM (LIST_MS); lần ghi chờ PUT_MS rồi mới tới worker.
// Như vậy một danh sách gửi trước khi ghi xong sẽ mang dữ liệu cũ và về SAU phản hồi ghi — đúng ca "phản hồi cũ về muộn".
// Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-199/adv-06-phan-hoi-cu-moi-duong-tai.mjs --repo . --case 1   (TOHONG_BACK_REPO)
import { scenario, closeAll, settle, hien, act, pickStatus, readRows, PAGE, CHIPS } from "../T-197/lib/ui.mjs";
import { ROWS, LABEL, CHIP, reporter, expected, shown, worker, outbound, fold } from "../T-197/lib/common.mjs";

const R = reporter();
const sp = (x) => String(x).replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
async function slowNet(S, cfg) {
  S.pend = 0;
  await S.page.route("http://api.test/**", async (route) => {
    const rq = route.request(); const u = new URL(rq.url());
    const isList = rq.method() === "GET" && u.pathname === "/api/admin/vendor-enrich";
    const isWrite = ["PUT", "DELETE"].includes(rq.method()) && /\/review$/.test(u.pathname);
    if (!isList && !isWrite) return route.fallback();
    S.pend++;
    try {
      if (isWrite) await sleep(cfg.put(u.pathname));
      if (isList) S.lists.push(u.search);
      const headers = { ...rq.headers() }; delete headers.host; const body = rq.postData();
      const res = await worker.fetch(new Request("http://localhost" + u.pathname + u.search, { method: rq.method(), headers, body: body == null || isList ? undefined : body }), S.env, { waitUntil() {} });
      const text = await res.text();
      if (isList) await sleep(cfg.list);
      await route.fulfill({ status: res.status, contentType: "application/json", headers: CORS, body: text }).catch(() => {});
    } finally { S.pend--; }
  });
}
const quiet = async (S) => { for (let i = 0; i < 200 && S.pend > 0; i++) await sleep(50); await S.page.waitForTimeout(500); for (let i = 0; i < 200 && S.pend > 0; i++) await sleep(50); await S.page.waitForTimeout(300); };
// Hàng đang hiện so với kho: mỗi hàng (theo STT/tên) có chữ Status = shown(row, st)
const nameCount = new Map(); for (const r of ROWS) nameCount.set(sp(r.name), (nameCount.get(sp(r.name)) || 0) + 1);
const byName = new Map(ROWS.filter((r) => nameCount.get(sp(r.name)) === 1).map((r) => [sp(r.name), r])); // tên trùng (vd. hai "The Bridal Room") không so được theo tên: bỏ qua
const mismatches = async (S) => (await readRows(S)).filter((g) => g.name && byName.has(g.name) && g.status !== shown(byName.get(g.name), S.st)).map((g) => ({ ...g, kho: shown(byName.get(g.name), S.st) }));
const pickFree = (S, rows, k = 0) => rows.map((g) => ROWS[g.n - 1]).filter((r) => r.approvable && !r.override && !S.st.has(r.id))[k];
const approveRow = async (S, r) => { const i = (await readRows(S)).findIndex((g) => g.name === sp(r.name)); await S.table.locator("tbody tr").nth(i).getByRole("button", { name: "Approve", exact: true }).click(); };

try {
  // A. Approve X (PUT chậm), trong lúc đó đổi bằng các đường KHÔNG qua reload; danh sách cũ về muộn. Khi lặng: X ghi "Chờ Capu", mọi hàng khớp kho.
  const paths = [
    ["Hạng mục", async (S, X) => S.page.getByRole("combobox", { name: "Hạng mục" }).selectOption(X.category)],
    ["ô tìm (Enter)", async (S, X) => { const sb = S.page.getByRole("searchbox", { name: "Tìm vendor" }); await sb.fill(fold(X.name).split(/\s+/).find((w) => w.length >= 4) || fold(X.name)); await sb.press("Enter"); }],
    ["chip", async (S, X) => { const key = ["full", "name_similar", "addr_diff", "no_google_photo"].find((k) => CHIP[k](X)) || "all"; await S.page.getByRole("button", { name: new RegExp("^" + CHIPS[key].replace(/%/g, "\\%") + " · \\d+$") }).click(); }],
    ["Trang sau rồi Trang trước", async (S) => { await S.page.getByRole("button", { name: "Trang sau" }).click(); await S.page.getByText(new RegExp(`^Hiển thị ${PAGE + 1}–`)).waitFor(); await S.page.getByRole("button", { name: "Trang trước" }).click(); }],
  ];
  for (const [label, go] of paths) {
    const S = await scenario("small");
    await settle(S, hien(0, ROWS.length));
    await slowNet(S, { put: () => 900, list: 1500 });
    const X = pickFree(S, await readRows(S));
    await approveRow(S, X);
    await go(S, X);           // danh sách này đọc kho trước khi PUT ghi, về sau phản hồi PUT
    await quiet(S);
    S.st.set(X.id, { byCapu: false });
    const got = await readRows(S); const gx = got.find((g) => g.name === sp(X.name)); const mm = await mismatches(S);
    R.check(`A. Approve "${sp(X.name)}" còn chạy, đổi ${label}: khi lặng hàng đó ghi "Chờ Capu" và mọi hàng khớp kho`, gx && gx.status === "Chờ Capu" && mm.length === 0, [gx, mm.slice(0, 2)]);
    await S.ctx.close();
  }
  // A2. như A nhưng đang lọc Status (nhóm của X) và đổi Hạng mục: X phải rời bảng, tổng đúng
  {
    const S = await scenario("small");
    await settle(S, hien(0, ROWS.length));
    const X = pickFree(S, await readRows(S));
    await act(S, () => pickStatus(S, LABEL[X.group]));
    await settle(S, hien(0, expected(S.st, { status: X.group }).length));
    await slowNet(S, { put: () => 900, list: 1500 });
    await approveRow(S, X);
    await S.page.getByRole("combobox", { name: "Hạng mục" }).selectOption(X.category);
    await quiet(S);
    S.st.set(X.id, { byCapu: false });
    const w = expected(S.st, { status: X.group, category: X.category });
    const got = await readRows(S); const pager = (await S.page.locator("body").innerText()).match(/Hiển thị [^\n]+/)?.[0];
    R.check(`A2. lọc "${LABEL[X.group]}", Approve "${sp(X.name)}" còn chạy, đổi Hạng mục: khi lặng "${hien(0, w.length)}", không có X, mọi hàng mang "${LABEL[X.group]}"`,
      pager === hien(0, w.length) && !got.some((g) => g.name === sp(X.name)) && got.every((g) => !g.name || g.status.startsWith(LABEL[X.group])), [pager, got.filter((g) => !g.status?.startsWith(LABEL[X.group])).slice(0, 2)]);
    await S.ctx.close();
  }
  // B. Hai lần ghi liên tiếp trên hai hàng khác nhau, mạng chậm, hai thứ tự về của PUT.
  for (const [ord, put1, put2] of [["PUT 1 về sau PUT 2", 1500, 300], ["PUT 1 về trước PUT 2", 300, 1500]]) {
    for (const st of ["Tất cả", "lọc nhóm"]) {
      const S = await scenario("small");
      await settle(S, hien(0, ROWS.length));
      const rows0 = await readRows(S);
      const X = pickFree(S, rows0, 0);
      let Y = null; let G = null;
      if (st === "lọc nhóm") {
        G = X.group;
        await act(S, () => pickStatus(S, LABEL[G]));
        const w = expected(S.st, { status: G }); await settle(S, hien(0, w.length));
        Y = w.slice(0, PAGE).find((r) => r.approvable && r.id !== X.id && !S.st.has(r.id));
      } else Y = pickFree(S, rows0, 1);
      if (!Y) { R.check(`B. ${ord}, ${st}: có hàng thứ hai để đo`, false); await S.ctx.close(); continue; }
      let n = 0;
      await slowNet(S, { put: () => (n++ === 0 ? put1 : put2), list: 700 });
      await approveRow(S, X);
      await approveRow(S, Y);
      await quiet(S);
      S.st.set(X.id, { byCapu: false }); S.st.set(Y.id, { byCapu: false });
      const got = await readRows(S); const mm = await mismatches(S);
      if (G) {
        const w = expected(S.st, { status: G }); const pager = (await S.page.locator("body").innerText()).match(/Hiển thị [^\n]+/)?.[0];
        R.check(`B. ${ord}, lọc "${LABEL[G]}": Approve hai hàng liền nhau -> khi lặng cả hai rời bảng, "${hien(0, w.length)}", mọi hàng khớp kho`,
          pager === hien(0, w.length) && !got.some((g) => g.name === sp(X.name) || g.name === sp(Y.name)) && mm.length === 0, [pager, mm.slice(0, 2)]);
      } else {
        const gx = got.find((g) => g.name === sp(X.name)), gy = got.find((g) => g.name === sp(Y.name));
        R.check(`B. ${ord}, "Tất cả": Approve hai hàng liền nhau -> khi lặng cả hai ghi "Chờ Capu" tại chỗ, mọi hàng khớp kho`, gx?.status === "Chờ Capu" && gy?.status === "Chờ Capu" && mm.length === 0, [gx, gy, mm.slice(0, 2)]);
      }
      await S.ctx.close();
    }
  }
  R.check("không request ra ngoài", outbound.length === 0, outbound);
} catch (e) {
  R.check("thao tác không thực hiện được", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
