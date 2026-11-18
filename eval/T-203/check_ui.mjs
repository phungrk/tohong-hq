#!/usr/bin/env node
// T-203 (repo tohong-front, chạy cùng worker thật của tohong-back): giao diện admin Xoá / Khôi phục vendor.
// Chạy: cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-203/check_ui.mjs --repo . --case 1|2 [--dist DIR]
// Đo CHỮ người dùng thấy (tên nút, ô nhập, chữ trên màn), không đọc mã nguồn, không bám class.
//  case 1 (tiêu chí 1): Xoá cần lý do + bước xác nhận; không gọi API trước khi xác nhận; Thôi không xoá.
//  case 2 (tiêu chí 8): danh sách "Đã xoá" (nhãn), lý do hiện ra, nút Khôi phục, vendor đã xoá không sửa được, Nhật ký có hai thao tác.
import { REPO, CASE, scenario, uniqueVendor, closeAll, outbound } from "./lib/ui.mjs";
import { reporter } from "./lib/common.mjs";
const R = reporter();
const S = await scenario();
const { page } = S;
const V = uniqueVendor("photography");
const POST_DEL = /^POST \/api\/admin\/vendors\/[^/]+\/delete$/, POST_RES = /^POST \/api\/admin\/vendors\/[^/]+\/restore$/;
const REASON = "Trùng với vendor khác (eval)";
const mustFail = async (fn) => { try { await fn(); } catch (e) { R.check("bước giao diện chạy được: " + String(e.message).split("\n")[0].slice(0, 110), false); await closeAll(); R.done(); } };

await mustFail(async () => { await S.openList(); await S.search(V.name); await S.rowOf(V.name).click(); await page.getByText("phiên bản ghi đè").waitFor(); });
R.check("tiền điều kiện: chọn vendor thấy nút 'Xoá vendor' trong khung sửa", await S.btn("Xoá vendor").count() === 1);

if (CASE === "1") {
  await S.btn("Xoá vendor").click();
  const box = page.getByLabel("Lý do xoá");
  await mustFail(async () => { await box.waitFor(); });
  const confirm = S.btn("Xác nhận xoá");
  R.check("bấm 'Xoá vendor': hiện ô 'Lý do xoá' và nút 'Xác nhận xoá', CHƯA gọi API xoá", await box.count() === 1 && await confirm.count() === 1 && S.writes(POST_DEL).length === 0);
  R.check("lời nhắc trong khung xác nhận nói rõ là khôi phục được (chữ 'khôi phục')", /khôi phục/i.test(await S.bodyText()));
  R.check("lý do trống: 'Xác nhận xoá' bị khoá", await confirm.isDisabled());
  await box.fill("   ");
  R.check("lý do chỉ có khoảng trắng: vẫn bị khoá, không gọi API", await confirm.isDisabled() && S.writes(POST_DEL).length === 0);
  await box.fill(REASON);
  R.check("có lý do: 'Xác nhận xoá' mở, vẫn chưa gọi API", await confirm.isEnabled() && S.writes(POST_DEL).length === 0);
  await S.btn("Thôi").click();
  await page.waitForTimeout(300);
  R.check("bấm 'Thôi': khung xác nhận đóng, không gọi API, vendor còn trong danh sách", await S.btn("Xác nhận xoá").count() === 0 && S.writes(POST_DEL).length === 0 && await S.rowOf(V.name).count() === 1);
  await S.btn("Xoá vendor").click();
  R.check("mở lại: ô lý do trống (không nhớ lý do cũ), nút khoá", (await page.getByLabel("Lý do xoá").inputValue()) === "" && await S.btn("Xác nhận xoá").isDisabled());
  await page.getByLabel("Lý do xoá").fill(REASON);
  await S.btn("Xác nhận xoá").click();
  await page.waitForTimeout(800);
  R.check("xác nhận: đúng MỘT lần gọi xoá", S.writes(POST_DEL).length === 1, S.calls);
  R.check("sau xoá: thông báo 'Đã xoá' (có chữ khôi phục) và vendor biến khỏi danh sách đang xem", /Đã xoá/.test(await S.bodyText()) && await S.rowOf(V.name).count() === 0, null);
  const det = await (await import("./lib/common.mjs")).asAdmin(S.env)("GET", `/api/admin/vendors/${V.id}`);
  R.check("back thật nhận đúng lý do đã gõ", det.json?.deleted === true && det.json?.deleted_info?.reason === REASON, det.json?.deleted_info);
}

