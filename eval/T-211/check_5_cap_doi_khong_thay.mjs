#!/usr/bin/env node
// T-211 tiêu chí 5 (repo tohong-back): địa chỉ và SĐT vendor do admin nhập KHÔNG ra phía cặp đôi ở bất kỳ bề mặt nào (chi tiết vendor, ghép theo id/hạng mục, trạng thái, đếm, ứng viên chat, khối prompt AI, luồng kết nối).
// Lý do: FR-036 (liên hệ vendor chỉ admin thấy; cặp đôi nhờ Tơ Hồng kết nối). Chạy từ gốc tohong-hq: node eval/T-211/check_5_cap_doi_khong_thay.mjs
import { setup, reporter, outbound, addrOf, phoneOf, asCouple, chatMatch, loadOverlay, VENDOR_POOL } from "./lib/common.mjs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { BACK } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, bucket, env, T, A } = S;
const C = asCouple(env);
bucket.data.set("data/couples/couple_1/members.json", JSON.stringify([{ user_id: "couple_1", role: "owner" }]));
const { formatMatchBlock } = await import(pathToFileURL(path.join(BACK, "lib", "matchFormatter.js")).href);
const { applyToVendor } = await import(pathToFileURL(path.join(BACK, "lib", "vendorOverlay.js")).href);
const SENT = "ĐCSENTINEL211 số 1 Lê Lợi", PHONE = "0912345678";
const leaks = (x) => { const t = typeof x === "string" ? x : JSON.stringify(x); return ["ĐCSENTINEL211", "912345678", "912 345 678", "91 234 5678"].filter((k) => t.includes(k)); };
const r = await put({ address: SENT, contact: { phone: "0912 345 678", zalo: "ZALOSENTINEL211", website: "https://sentinel211.example" } });
R.check("tiền điều kiện: lưu địa chỉ + SĐT 200 và admin thấy lại giá trị", r.status === 200 && addrOf(await detail()) === SENT && phoneOf(await detail()) === PHONE, [r.status, r.json?.error]);
await loadOverlay(env, { force: true });
const surfaces = {
  "GET /api/vendors/:id": await C("GET", `/api/vendors/${T.id}`),
  "GET /api/vendors/match?ids": await C("GET", `/api/vendors/match?ids=${T.id}`),
  "GET /api/vendors/match?category": await C("GET", `/api/vendors/match?category=${T.category}&limit=50`),
  "POST /api/vendors/status": await C("POST", "/api/vendors/status", { ids: [T.id] }),
  "GET /api/vendors/categories": await C("GET", "/api/vendors/categories"),
};
for (const [name, res] of Object.entries(surfaces)) R.check(`${name}: 200 và không chứa địa chỉ/SĐT/zalo/website của admin`, res.status === 200 && leaks(res.text).length === 0 && !/sentinel211/i.test(res.text), [res.status, leaks(res.text)]);
const cm = chatMatch(T.mp);
R.check("ứng viên chat (chatMatch): không chứa địa chỉ/SĐT/zalo/website", leaks(cm).length === 0 && !/sentinel211/i.test(JSON.stringify(cm)), leaks(cm));
const block = formatMatchBlock(cm, { guest_count: 100 });
R.check("khối [VENDOR CANDIDATES] đưa vào prompt AI: không chứa địa chỉ/SĐT/zalo/website", typeof block === "string" && block.length > 20 && leaks(block).length === 0 && !/sentinel211/i.test(block), leaks(block));
R.check("applyToVendor(vendor pool) (đầu vào của mọi bề mặt cặp đôi): không mang address/contact/phone", (() => { const a = applyToVendor(VENDOR_POOL.find((x) => x.id === T.id)); return !("address" in a) && !("contact" in a) && !("phone" in a) && leaks(a).length === 0; })());
// luồng kết nối của cặp đôi
const mk = await C("POST", "/api/couples/couple_1/connect-requests", { vendor_id: T.id, contact: { phone: "0901234567" }, note: "eval T-211", source: "chat", client_request_id: "x1" });
R.check("cặp đôi gửi yêu cầu kết nối: 2xx, phản hồi không chứa địa chỉ/SĐT vendor", mk.status >= 200 && mk.status < 300 && leaks(mk.text).length === 0 && !/sentinel211/i.test(mk.text), [mk.status, leaks(mk.text)]);
const ls = await C("GET", "/api/couples/couple_1/connect-requests");
R.check("cặp đôi xem danh sách yêu cầu của mình: không chứa địa chỉ/SĐT vendor", ls.status === 200 && leaks(ls.text).length === 0 && !/sentinel211/i.test(ls.text), [ls.status, leaks(ls.text)]);
// đối chứng: giá trị có thật ở phía admin (thử nghiệm có nghĩa)
R.check("đối chứng: cùng giá trị CÓ ở phản hồi của admin (hộp kết nối)", ((await A("GET", "/api/admin/connect-requests?status=all")).text).includes("ĐCSENTINEL211"), null);
// kể cả khi vendor đang ẩn
await put({ hidden: true, hidden_reason: "eval" });
const st = await C("POST", "/api/vendors/status", { ids: [T.id] });
const one = await C("GET", `/api/vendors/${T.id}`);
R.check("vendor đang ẩn (kế hoạch đã lưu): /status và /:id vẫn không lộ địa chỉ/SĐT", leaks(st.text).length === 0 && leaks(one.text).length === 0, [leaks(st.text), leaks(one.text)]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
