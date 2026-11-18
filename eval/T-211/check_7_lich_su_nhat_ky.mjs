#!/usr/bin/env node
// T-211 tiêu chí 7 (repo tohong-back): "Lịch sử sửa" (history) và Nhật ký (audit) ghi trước/sau của địa chỉ và SĐT; lịch sử KHÔNG chứa zalo/website; lần bị từ chối hoặc không đổi gì không ghi dòng nào.
// Chạy từ gốc tohong-hq: node eval/T-211/check_7_lich_su_nhat_ky.mjs
import { setup, reporter, outbound } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, del, audit, T, A } = S;
const A1 = "12 Nguyễn Huệ, Quận 1", A2 = "99 Lê Lợi, Quận 1";
const hist = async () => (await detail()).history || [];
const n0 = (await audit("&action=vendor.override")).length;
await put({ address: A1 });
let h = await hist();
R.check("lần 1 (đặt địa chỉ): history[0] action edit, changes.address {before:null, after}, có seq/at/by", h[0]?.action === "edit" && JSON.stringify(h[0]?.changes?.address) === JSON.stringify({ before: null, after: A1 }) && !!h[0]?.seq && !Number.isNaN(Date.parse(h[0]?.at)) && h[0]?.by === "admin", h[0]);
await put({ contact: { phone: "0912 345 678" } });
h = await hist();
R.check("lần 2 (đặt SĐT): changes.phone {before:null, after:'0912345678'}; không có changes.address", JSON.stringify(h[0]?.changes?.phone) === JSON.stringify({ before: null, after: "0912345678" }) && !("address" in (h[0]?.changes || {})), h[0]);
await put({ address: A2, contact: { phone: "028 3822 2222" } });
h = await hist();
R.check("lần 3 (đổi cả hai): cả address và phone có trước/sau đúng, trong cùng một mục", h[0]?.changes?.address?.before === A1 && h[0]?.changes?.address?.after === A2 && h[0]?.changes?.phone?.before === "0912345678" && h[0]?.changes?.phone?.after === "02838222222", h[0]);
await put({ contact: { phone: "02838222222", zalo: "ZALOSENTINEL211", website: "https://sentinel211.example" } });
h = await hist();
R.check("đổi zalo/website: mục lịch sử có changes.contact.changed = true, KHÔNG có changes.phone, không lộ zalo/website", h[0]?.changes?.contact?.changed === true && !("phone" in (h[0]?.changes || {})) && !/sentinel211/i.test(JSON.stringify(h)), h[0]);
const nH = h.length;
await put({ address: null });
h = await hist();
R.check("xoá địa chỉ: changes.address {before: A2, after: null}", JSON.stringify(h[0]?.changes?.address) === JSON.stringify({ before: A2, after: null }), h[0]);
// không đổi / bị từ chối: không thêm mục
const nBefore = (await hist()).length, a1 = (await audit()).length;
await put({ address: null }); await put({ contact: { phone: "0283 822 2222", zalo: "ZALOSENTINEL211", website: "https://sentinel211.example" } });
await put({ address: "abc" }); await put({ contact: { phone: "123" } });
R.check("lưu y giá trị / bị từ chối: không thêm mục lịch sử, không thêm dòng Nhật ký", (await hist()).length === nBefore && (await audit()).length === a1, [(await hist()).length - nBefore, (await audit()).length - a1]);
// Nhật ký
const ents = await audit("&action=vendor.override");
R.check("Nhật ký: mỗi lần sửa thành công đúng một dòng vendor.override (5 lần)", ents.length - n0 === 5, ents.length - n0);
const byNew = ents.filter((e) => e.target_id === T.id);
const first = byNew[byNew.length - 1], second = byNew[byNew.length - 2], third = byNew[byNew.length - 3];
R.check("dòng 1: before không có address; after.address = A1; admin_id đúng", !first?.before?.address && first?.after?.address === A1 && first?.admin_id === "admin" && first?.target_type === "vendor", [first?.before, first?.after]);
R.check("dòng 2: before.contact.phone rỗng; after.contact.phone = 0912345678; after.address vẫn A1", !second?.before?.contact?.phone && second?.after?.contact?.phone === "0912345678" && second?.after?.address === A1, [second?.before, second?.after]);
R.check("dòng 3: before (A1, 0912345678) -> after (A2, 02838222222)", third?.before?.address === A1 && third?.before?.contact?.phone === "0912345678" && third?.after?.address === A2 && third?.after?.contact?.phone === "02838222222", [third?.before, third?.after]);
await put({ address: A1 });
const dl = await del();
const clr = (await audit("&action=vendor.override_clear")).find((e) => e.target_id === T.id);
R.check("Bỏ ghi đè: dòng vendor.override_clear có before.address, before.contact.phone; after null", dl.status === 200 && clr?.before?.address === A1 && clr?.before?.contact?.phone === "02838222222" && clr?.after === null, [dl.status, clr?.before, clr?.after]);
h = await hist();
R.check("Bỏ ghi đè: history có thêm mục action clear liệt kê address và phone về null; các mục cũ còn nguyên", h[0]?.action === "clear" && h[0]?.changes?.address?.before === A1 && h[0]?.changes?.address?.after === null && h[0]?.changes?.phone?.before === "02838222222" && h[0]?.changes?.phone?.after === null && h.length > nH, h[0]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
