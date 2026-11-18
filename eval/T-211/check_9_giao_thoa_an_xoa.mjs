#!/usr/bin/env node
// T-211 tiêu chí 9 (repo tohong-back): giao thoa với Ẩn / Xoá (T-203): sửa được khi vendor đang ẩn (không đổi cờ ẩn); không sửa được khi đã xoá (409 vendor_deleted); xoá rồi khôi phục giữ nguyên địa chỉ + SĐT; hộp kết nối của vendor đã xoá vẫn đọc được liên hệ để Tơ Hồng xử lý.
// Chạy từ gốc tohong-hq: node eval/T-211/check_9_giao_thoa_an_xoa.mjs
import { setup, reporter, outbound, addrOf, phoneOf, asCouple, DEL, RES, snapshot, diff } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, A, env, bucket, T } = S;
const C = asCouple(env);
bucket.data.set("data/couples/couple_1/members.json", JSON.stringify([{ user_id: "couple_1", role: "owner" }]));
const ADDR = "12 Nguyễn Huệ, Quận 1, TP.HCM", PH = "0912345678";
// Ẩn
const h = await put({ hidden: true, hidden_reason: "đóng cửa tạm" });
const e = await put({ address: ADDR, contact: { phone: PH } });
let d = await detail();
R.check("vendor đang ẩn: sửa địa chỉ + SĐT 200; cờ ẩn và lý do còn nguyên", h.status === 200 && e.status === 200 && addrOf(d) === ADDR && phoneOf(d) === PH && d.override?.hidden === true && d.override?.hidden_reason === "đóng cửa tạm", [h.status, e.status, d.override]);
const mk = await C("POST", "/api/couples/couple_1/connect-requests", { vendor_id: T.id, contact: { phone: "0901234567" }, note: "eval", source: "chat", client_request_id: "z1" });
const rid = mk.json?.request?.id;
R.check("tiền điều kiện: cặp đôi tạo yêu cầu kết nối cho vendor (2xx)", mk.status >= 200 && mk.status < 300 && !!rid, [mk.status]);
const hist0 = JSON.stringify((await detail()).history);
// Xoá
const x = await A("POST", DEL(T.id), { expected_version: await S.ver(), reason: "eval T-211" });
R.check("tiền điều kiện: xoá vendor 200", x.status === 200, [x.status, x.json?.error]);
const s0 = snapshot(bucket);
const pa = await put({ address: "99 Lê Lợi, Quận 1" }), pp = await put({ contact: { phone: "0987654321" } });
R.check("vendor đã xoá: sửa địa chỉ / SĐT -> 409 vendor_deleted, không ghi gì", pa.status === 409 && pa.json?.error === "vendor_deleted" && pp.status === 409 && pp.json?.error === "vendor_deleted", [pa.status, pp.status, pa.json?.error]);
const dd = diff(s0, snapshot(bucket));
R.check("  (các lần bị từ chối không đổi R2)", dd.added.length + dd.removed.length + dd.changed.length === 0, dd);
const inbox = (await A("GET", `/api/admin/connect-requests/${rid}`)).json;
const iv = inbox?.vendor || inbox?.request?.vendor || {};
R.check("hộp kết nối của vendor đã xoá: vẫn hiện vendor.address + vendor.contact.phone (đã lưu từ trước)", iv.address === ADDR && iv.contact?.phone === PH, iv);
d = await detail();
R.check("chi tiết vendor đã xoá: override vẫn có địa chỉ + SĐT (xoá chỉ thêm khoá deleted*)", d.deleted === true && addrOf(d) === ADDR && phoneOf(d) === PH, d.override);
// Khôi phục
const rs = await A("POST", RES(T.id), { expected_version: await S.ver() });
d = await detail();
R.check("khôi phục: 200; địa chỉ + SĐT + cờ ẩn y nguyên; lịch sử sửa y nguyên (xoá/khôi phục không thêm dòng)", rs.status === 200 && addrOf(d) === ADDR && phoneOf(d) === PH && d.override?.hidden === true && JSON.stringify(d.history) === hist0, [rs.status, d.override]);
const again = await put({ address: "99 Lê Lợi, Quận 1" });
R.check("sau khôi phục lại sửa được (200)", again.status === 200 && addrOf(await detail()) === "99 Lê Lợi, Quận 1", [again.status, again.json?.error]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
