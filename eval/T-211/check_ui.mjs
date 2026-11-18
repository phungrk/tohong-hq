#!/usr/bin/env node
// T-211 (repo tohong-front, chạy cùng worker thật của tohong-back): giao diện admin sửa tay địa chỉ + SĐT.
// Chạy: cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-211/check_ui.mjs --repo . --case 1|2 [--dist DIR]
// Đo CHỮ người dùng thấy (tên ô, tên nút, chữ trên màn), không đọc mã nguồn, không bám class.
//  case 1 (tiêu chí 11): tab Dữ liệu vendor > chọn vendor: ô "Địa chỉ" và "Số điện thoại" (cùng nhóm "chỉ admin thấy"); lỗi kiểm định hiện bằng chữ; lưu hiện lại giá trị đã chuẩn hoá; để trống + Lưu = xoá; "Bỏ ghi đè" xoá cả hai.
//  case 2 (tiêu chí 13): hộp kết nối: chi tiết yêu cầu có "Địa chỉ vendor" và "Liên hệ vendor" (ĐT <số>) đúng giá trị admin đã sửa.
import { REPO, CASE, scenario, uniqueVendor, closeAll, outbound } from "../T-203/lib/ui.mjs";
import { reporter, asAdmin, asCouple, PUT } from "./lib/common.mjs";
const R = reporter();
const S = await scenario();
const { page } = S;
const V = uniqueVendor("photography");
const PUTRE = /^PUT \/api\/admin\/vendors\/[^/]+\/override$/;
const mustFail = async (fn) => { try { await fn(); } catch (e) { R.check("bước giao diện chạy được: " + String(e.message).split("\n")[0].slice(0, 110), false); await closeAll(); R.done(); } };
const A = asAdmin(S.env);
const det = async () => (await A("GET", `/api/admin/vendors/${V.id}`)).json || {};
const ADDR_IN = "  12 Nguyễn Huệ,   Quận 1, TP.HCM  ", ADDR = "12 Nguyễn Huệ, Quận 1, TP.HCM";

if (CASE === "1") {
  await mustFail(async () => { await S.openList(); await S.search(V.name); await S.rowOf(V.name).click(); await page.getByText("phiên bản ghi đè").waitFor(); });
  const addr = () => page.getByLabel("Địa chỉ", { exact: true }), phone = () => page.getByLabel("Số điện thoại", { exact: true });
  R.check("tiền điều kiện: khung sửa có ô 'Địa chỉ' và ô 'Số điện thoại'", await addr().count() === 1 && await phone().count() === 1);
  R.check("khung sửa nói rõ liên hệ/địa chỉ chỉ admin thấy (chữ 'chỉ admin thấy')", /chỉ admin thấy/i.test(await S.bodyText()));
  await mustFail(async () => { await addr().fill(ADDR_IN); await phone().fill("abc"); });
  await S.btn("Lưu ghi đè").click(); await page.waitForTimeout(700);
  let t = await S.bodyText();
  R.check("SĐT sai: hiện chữ 'Số điện thoại không hợp lệ'; ô vẫn giữ 'abc'; biểu mẫu còn", t.includes("Số điện thoại không hợp lệ") && (await phone().inputValue()) === "abc" && await S.btn("Lưu ghi đè").count() === 1, t.slice(0, 160));
  R.check("SĐT sai: back không lưu gì (không có bản sửa, địa chỉ cũng không lưu)", (await det()).override === null, (await det()).override);
  await phone().fill("0912 345 678"); await addr().fill("abc");
  await S.btn("Lưu ghi đè").click(); await page.waitForTimeout(700);
  t = await S.bodyText();
  R.check("địa chỉ sai: hiện chữ 'Địa chỉ không hợp lệ'; ô vẫn giữ 'abc'", t.includes("Địa chỉ không hợp lệ") && (await addr().inputValue()) === "abc", t.slice(0, 160));
  await addr().fill(ADDR_IN);
  const w0 = S.writes(PUTRE).length;
  await S.btn("Lưu ghi đè").click(); await page.waitForTimeout(900);
  t = await S.bodyText();
  const d = await det();
  R.check("lưu đúng: một lần PUT, hiện 'Đã lưu', không còn chữ lỗi", S.writes(PUTRE).length === w0 + 1 && /Đã lưu/.test(t) && !t.includes("không hợp lệ"), S.calls.slice(-3));
  R.check("back thật nhận địa chỉ đã chuẩn hoá và SĐT chỉ-chữ-số", d.override?.address === ADDR && d.override?.contact?.phone === "0912345678", d.override);
  R.check("sau lưu, hai ô hiện lại giá trị ĐÃ chuẩn hoá (địa chỉ gọn khoảng trắng, SĐT 0912345678)", (await addr().inputValue()) === ADDR && (await phone().inputValue()) === "0912345678", [await addr().inputValue(), await phone().inputValue()]);
  // trống + Lưu = xoá
  await addr().fill(""); await phone().fill("");
  await S.btn("Lưu ghi đè").click(); await page.waitForTimeout(900);
  const d2 = await det();
  R.check("để trống cả hai + Lưu: back không còn địa chỉ/SĐT (xoá, không lỗi); hai ô trống", !d2.override?.address && !d2.override?.contact?.phone && (await addr().inputValue()) === "" && (await phone().inputValue()) === "" && !(await S.bodyText()).includes("không hợp lệ"), d2.override);
  // Bỏ ghi đè
  await addr().fill(ADDR); await phone().fill("028 3822 2222");
  await S.btn("Lưu ghi đè").click(); await page.waitForTimeout(900);
  R.check("tiền điều kiện: lưu lại 200", (await det()).override?.address === ADDR && (await det()).override?.contact?.phone === "02838222222");
  await S.btn("Bỏ ghi đè").click();
  await S.btn("Xác nhận bỏ ghi đè").click(); await page.waitForTimeout(900);
  const d3 = await det();
  R.check("Bỏ ghi đè: back không còn địa chỉ/SĐT; hai ô trống", d3.override === null && (await addr().inputValue()) === "" && (await phone().inputValue()) === "", d3.override);
}

