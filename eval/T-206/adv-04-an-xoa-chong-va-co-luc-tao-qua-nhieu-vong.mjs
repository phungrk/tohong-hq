#!/usr/bin/env node
// T-206 adv-04 (adversary, tầng 3): vendor vừa Ẩn vừa Xoá; bỏ ẩn trong lúc đang xoá; xoá -> khôi phục -> xoá lại; cờ "lúc tạo" của yêu cầu kết nối qua nhiều vòng.
// Spec T-203 §Hành vi: "Hai cờ độc lập: vendor có thể vừa Ẩn vừa Xoá"; §Hợp đồng: "Khi vendor đang xoá: PUT …/override … 409 vendor_deleted";
// §Tình huống 2: vendor_deleted_at_create "trạng thái lúc tạo… không đổi sau khi tạo/khôi phục"; vendor_hidden_at_create chỉ phản ánh cờ Ẩn. ADR-127: suy từ Nhật ký.
// Chạy từ gốc tohong-hq: node eval/T-206/adv-04-an-xoa-chong-va-co-luc-tao-qua-nhieu-vong.mjs
import { call, fresh, pickTarget, asAdmin, DEL, RES, reporter, outbound } from "../T-203/lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env);
const couples = ["c_a", "c_b", "c_c", "c_d", "c_e"];
for (const c of couples) bucket.data.set(`data/couples/${c}/members.json`, JSON.stringify([{ user_id: c, role: "owner" }]));
const send = async (c, vid) => { const r = await call(env, "POST", `/api/couples/${c}/connect-requests`, { token: `dev:${c}`, body: { vendor_id: vid, contact: { phone: "0901234567" }, note: "adv-04", source: "chat", client_request_id: `${c}-${vid}` } }); return r.json?.request?.id; };
const view = async (rid) => (await A("GET", `/api/admin/connect-requests/${rid}`)).json?.request;
const ver = async (id) => (await A("GET", `/api/admin/vendors/${id}`)).json?.version ?? 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = await pickTarget(env, "photography");
const id = T.id;

