#!/usr/bin/env node
// T-203 tiêu chí 9 (repo tohong-back): hộp yêu cầu kết nối của admin báo riêng "đã xoá" (khác "đang ẩn"), cả trạng thái hiện tại lẫn lúc tạo yêu cầu;
// luồng cặp đôi gửi yêu cầu kết nối cho vendor đã xoá chạy như với vendor đang ẩn.
// Chạy từ gốc tohong-hq: node eval/T-203/check_9_hop_ket_noi_admin.mjs
import { call, fresh, pickTarget, asAdmin, asCouple, DEL, RES, VENDOR_POOL, reporter, outbound } from "./lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env), C = asCouple(env);
bucket.data.set("data/couples/couple_1/members.json", JSON.stringify([{ user_id: "couple_1", role: "owner" }]));
const T = await pickTarget(env, "photography"), H = await pickTarget(env, "makeup");
bucket.data.set("data/couples/couple_2/members.json", JSON.stringify([{ user_id: "couple_2", role: "owner" }]));
const C2 = (method, p, b) => call(env, method, p, { token: "dev:couple_2", body: b });
const body = (id, crid) => ({ vendor_id: id, contact: { phone: "0901234567" }, note: "eval T-203", source: "chat", client_request_id: crid });
const mk = (id, crid) => C("POST", "/api/couples/couple_1/connect-requests", body(id, crid));
// Quy tắc chống trùng: cùng cặp đôi + cùng vendor còn mở thì trả 200 + yêu cầu cũ. Nên r2 (vendor đã xoá) và rh (vendor ẩn) đều do cặp đôi thứ hai gửi, chưa có yêu cầu mở nào với vendor đó: cùng điều kiện, cùng tạo mới.
const mk2 = (id, crid) => C2("POST", "/api/couples/couple_2/connect-requests", { ...body(id, crid) });
const inbox = async (rid) => { const l = await A("GET", "/api/admin/connect-requests?status=all"); const row = (l.json?.requests || []).find((x) => x.id === rid); const d = await A("GET", `/api/admin/connect-requests/${rid}`); return { list: row, detail: d.json?.request, st: [l.status, d.status] }; };
const rid = (r) => r.json?.request?.id;

// Vendor đang ẩn (đối chứng) và vendor sẽ xoá
const hp = await A("PUT", `/api/admin/vendors/${H.id}/override`, { hidden: true, hidden_reason: "eval ẩn", expected_version: 0 });
R.check("tiền điều kiện: ẩn vendor đối chứng 200", hp.status === 200, [hp.status, hp.text.slice(0, 60)]);
const r1 = await mk(T.id, "r1");
R.check("tiền điều kiện: cặp đôi tạo yêu cầu cho vendor đang hiện (2xx)", r1.status >= 200 && r1.status < 300 && !!rid(r1), [r1.status, r1.text.slice(0, 80)]);
const rh = await mk2(H.id, "rh");
R.check("đối chứng: cặp đôi gửi yêu cầu cho vendor đang ẩn (2xx)", rh.status >= 200 && rh.status < 300 && !!rid(rh), [rh.status, rh.text.slice(0, 80)]);
const b0 = await inbox(rid(r1));
R.check("trước khi xoá: hộp admin vendor_deleted:false, vendor_hidden:false", b0.list?.vendor_deleted === false && b0.list?.vendor_hidden === false && b0.detail?.vendor_deleted === false, [b0.list?.vendor_deleted, b0.list?.vendor_hidden]);
const bh = await inbox(rid(rh));
R.check("đối chứng vendor đang ẩn: vendor_hidden:true, vendor_deleted:false, vendor_hidden_at_create:true, vendor_deleted_at_create:false", bh.list?.vendor_hidden === true && bh.list?.vendor_deleted === false && bh.list?.vendor_hidden_at_create === true && bh.list?.vendor_deleted_at_create === false, bh.list);

const del = await A("POST", DEL(T.id), { expected_version: 0, reason: "eval T-203: đóng cửa" });
R.check("xoá vendor 200", del.status === 200, [del.status, del.text.slice(0, 60)]);
const b1 = await inbox(rid(r1));
R.check("yêu cầu cũ (tạo lúc vendor còn hiện): danh sách hộp admin báo vendor_deleted:true và KHÔNG báo vendor_hidden (đã xoá khác đang ẩn)", b1.list?.vendor_deleted === true && b1.list?.vendor_hidden === false, [b1.list?.vendor_deleted, b1.list?.vendor_hidden]);
R.check("yêu cầu cũ: chi tiết admin cũng vendor_deleted:true, vendor_hidden:false; lúc tạo vendor chưa xoá (vendor_deleted_at_create:false)", b1.detail?.vendor_deleted === true && b1.detail?.vendor_hidden === false && b1.detail?.vendor_deleted_at_create === false && b1.detail?.vendor_hidden_at_create === false, b1.detail);
R.check("yêu cầu cũ vẫn mở được, vendor id/tên còn (không mất yêu cầu)", b1.list?.vendor?.id === T.id && b1.list?.vendor?.name === VENDOR_POOL.find((v) => v.id === T.id).name, b1.list?.vendor);

// Luồng cặp đôi cho vendor đã xoá = luồng cho vendor đang ẩn
const r2 = await mk2(T.id, "r2");
R.check("cặp đôi gửi yêu cầu cho vendor đã xoá: cùng mã trạng thái như với vendor đang ẩn (không 404, không chặn)", r2.status === rh.status && !!rid(r2), [r2.status, rh.status, r2.text.slice(0, 80)]);
const b2 = await inbox(rid(r2));
R.check("yêu cầu tạo lúc vendor đã xoá: vendor_deleted_at_create:true, vendor_deleted:true; vendor_hidden_at_create:false (cờ riêng, vendor không ẩn)", b2.list?.vendor_deleted_at_create === true && b2.list?.vendor_deleted === true && b2.list?.vendor_hidden_at_create === false && b2.detail?.vendor_deleted_at_create === true, [b2.list?.vendor_deleted_at_create, b2.list?.vendor_deleted, b2.list?.vendor_hidden_at_create]);
const pub = JSON.stringify((await C("GET", "/api/couples/couple_1/connect-requests")).json || {});
R.check("phía cặp đôi: danh sách yêu cầu của họ không lộ cờ đã xoá/đang ẩn của vendor", !/vendor_deleted|deleted_reason|vendor_hidden/.test(pub), pub.slice(0, 120));

// Khôi phục: trạng thái hiện tại về như cũ, trạng thái lúc tạo giữ nguyên
const v = (await A("GET", `/api/admin/vendors/${T.id}`)).json?.version ?? 0;
const res = await A("POST", RES(T.id), { expected_version: v });
R.check("khôi phục 200", res.status === 200, [res.status, res.text.slice(0, 60)]);
const b3 = await inbox(rid(r1)), b4 = await inbox(rid(r2));
R.check("sau khôi phục: vendor_deleted:false ở cả hai yêu cầu; cờ lúc tạo của yêu cầu r2 vẫn true (lịch sử không đổi)", b3.list?.vendor_deleted === false && b4.list?.vendor_deleted === false && b4.list?.vendor_deleted_at_create === true, [b3.list?.vendor_deleted, b4.list?.vendor_deleted, b4.list?.vendor_deleted_at_create]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
