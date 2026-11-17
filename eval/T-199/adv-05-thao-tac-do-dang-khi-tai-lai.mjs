#!/usr/bin/env node
// T-199 adv-05 (tầng 3, adversary): ghi (Approve) còn đang chạy thì bảng tải lại vì đổi Status / đổi trang. Spec T-197 mục 8: "Khi Status khác 'Tất cả', sau mỗi lần
// Approve ... thành công, bảng được tải lại với đúng các bộ lọc ĐANG chọn ... mọi hàng đang hiện vẫn mang giá trị Status đang chọn"; Status "Tất cả": "như hôm nay,
// hàng ở nguyên chỗ và chữ Status đổi" (hôm nay: chữ theo lần ghi vừa xong). Bảng sau khi lặng phải khớp kho (Status hiển thị như spec định nghĩa).
// Mạng chậm được giả bằng cách giữ lời gọi lại ở trình duyệt (không đổi logic back: worker thật xử lý đúng thứ tự mà trình duyệt gửi).
//  a. Status "Tất cả": bấm Approve hàng X (PUT chậm 1,5s), ngay lập tức chọn Status = nhãn nhóm của X (danh sách tải xong trước khi PUT ghi, nên còn X).
//     PUT xong khi Status đang là nhóm đó -> bảng phải tải lại theo bộ lọc đang chọn: khi lặng, mọi hàng mang nhãn nhóm đó, không có X.
//  b. Status "Tất cả", trang 1: bấm Approve X (PUT giữ lại), sang trang 2, về trang 1 (danh sách trang 1 đọc kho TRƯỚC khi PUT ghi, trả về SAU khi PUT xong).
//     Khi lặng: X phải ghi "Chờ Capu" (đúng kho và đúng phản hồi tức thì), không quay về nhãn nhóm cũ kèm nút Approve.
//  c. Status "Tên hơi giống": Approve X rồi bấm Rút lại ngay khi nút hiện (danh sách đang tải chậm). Khi lặng: X ở lại với "Tên hơi giống", tổng như cũ.
// Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-199/adv-05-thao-tac-do-dang-khi-tai-lai.mjs --repo . --case 1   (TOHONG_BACK_REPO)
import { scenario, closeAll, settle, hien, act, pickStatus, readRows, PAGE } from "../T-197/lib/ui.mjs";
import { ROWS, LABEL, reporter, expected, worker, outbound } from "../T-197/lib/common.mjs";