// 1. Ẩn rồi Xoá
await A("PUT", `/api/admin/vendors/${id}/override`, { hidden: true, hidden_reason: "ẩn trước", expected_version: 0 });
await sleep(5);
const d1 = await A("POST", DEL(id), { expected_version: await ver(id), reason: "xoá lần 1" });
R.check("ẩn rồi xoá: 200", d1.status === 200, [d1.status, d1.text.slice(0, 80)]);
await sleep(5);
const rA = await send("c_a", id);
// 2. Bỏ ẩn trong lúc đang xoá -> 409 vendor_deleted, cờ Ẩn còn nguyên
const un = await A("PUT", `/api/admin/vendors/${id}/override`, { hidden: false, expected_version: await ver(id) });
R.check("bỏ ẩn trong lúc đang xoá: 409 vendor_deleted", un.status === 409 && un.json?.error === "vendor_deleted", [un.status, un.text.slice(0, 80)]);
let det = await A("GET", `/api/admin/vendors/${id}`);
R.check("sau lần bỏ ẩn bị từ chối: vẫn ẩn đúng lý do, vẫn xoá", det.json?.override?.hidden === true && det.json?.override?.hidden_reason === "ẩn trước" && det.json?.deleted === true, det.json?.override);
const a = await view(rA);
R.check("yêu cầu tạo lúc vừa ẩn vừa xoá: vendor_hidden_at_create:true, vendor_deleted_at_create:true, vendor_hidden:true, vendor_deleted:true", a?.vendor_hidden_at_create === true && a?.vendor_deleted_at_create === true && a?.vendor_hidden === true && a?.vendor_deleted === true, a && [a.vendor_hidden_at_create, a.vendor_deleted_at_create, a.vendor_hidden, a.vendor_deleted]);
// 3. Khôi phục hai lần
await sleep(5);
const v = await ver(id);
const r1 = await A("POST", RES(id), { expected_version: v });
const r2 = await A("POST", RES(id), { expected_version: r1.json?.version ?? 0 });
R.check("khôi phục lần 1: 200; lần 2 (đúng phiên bản mới): 409 not_deleted", r1.status === 200 && r2.status === 409 && r2.json?.error === "not_deleted", [r1.status, r2.status, r2.json?.error]);
det = await A("GET", `/api/admin/vendors/${id}`);
R.check("sau khôi phục: vẫn ẩn đúng lý do cũ", det.json?.deleted === false && det.json?.override?.hidden === true && det.json?.override?.hidden_reason === "ẩn trước", det.json?.override);
await sleep(5);
// 4. Bỏ ẩn được sau khôi phục; gửi yêu cầu lúc không ẩn không xoá
const un2 = await A("PUT", `/api/admin/vendors/${id}/override`, { hidden: false, expected_version: await ver(id) });
R.check("bỏ ẩn sau khôi phục: 200", un2.status === 200, [un2.status, un2.text.slice(0, 80)]);
await sleep(5);
const rB = await send("c_b", id);
await sleep(5);
// 5. Xoá lần 2 với lý do mới
const d2 = await A("POST", DEL(id), { expected_version: await ver(id), reason: "xoá lần 2" });
det = await A("GET", `/api/admin/vendors/${id}`);
R.check("xoá lần 2: 200, lý do là lý do mới", d2.status === 200 && det.json?.deleted_info?.reason === "xoá lần 2", [d2.status, det.json?.deleted_info]);
await sleep(5);
const rC = await send("c_c", id);
const [va, vb, vc] = [await view(rA), await view(rB), await view(rC)];
R.check("rA (tạo trong vòng xoá 1) giữ vendor_deleted_at_create:true sau khôi phục + xoá lại", va?.vendor_deleted_at_create === true, va?.vendor_deleted_at_create);
R.check("rB (tạo giữa khôi phục và xoá lần 2) vendor_deleted_at_create:false, vendor_hidden_at_create:false", vb?.vendor_deleted_at_create === false && vb?.vendor_hidden_at_create === false, vb && [vb.vendor_deleted_at_create, vb.vendor_hidden_at_create]);
R.check("rC (tạo trong vòng xoá 2, không ẩn) vendor_deleted_at_create:true, vendor_hidden_at_create:false", vc?.vendor_deleted_at_create === true && vc?.vendor_hidden_at_create === false, vc && [vc.vendor_deleted_at_create, vc.vendor_hidden_at_create]);
R.check("cả ba yêu cầu hiện tại: vendor_deleted:true, vendor_hidden:false", [va, vb, vc].every((x) => x?.vendor_deleted === true && x?.vendor_hidden === false), [va, vb, vc].map((x) => [x?.vendor_deleted, x?.vendor_hidden]));
// danh sách khớp chi tiết
const l = await A("GET", "/api/admin/connect-requests?status=all");
const rows = (l.json?.requests || []).filter((x) => [rA, rB, rC].includes(x.id));
R.check("danh sách hộp kết nối khớp chi tiết cho cả ba (deleted/at_create)", rows.length === 3 && rows.every((x) => { const d = [va, vb, vc].find((y) => y.id === x.id); return x.vendor_deleted === d.vendor_deleted && x.vendor_deleted_at_create === d.vendor_deleted_at_create && x.vendor_hidden_at_create === d.vendor_hidden_at_create; }), rows.map((x) => [x.id, x.vendor_deleted_at_create]));
// phía cặp đôi không lộ cờ
const cv = await call(env, "GET", "/api/couples/c_c/connect-requests", { token: "dev:c_c" });
R.check("phía cặp đôi không thấy vendor_deleted*", cv.status === 200 && !/vendor_deleted/.test(cv.text), [cv.status, cv.text.slice(0, 100)]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
