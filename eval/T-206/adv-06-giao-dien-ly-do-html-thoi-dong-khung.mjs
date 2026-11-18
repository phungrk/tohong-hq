#!/usr/bin/env node
// T-206 adv-06 (adversary, tầng 3, giao diện thật + worker thật): (a) lý do xoá chứa HTML/script hiện thành CHỮ, không chạy; (b) "Thôi" sau khi đã gõ lý do không gọi API,
// không đổi bản sửa; (c) khôi phục vendor có bản sửa: khung hiện lại khung sửa, không lỗi; (d) khôi phục vendor không có bản sửa: không hiện lỗi 404 trên màn.
// Spec T-203 Tình huống 1 bước 3 ("Thôi đóng khung, không gọi API"), Tình huống 3 (hàng hiện lý do), Tình huống 4 (khôi phục về đúng trạng thái), Tình huống 3 cuối ("Không có trạng thái kẹt").
// Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-206/adv-06-giao-dien-ly-do-html-thoi-dong-khung.mjs --repo .
import { scenario, uniqueVendor, closeAll, outbound } from "../T-203/lib/ui.mjs";
import { reporter, asAdmin, DEL, VENDOR_POOL } from "../T-203/lib/common.mjs";
const R = reporter();
const S = await scenario();
const { page } = S;
const A = asAdmin(S.env);
const V = uniqueVendor("photography");
const W = VENDOR_POOL.find((v) => v.category === "makeup" && v.name.length > 4 && VENDOR_POOL.filter((x) => x.name === v.name).length === 1 && !/[<>&"']/.test(v.name));
const XSS = `<img src=x onerror="window.__xss=1"><b>đậm</b> & "trùng"`;
const POST_DEL = /^POST \/api\/admin\/vendors\/[^/]+\/delete$/, POST_RES = /^POST \/api\/admin\/vendors\/[^/]+\/restore$/;
const fail = async (fn, n) => { try { await fn(); } catch (e) { R.check("bước giao diện chạy được (" + n + "): " + String(e.message).split("\n")[0].slice(0, 100), false); await closeAll(); R.done(); } };
const pv = await A("PUT", `/api/admin/vendors/${V.id}/override`, { priceMin: 7, priceMax: 9, expected_version: 0 });
R.check("tiền điều kiện: vendor V có bản sửa giá", pv.status === 200, [pv.status, pv.text.slice(0, 60)]);
const wd = await A("POST", DEL(W.id), { expected_version: 0, reason: "W không bản sửa" });
R.check("tiền điều kiện: vendor W (không bản sửa) đã xoá qua API", wd.status === 200, [wd.status, wd.text.slice(0, 60)]);

await fail(async () => { await S.openList(); await S.search(V.name); await S.rowOf(V.name).click(); await S.btn("Xoá vendor").waitFor(); }, "mở V");
// (b) Thôi sau khi đã gõ lý do
await S.btn("Xoá vendor").click();
await page.getByLabel("Lý do xoá").fill("định xoá nhưng thôi");
await S.btn("Thôi").click();
await page.waitForTimeout(300);
const d0 = await A("GET", `/api/admin/vendors/${V.id}`);
R.check("Thôi sau khi gõ lý do: không gọi API ghi nào, V chưa xoá, bản sửa còn nguyên", S.calls.length === 0 && d0.json?.deleted === false && d0.json?.override?.priceMin === 7, [S.calls, d0.json?.deleted]);
// (a) lý do HTML
await S.btn("Xoá vendor").click();
await page.getByLabel("Lý do xoá").fill(XSS);
await S.btn("Xác nhận xoá").click();
await page.waitForTimeout(800);
R.check("xác nhận: đúng một lần gọi xoá", S.writes(POST_DEL).length === 1, S.calls);
await fail(async () => { await S.pickLabel("Đã xoá"); await S.search(V.name); await S.rowOf(V.name).waitFor(); }, "nhãn Đã xoá");
const rt = await S.rowOf(V.name).innerText();
R.check("hàng 'Đã xoá' hiện lý do HTML thành chữ nguyên văn", rt.includes(XSS), rt.slice(0, 200));
await S.rowOf(V.name).click();
await fail(async () => { await S.btn("Khôi phục vendor").waitFor(); }, "khung V đã xoá");
R.check("khung chi tiết hiện lý do HTML thành chữ nguyên văn", (await page.locator("body").innerText()).includes(XSS));
R.check("không có <img>/<b> nào sinh từ lý do; script không chạy", await page.evaluate(() => window.__xss === undefined) && await page.locator("img[src='x']").count() === 0, await page.evaluate(() => window.__xss));
// (c) khôi phục V (có bản sửa)
await S.btn("Khôi phục vendor").click();
await page.waitForTimeout(900);
const body1 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
R.check("khôi phục V: đúng một lần gọi; không thông báo lỗi trên màn", S.writes(POST_RES).length === 1 && !/không tìm thấy|vendor_not_found|lỗi/i.test(body1), [S.calls, body1.slice(0, 160)]);
const d1 = await A("GET", `/api/admin/vendors/${V.id}`);
R.check("khôi phục V: back deleted:false, bản sửa giá còn", d1.json?.deleted === false && d1.json?.override?.priceMin === 7, d1.json?.override);
R.check("khung không còn nút 'Khôi phục vendor' (không kẹt ở khung đã xoá)", await S.btn("Khôi phục vendor").count() === 0);
// (d) khôi phục W (không bản sửa): biến khỏi mọi nhãn, không lỗi 404 trên màn
await S.pickLabel("Đã xoá"); await S.search(W.name);
await fail(async () => { await S.rowOf(W.name).click(); await S.btn("Khôi phục vendor").waitFor(); }, "khung W");
await S.btn("Khôi phục vendor").click();
await page.waitForTimeout(900);
const body2 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
R.check("khôi phục W: đúng hai lần gọi khôi phục tổng; không thông báo 'không tìm thấy'/404 trên màn", S.writes(POST_RES).length === 2 && !/không tìm thấy|vendor_not_found|404/i.test(body2), [S.calls, body2.slice(0, 200)]);
R.check("khôi phục W: nút 'Khôi phục vendor' không còn (không kẹt)", await S.btn("Khôi phục vendor").count() === 0);
const dw = await A("GET", `/api/admin/vendors/${W.id}`);
R.check("khôi phục W: back deleted:false, không bản sửa", dw.json?.deleted === false && dw.json?.override == null, [dw.status, dw.json?.deleted, dw.json?.override]);
R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, [S.external, outbound]);
await closeAll();
R.done();