const R = reporter();
const sp = (x) => String(x).replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const viaWorker = async (S, rq) => {
  const u = new URL(rq.url()); const headers = { ...rq.headers() }; delete headers.host; const body = rq.postData();
  const res = await worker.fetch(new Request("http://localhost" + u.pathname + u.search, { method: rq.method(), headers, body: body == null || ["GET", "HEAD"].includes(rq.method()) ? undefined : body }), S.env, { waitUntil() {} });
  return { status: res.status, text: await res.text() };
};
const quiet = async (S) => { await S.page.waitForTimeout(400); await S.table.waitFor(); };
try {
  // a
  {
    const S = await scenario("small");
    await settle(S, hien(0, ROWS.length));
    const all0 = await readRows(S);
    const i = all0.findIndex((g) => { const r = ROWS[g.n - 1]; return r.approvable && !r.override && !S.st.has(r.id); });
    const X = ROWS[all0[i].n - 1];
    let putDone; const putP = new Promise((r) => { putDone = r; });
    await S.page.route(/\/api\/admin\/vendor-enrich\/[^/]+\/review$/, async (route) => { if (route.request().method() === "PUT") { await sleep(1500); await route.fallback(); putDone(); } else await route.fallback(); });
    await S.table.locator("tbody tr").nth(i).getByRole("button", { name: "Approve", exact: true }).click();
    const G = LABEL[X.group];
    await act(S, () => pickStatus(S, G));
    await putP; S.st.set(X.id, { byCapu: false });
    await quiet(S);
    const w = expected(S.st, { status: X.group });
    await settle(S, hien(0, w.length)).catch(() => {});
    const got = await readRows(S);
    R.check(`a. Approve "${sp(X.name)}" còn chạy khi đổi sang Status "${G}" (nhóm của nó): khi lặng, "${hien(0, w.length)}", mọi hàng ghi "${G}", không có hàng vừa Approve`,
      got.every((g) => g.status === G || g.status === `${G} Đã duyệt tay`) && !got.some((g) => g.name === sp(X.name)) && (await S.page.getByText(hien(0, w.length), { exact: true }).count()) === 1,
      [got.filter((g) => !g.status.startsWith(G)).slice(0, 2), (await S.page.locator("body").innerText()).match(/Hiển thị [^\n]+/)?.[0]]);
    await S.ctx.close();
  }
  // b
  {
    const S = await scenario("small");
    await settle(S, hien(0, ROWS.length));
    const all0 = await readRows(S);
    const i = all0.findIndex((g) => { const r = ROWS[g.n - 1]; return r.approvable && !r.override && !S.st.has(r.id); });
    const X = ROWS[all0[i].n - 1];
    let releasePut; const putGate = new Promise((r) => { releasePut = r; }); let putDone; const putP = new Promise((r) => { putDone = r; });
    let holdList = false, releaseList; const listGate = new Promise((r) => { releaseList = r; }); let listComputed; const listC = new Promise((r) => { listComputed = r; });
    await S.page.route("http://api.test/**", async (route) => {
      const rq = route.request(); const u = new URL(rq.url());
      if (rq.method() === "PUT" && /\/review$/.test(u.pathname)) { await putGate; const r = await viaWorker(S, rq); await route.fulfill({ status: r.status, contentType: "application/json", headers: CORS, body: r.text }); putDone(); return; }
      if (holdList && rq.method() === "GET" && u.pathname === "/api/admin/vendor-enrich") {
        holdList = false; S.lists.push(u.search);
        const r = await viaWorker(S, rq); listComputed(); await listGate; // đọc kho NGAY (trước khi PUT ghi), trả về sau
        return route.fulfill({ status: r.status, contentType: "application/json", headers: CORS, body: r.text });
      }
      return route.fallback();
    });
    await S.table.locator("tbody tr").nth(i).getByRole("button", { name: "Approve", exact: true }).click();
    await act(S, () => S.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(S, hien(PAGE, ROWS.length));
    holdList = true;
    await S.page.getByRole("button", { name: "Trang trước" }).click();
    await listC;            // danh sách trang 1 đã đọc kho (X chưa có review)
    releasePut(); await putP; S.st.set(X.id, { byCapu: false });
    await S.page.waitForTimeout(300);
    releaseList();
    await settle(S, hien(0, ROWS.length));
    await quiet(S);
    const got = await readRows(S);
    const gx = got.find((g) => g.name === sp(X.name));
    R.check(`b. Approve "${sp(X.name)}" xong trong lúc trang 1 đang tải lại (Status "Tất cả"): khi lặng hàng đó ghi "Chờ Capu" như kho, không quay về nhãn nhóm cũ`, gx && gx.status === "Chờ Capu", gx);
    await S.ctx.close();
  }
  // c
  {
    const S = await scenario("small");
    await settle(S, hien(0, ROWS.length));
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    const w0 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(0, w0.length));
    const i = w0.findIndex((r, k) => k < PAGE && r.approvable && !r.override);
    const X = w0[i];
    await S.page.route("http://api.test/api/admin/vendor-enrich?*", async (route) => { await sleep(800); await route.fallback(); });
    const row = S.table.locator("tbody tr").nth(i);
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await row.getByRole("button", { name: "Rút lại" }).click({ timeout: 3000 }); // bấm ngay khi nút hiện, danh sách còn đang tải
    await S.page.waitForTimeout(2500);
    await settle(S, hien(0, w0.length));
    await quiet(S);
    const got = await readRows(S);
    const gx = got.find((g) => g.name === sp(X.name));
    R.check(`c. "Tên hơi giống": Approve rồi Rút lại ngay "${sp(X.name)}" khi bảng đang tải: khi lặng "${hien(0, w0.length)}", hàng đó ghi "Tên hơi giống", mọi hàng "Tên hơi giống"`,
      gx && got.every((g) => g.status === "Tên hơi giống"), [gx, got.filter((g) => g.status !== "Tên hơi giống").slice(0, 2)]);
    await S.ctx.close();
  }
  R.check("không request ra ngoài", outbound.length === 0, outbound);
} catch (e) {
  R.check("thao tác không thực hiện được", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