if (CASE === "2") {
  const C = asCouple(S.env);
  S.bucket.data.set("data/couples/couple_1/members.json", JSON.stringify([{ user_id: "couple_1", role: "owner" }]));
  const pu = await A("PUT", PUT(V.id), { expected_version: 0, address: ADDR, contact: { phone: "0912 345 678" } });
  R.check("tiền điều kiện: admin lưu địa chỉ + SĐT (API) 200", pu.status === 200, [pu.status, pu.json?.error]);
  const mk = await C("POST", "/api/couples/couple_1/connect-requests", { vendor_id: V.id, contact: { phone: "0901234567" }, note: "eval T-211", source: "chat", client_request_id: "u1" });
  R.check("tiền điều kiện: cặp đôi gửi yêu cầu kết nối 2xx", mk.status >= 200 && mk.status < 300, [mk.status, mk.text.slice(0, 80)]);
  await mustFail(async () => { await page.goto(`${S.base}/?admin`); await page.getByRole("button", { name: "Hộp kết nối" }).first().click(); await page.getByText(V.name).first().click(); await page.getByText("Liên hệ vendor").waitFor(); });
  await page.waitForTimeout(500);
  const dd = await page.locator("dl").filter({ hasText: "Liên hệ vendor" }).first().innerText();
  const flat = dd.replace(/\s+/g, " ");
  R.check("chi tiết yêu cầu: có dòng 'Địa chỉ vendor' với địa chỉ đã chuẩn hoá", /Địa chỉ vendor/.test(flat) && flat.includes(ADDR), flat.slice(0, 300));
  R.check("chi tiết yêu cầu: 'Liên hệ vendor' hiện 'ĐT 0912345678'", /Liên hệ vendor\s*ĐT 0912345678/.test(flat), flat.slice(0, 300));
  R.check("liên hệ của cặp đôi (0901234567) vẫn hiện ở 'Liên hệ đã gửi', không lẫn với vendor", /Liên hệ đã gửi\s*ĐT 0901234567/.test(flat), flat.slice(0, 300));
  const A2 = await A("PUT", PUT(V.id), { expected_version: (await det()).version, address: null, contact: null });
  await page.reload(); await page.getByRole("button", { name: "Hộp kết nối" }).first().click(); await page.getByText(V.name).first().click(); await page.getByText("Liên hệ vendor").waitFor();
  const flat2 = (await page.locator("dl").filter({ hasText: "Liên hệ vendor" }).first().innerText()).replace(/\s+/g, " ");
  R.check("sau khi admin xoá: 'Địa chỉ vendor' và 'Liên hệ vendor' hiện '—'", A2.status === 200 && /Địa chỉ vendor\s*—/.test(flat2) && /Liên hệ vendor\s*—/.test(flat2), flat2.slice(0, 300));
}
R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, [S.external, outbound]);
await closeAll();
R.done();
