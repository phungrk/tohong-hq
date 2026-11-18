#!/usr/bin/env node
// T-211 tiêu chí 6 (repo tohong-back): địa chỉ KHÔNG ảnh hưởng ghép vendor: `city`, hạng mục, thứ tự, điểm, đếm, ứng viên chat của vendor y hệt trước/sau khi sửa địa chỉ (kể cả địa chỉ nói tỉnh khác); không tự suy ra quận/thành phố.
// Chạy từ gốc tohong-hq: node eval/T-211/check_6_khong_doi_ghep.mjs
import { setup, reporter, outbound, addrOf, asCouple, chatMatch, loadOverlay } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, env, T } = S;
const C = asCouple(env);
const snap = async () => {
  await loadOverlay(env, { force: true });
  const g = async (m, p, b) => (await C(m, p, b)).text;
  return {
    one: await g("GET", `/api/vendors/${T.id}`), ids: await g("GET", `/api/vendors/match?ids=${T.id}`), cat: await g("GET", `/api/vendors/match?category=${T.category}&limit=50`),
    cats: await g("GET", "/api/vendors/categories"), st: await g("POST", "/api/vendors/status", { ids: [T.id] }), chat: JSON.stringify(chatMatch(T.mp)),
  };
};
const city = (await detail()).vendor?.city;
const b0 = await snap();
R.check("tiền điều kiện: vendor mục tiêu có city trong pool", typeof city === "string" && city.length > 0, city);
for (const addr of ["12 Phố Huế, Hai Bà Trưng, Hà Nội", "5 Bạch Đằng, Hải Châu, Đà Nẵng", "Số 1, đường không có quận nào cả"]) {
  const r = await put({ address: addr });
  R.check(`lưu địa chỉ "${addr}" 200`, r.status === 200 && addrOf(await detail()) === addr, [r.status, r.json?.error]);
  const b1 = await snap();
  for (const k of Object.keys(b0)) R.check(`  ${k}: byte-for-byte như trước khi sửa địa chỉ`, b1[k] === b0[k], [b0[k].slice(0, 60), b1[k].slice(0, 60)]);
  R.check("  city của vendor trong pool/hiệu lực vẫn là city cũ", (await detail()).vendor?.city === city && (await detail()).effective?.city === city, [(await detail()).effective?.city]);
}
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
