#!/usr/bin/env node
// T-211 tiêu chí 4 (repo tohong-back): admin thấy địa chỉ + SĐT đã sửa ở chi tiết vendor, danh sách vendor và hộp yêu cầu kết nối (cả yêu cầu có từ trước lúc sửa); sửa lại / xoá thì hộp theo ngay.
// Chạy từ gốc tohong-hq: node eval/T-211/check_4_admin_thay_hop_ket_noi.mjs
import { setup, reporter, outbound, addrOf, phoneOf, asCouple, listAll } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, A, bucket, env, T } = S;
const C = asCouple(env);
bucket.data.set("data/couples/couple_1/members.json", JSON.stringify([{ user_id: "couple_1", role: "owner" }]));
const mk = await C("POST", "/api/couples/couple_1/connect-requests", { vendor_id: T.id, contact: { phone: "0901234567" }, note: "eval T-211", source: "chat", client_request_id: "r1" });
const rid = mk.json?.request?.id;
R.check("tiền điều kiện: cặp đôi tạo yêu cầu kết nối (2xx)", mk.status >= 200 && mk.status < 300 && !!rid, [mk.status, mk.text.slice(0, 80)]);
const inbox = async () => ({ list: ((await A("GET", "/api/admin/connect-requests?status=all")).json?.requests || []).find((x) => x.id === rid), det: (await A("GET", `/api/admin/connect-requests/${rid}`)).json });
const v = (x) => x?.vendor || x?.request?.vendor || {};
let b = await inbox();
R.check("chưa sửa: hộp có khoá vendor.address = null (luôn có khoá) và vendor.contact null", "address" in v(b.list) && v(b.list).address === null && (v(b.list).contact ?? null) === null, v(b.list));
const ADDR = "12 Nguyễn Huệ, Quận 1, TP.HCM";
const r = await put({ address: ADDR, contact: { phone: "0912 345 678" } });
R.check("tiền điều kiện: lưu địa chỉ + SĐT 200", r.status === 200, [r.status, r.json?.error]);
const d = await detail();
R.check("chi tiết vendor của admin: override.address và override.contact.phone (đã chuẩn hoá)", addrOf(d) === ADDR && phoneOf(d) === "0912345678", d.override);
b = await inbox();
R.check("hộp kết nối (danh sách): vendor.address đúng, vendor.contact.phone = 0912345678 — cho yêu cầu đã có từ trước lúc sửa", v(b.list).address === ADDR && v(b.list).contact?.phone === "0912345678", v(b.list));
R.check("hộp kết nối (chi tiết một yêu cầu): cùng giá trị", JSON.stringify(v(b.det).address) === JSON.stringify(ADDR) && v(b.det).contact?.phone === "0912345678", v(b.det));
const cp = (x) => x?.contact?.phone ?? x?.request?.contact?.phone;
R.check("liên hệ CỦA CẶP ĐÔI trong yêu cầu không bị đụng (vẫn 0901234567)", cp(b.list) === "0901234567" && cp(b.det) === "0901234567", [cp(b.list), cp(b.det)]);
const row = (await listAll(A, "q=" + encodeURIComponent(S.T.id))).rows.find((x) => x.id === T.id);
R.check("danh sách vendor admin: hàng vendor overridden:true, has_contact:true", row?.overridden === true && row?.has_contact === true, row);
// sửa lại
await put({ address: "99 Lê Lợi, Quận 1", contact: { phone: "028 3822 2222" } });
b = await inbox();
R.check("sửa lại: hộp theo ngay (địa chỉ mới, SĐT mới)", v(b.list).address === "99 Lê Lợi, Quận 1" && v(b.list).contact?.phone === "02838222222", v(b.list));
// chỉ địa chỉ: vẫn overridden
await put({ contact: null });
const row2 = (await listAll(A, "q=" + encodeURIComponent(S.T.id))).rows.find((x) => x.id === T.id);
R.check("chỉ còn địa chỉ: hàng vendor vẫn overridden:true; SĐT trống ở hộp, địa chỉ còn", row2?.overridden === true && (v((await inbox()).list).contact ?? null) === null && v((await inbox()).list).address === "99 Lê Lợi, Quận 1", row2);
// xoá hết
await A("DELETE", `/api/admin/vendors/${T.id}/override?expected_version=${await S.ver()}`);
b = await inbox();
R.check("Bỏ ghi đè: hộp về address null, contact null", (v(b.list).address ?? null) === null && (v(b.list).contact ?? null) === null, v(b.list));
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