if (CASE === "2") {
  // xoá qua giao diện để có dữ liệu thật
  await S.btn("Xoá vendor").click();
  await page.getByLabel("Lý do xoá").fill(REASON);
  await S.btn("Xác nhận xoá").click();
  await page.waitForTimeout(800);
  const opts = await page.getByLabel("Nhãn", { exact: true }).locator("option").allInnerTexts();
  R.check("ô 'Nhãn' có lựa chọn 'Đã xoá'", opts.map((x) => x.trim()).includes("Đã xoá"), opts);
  R.check("danh sách mặc định (Mọi nhãn) không còn vendor đã xoá", await S.rowOf(V.name).count() === 0);
  await mustFail(async () => { await S.pickLabel("Đã xoá"); await S.search(V.name); });
  const row = S.rowOf(V.name);
  R.check("chọn 'Đã xoá': vendor có trong bảng", await row.count() === 1);
  const rt = (await row.innerText()).replace(/\s+/g, " ");
  R.check("hàng đã xoá hiện nhãn 'Đã xoá' và lý do đã gõ", /Đã xoá/.test(rt) && rt.includes(REASON), rt);
  R.check("hàng đã xoá KHÔNG hiện nhãn 'Đang ẩn' (xoá khác ẩn)", !/Đang ẩn/.test(rt), rt);
  await row.click();
  await page.waitForTimeout(500);
  R.check("chọn vendor đã xoá: có nút 'Khôi phục vendor'", await S.btn("Khôi phục vendor").count() === 1);
  R.check("vendor đã xoá không sửa được: không có 'Lưu ghi đè', 'Bỏ ghi đè', 'Xoá vendor'", await S.btn("Lưu ghi đè").count() === 0 && await S.btn("Bỏ ghi đè").count() === 0 && await S.btn("Xoá vendor").count() === 0);
  // Nhật ký
  const audit = await ctxAudit();
  async function ctxAudit() {
    await page.getByRole("button", { name: /Nhật ký/ }).first().click();
    await page.waitForTimeout(500);
    const sel = page.getByLabel("Lọc theo thao tác");
    return { sel, opts: (await sel.locator("option").allInnerTexts()).map((x) => x.trim()) };
  }
  R.check("Nhật ký: bộ lọc có 'Xoá vendor' và 'Khôi phục vendor'", audit.opts.includes("Xoá vendor") && audit.opts.includes("Khôi phục vendor"), audit.opts);
  const at = await S.bodyText();
  R.check("Nhật ký: dòng xoá hiện chữ 'Xoá vendor' và id vendor", at.includes("Xoá vendor") && at.includes(V.id), at.slice(0, 200));
  // Khôi phục
  await page.getByRole("button", { name: "Dữ liệu vendor" }).first().click();
  await mustFail(async () => { await page.getByRole("button", { name: "Danh sách vendor" }).click(); await S.pickLabel("Đã xoá"); await S.search(V.name); await S.rowOf(V.name).click(); await S.btn("Khôi phục vendor").waitFor(); });
  await S.btn("Khôi phục vendor").click();
  await page.waitForTimeout(800);
  R.check("bấm 'Khôi phục vendor': đúng MỘT lần gọi khôi phục", S.writes(POST_RES).length === 1, S.calls);
  R.check("sau khôi phục: vendor rời danh sách 'Đã xoá'", await S.rowOf(V.name).count() === 0);
  await S.pickLabel("Mọi nhãn"); await S.search(V.name);
  R.check("về 'Mọi nhãn': vendor có lại, không còn nhãn 'Đã xoá'", await S.rowOf(V.name).count() === 1 && !/Đã xoá/.test((await S.rowOf(V.name).innerText())));
  await page.getByRole("button", { name: /Nhật ký/ }).first().click();
  await page.waitForTimeout(500);
  const at2 = await S.bodyText();
  R.check("Nhật ký: có dòng 'Khôi phục vendor'", at2.includes("Khôi phục vendor"), at2.slice(0, 200));
}
R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, [S.external, outbound]);
await closeAll();
R.done();
