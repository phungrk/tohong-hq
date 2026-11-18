#!/usr/bin/env node
// T-206 adv-05 (adversary, tầng 3): biên của `reason` và thân request ở POST /api/admin/vendors/:id/delete.
// Spec T-203 §Hợp đồng API: reason "sau khi cắt khoảng trắng hai đầu: trống 400 delete_reason_required, quá 300 ký tự 400 delete_reason_too_long (không cắt âm thầm)";
// "Lý do lưu đã cắt khoảng trắng"; thứ tự kiểm: id sai 400 -> 404 -> lý do -> phiên bản 409; "Sai phương thức 405"; lần bị từ chối không ghi gì (Tình huống 5).
// Chạy từ gốc tohong-hq: node eval/T-206/adv-05-bien-ly-do-xoa.mjs
import { fresh, pickTarget, asAdmin, DEL, RES, reporter, outbound, snapshot, diff } from "../T-203/lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env);
const T = await pickTarget(env, "photography");
const ids = T.ids.filter((x, i, a) => a.indexOf(x) === i);
let k = 0; const next = () => ids[k++];
const still = (s0) => { const d = diff(s0, snapshot(bucket)); return d.added.length + d.removed.length + d.changed.length === 0; };
const reject = async (name, body, code, id = ids[0]) => {
  const s0 = snapshot(bucket);
  const r = await A("POST", DEL(id), body);
  R.check(`${name}: 400 ${code}, R2 không đổi`, r.status === 400 && r.json?.error === code && still(s0), [r.status, r.text.slice(0, 80)]);
};
await reject("reason thiếu", { expected_version: 0 }, "delete_reason_required");
await reject("reason null", { expected_version: 0, reason: null }, "delete_reason_required");
await reject("reason số", { expected_version: 0, reason: 12345 }, "delete_reason_required");
await reject("reason mảng", { expected_version: 0, reason: ["trùng"] }, "delete_reason_required");
await reject("reason tab/xuống dòng/NBSP/khoảng trắng toàn khổ", { expected_version: 0, reason: "\t\n 　 \r\n" }, "delete_reason_required");
await reject("reason 301 ký tự", { expected_version: 0, reason: "a".repeat(301) }, "delete_reason_too_long");
await reject("reason 301 ký tự tiếng Việt dựng sẵn", { expected_version: 0, reason: "ế".repeat(301) }, "delete_reason_too_long");
await reject("lý do trống + phiên bản lệch: lỗi lý do đi trước 409", { expected_version: 99, reason: "  " }, "delete_reason_required");
// 300 ký tự sau khi cắt, có khoảng trắng hai đầu: 200, lưu đã cắt, không cắt âm thầm
const id1 = next();
const r300 = "ế".repeat(150) + "x".repeat(150);
const ok = await A("POST", DEL(id1), { expected_version: 0, reason: `   ${r300}\n\t ` });
const d = await A("GET", `/api/admin/vendors/${id1}`);
R.check("reason đúng 300 ký tự (tiếng Việt + ASCII) có khoảng trắng hai đầu: 200, lưu đúng 300 ký tự đã cắt", ok.status === 200 && d.json?.deleted_info?.reason === r300, [ok.status, ok.text.slice(0, 60), d.json?.deleted_info?.reason?.length]);
// Lý do chứa HTML/script: lưu nguyên văn (UI tự thoát), không bị cắt hay biến đổi
const id2 = next();
const xss = `<img src=x onerror="alert(1)"> "trùng" & 'đóng cửa' <script>x</script>`;
const ok2 = await A("POST", DEL(id2), { expected_version: 0, reason: xss });
const d2 = await A("GET", `/api/admin/vendors/${id2}`);
const lab = await A("GET", "/api/admin/vendors?label=deleted&limit=200");
R.check("lý do chứa HTML: 200, chi tiết và hàng 'Đã xoá' trả nguyên văn", ok2.status === 200 && d2.json?.deleted_info?.reason === xss && (lab.json?.vendors || []).find((v) => v.id === id2)?.deleted_reason === xss, [ok2.status, d2.json?.deleted_info?.reason]);
// Thân không phải JSON: 400, không ghi
const s0 = snapshot(bucket);
const { call } = await import("../T-203/lib/common.mjs");
const raw = await (async () => { const { worker } = await import("../T-203/lib/common.mjs"); const res = await worker.fetch(new Request(`http://localhost${DEL(ids[0])}`, { method: "POST", headers: { Authorization: "Bearer dev:admin", "Content-Type": "application/json" }, body: "{reason:" }), env, { waitUntil() {} }); return res.status; })();
R.check("thân không phải JSON: 400, R2 không đổi", raw === 400 && still(s0), raw);
// Sai phương thức
for (const m of ["GET", "PUT", "DELETE", "PATCH"]) {
  const a = await A(m, DEL(ids[0]), m === "GET" ? undefined : { reason: "x" });
  const b = await A(m, RES(ids[0]), m === "GET" ? undefined : {});
  R.check(`${m} lên /delete và /restore: 405`, a.status === 405 && b.status === 405, [a.status, b.status]);
}
// expected_version không hợp lệ: không ghi
for (const ev of [-1, "0", 1.5, null]) {
  const s1 = snapshot(bucket);
  const r = await A("POST", DEL(ids[0]), { expected_version: ev, reason: "hợp lệ" });
  R.check(`expected_version=${JSON.stringify(ev)}: 4xx, R2 không đổi`, r.status >= 400 && r.status < 500 && still(s1), [r.status, r.text.slice(0, 60)]);
}
// id sai định dạng đi trước mọi lỗi khác
const bad = await A("POST", DEL("../x"), { reason: "" });
R.check("id sai định dạng: 4xx trước lỗi lý do (không phải delete_reason_required)", bad.status >= 400 && bad.status < 500 && bad.json?.error !== "delete_reason_required", [bad.status, bad.text.slice(0, 60)]);
const unk = await A("POST", DEL("khong_co_vendor_nay"), { reason: "" });
R.check("id lạ + lý do trống: 404 vendor_not_found đi trước lỗi lý do", unk.status === 404 && unk.json?.error === "vendor_not_found", [unk.status, unk.text.slice(0, 60)]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
