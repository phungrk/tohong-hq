#!/usr/bin/env node
// T-199 adv-04 (tầng 3, adversary): spec T-197 mục 2, 3 + bảng ca biên "Hai admin sửa cùng lúc": "danh sách luôn đọc kho mới nhất mỗi lần gọi; bảng chỉ đúng tại thời điểm tải".
// Nghĩa là: MỖI lần bảng tải (đổi Status), mọi hàng hiện ra mang đúng chữ Status đang chọn theo kho lúc tải. Một bản cài giữ "bản ghi vừa ghi" ở trình duyệt (đè lên review
// server trả) sẽ vẽ chữ cũ lên hàng server vừa trả: lọc "Chờ áp dụng" mà hàng ghi "Tên hơi giống".
// Kịch bản (một admin ở trình duyệt, Capu ghi qua API thật ở chỗ khác):
//  1. trình duyệt: Status "Chờ Capu", Rút lại hàng X (Tên hơi giống)  -> hàng rời bảng
//  2. Capu (nơi khác) Approve X                                          -> kho: X "Chờ áp dụng"
//  3. trình duyệt: chọn Status "Chờ áp dụng"                             -> X có trong bảng, cột Status của MỌI hàng phải là "Chờ áp dụng"
//  4. ngược lại: trình duyệt Approve Y ở "Tên hơi giống", người khác Rút lại Y, trình duyệt chọn "Tên hơi giống" -> Y hiện với chữ "Tên hơi giống", không phải "Chờ Capu"
// Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-199/adv-04-loc-sau-ghi-cua-nguoi-khac.mjs --repo . --case 1   (TOHONG_BACK_REPO)
import { scenario, closeAll, settle, hien, act, pickStatus, readRows, readAllPages } from "../T-197/lib/ui.mjs";
import { ROWS, reporter, expected, call, ADMIN, CAPU, outbound } from "../T-197/lib/common.mjs";

const R = reporter();
const sp = (x) => String(x).replace(/\s+/g, " ").trim();
try {
  const S = await scenario("small");
  await settle(S, hien(0, ROWS.length));
  // 1
  await act(S, () => pickStatus(S, "Chờ Capu"));
  const w0 = expected(S.st, { status: "pending_capu" });
  await settle(S, hien(0, w0.length));
  const X = w0.find((r) => r.group === "name_similar");
  const rows0 = await readRows(S);
  const xi = rows0.findIndex((g) => g.name === sp(X.name));
  await act(S, () => S.table.locator("tbody tr").nth(xi).getByRole("button", { name: "Rút lại" }).click());
  S.st.delete(X.id);
  await settle(S, hien(0, w0.length - 1));
  // 2
  const w = await call(S.env, "PUT", `/api/admin/vendor-enrich/${X.id}/review`, { token: `dev:${CAPU}`, body: { decision: "approve" } });
  R.check("Capu Approve X ở nơi khác: 200", w.status === 200, w.status);
  S.st.set(X.id, { byCapu: true });
  // 3
  await act(S, () => pickStatus(S, "Chờ áp dụng"));
  const w1 = expected(S.st, { status: "pending_apply" });
  await settle(S, hien(0, w1.length));
  const got = await readAllPages(S, w1.length);
  R.check(`lọc "Chờ áp dụng" sau khi Capu ghi ở nơi khác: có hàng "${sp(X.name)}" và MỌI hàng ghi "Chờ áp dụng"`, got.some((g) => g.name === sp(X.name)) && got.every((g) => g.status === "Chờ áp dụng"), got.filter((g) => g.status !== "Chờ áp dụng"));
  // 4
  await act(S, () => pickStatus(S, "Tên hơi giống"));
  const n0 = expected(S.st, { status: "name_similar" });
  await settle(S, hien(0, n0.length));
  const yi = n0.findIndex((r, k) => k < 50 && r.approvable && !r.override);
  const Y = n0[yi];
  await act(S, () => S.table.locator("tbody tr").nth(yi).getByRole("button", { name: "Approve", exact: true }).click());
  S.st.set(Y.id, { byCapu: false });
  await settle(S, hien(0, n0.length - 1));
  const d = await call(S.env, "DELETE", `/api/admin/vendor-enrich/${Y.id}/review`, { token: `dev:${CAPU}` });
  R.check("người khác Rút lại Y ở nơi khác: 200", d.status === 200, d.status);
  S.st.delete(Y.id);
  await act(S, () => pickStatus(S, "Chờ Capu"));
  await settle(S, hien(0, expected(S.st, { status: "pending_capu" }).length));
  await act(S, () => pickStatus(S, "Tên hơi giống"));
  await settle(S, hien(0, n0.length));
  const g2 = await readRows(S);
  R.check(`lọc "Tên hơi giống" lại: hàng "${sp(Y.name)}" có mặt và MỌI hàng ghi "Tên hơi giống" (không "Chờ Capu" cũ)`, g2.some((g) => g.name === sp(Y.name)) && g2.every((g) => g.status === "Tên hơi giống"), g2.filter((g) => g.status !== "Tên hơi giống"));
  R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, S.external);
  await S.ctx.close();
} catch (e) {
  R.check("thao tác không thực hiện được", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
