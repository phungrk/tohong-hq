#!/usr/bin/env node
// T-203 tiêu chí 2 (repo tohong-back): vendor đã xoá biến khỏi MỌI bề mặt cặp đôi; vendor đã lưu trong kế hoạch vẫn hiển thị được (như vendor ẩn: hidden:true, không 404, không null).
// Chạy từ gốc tohong-hq: node eval/T-203/check_2_cap_doi_khong_thay.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back). Worker thật + R2 giả; mạng bị chặn.
import { fresh, pickTarget, chatIds, asAdmin, asCouple, DEL, RES, VENDOR_POOL, reporter, outbound, loadOverlay } from "./lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env), C = asCouple(env);
const T = await pickTarget(env);
R.check("tiền điều kiện: có vendor ứng viên chat để thử", !!T.id, T.ids.length);
const id = T.id, base = VENDOR_POOL.find((v) => v.id === id);

const surfaces = async () => {
  await loadOverlay(env, { force: true });
  const byIds = await C("GET", `/api/vendors/match?ids=${id}`);
  const inCat = await C("GET", `/api/vendors/match?category=${T.category}&limit=50`);
  const cats = await C("GET", "/api/vendors/categories");
  const st = await C("POST", "/api/vendors/status", { ids: [id, "khong_ton_tai_xyz"] });
  const one = await C("GET", `/api/vendors/${id}`);
  return {
    byIds: (byIds.json?.vendors || []).some((v) => v.id === id),
    inCat: (inCat.json?.vendors || []).some((v) => v.id === id),
    catCount: (cats.json || []).find((c) => c.category === T.category)?.count,
    chat: (await chatIds(env, T.mp)).includes(id),
    st, one, stMissing: st.json?.vendors?.khong_ton_tai_xyz,
  };
};
const before = await surfaces();
R.check("tiền điều kiện: trước khi xoá vendor hiện ở ghép theo id + ứng viên chat", before.byIds && before.chat, [before.byIds, before.chat]);
R.check("tiền điều kiện: trạng thái trước xoá hidden không phải true", before.st.json?.vendors?.[id]?.hidden !== true, before.st.json?.vendors?.[id]);

const d = await A("GET", `/api/admin/vendors/${id}`);
const del = await A("POST", DEL(id), { expected_version: d.json?.version ?? 0, reason: "eval T-203: dữ liệu sai" });
R.check("xoá thành công (200)", del.status === 200, [del.status, del.text.slice(0, 80)]);

const after = await surfaces();
R.check("ghép theo id (/api/vendors/match?ids=): không còn vendor", after.byIds === false);
R.check("danh sách ghép theo hạng mục: không còn vendor", after.inCat === false);
R.check("đếm hạng mục (/api/vendors/categories): giảm đúng 1", before.catCount - after.catCount === 1, [before.catCount, after.catCount]);
R.check("ứng viên chat (chatMatch): không còn vendor", after.chat === false);
R.check("trạng thái vendor đã lưu (/api/vendors/status): có mục, hidden:true (KHÔNG null như id không tồn tại)", after.st.status === 200 && after.st.json?.vendors?.[id] && after.st.json.vendors[id].hidden === true && after.stMissing === null, [after.st.status, after.st.json?.vendors?.[id], after.stMissing]);
R.check("trạng thái vendor đã xoá vẫn có giá hiện hành (số), để thẻ đã lưu không vỡ", typeof after.st.json?.vendors?.[id]?.priceMin === "number" || typeof after.st.json?.vendors?.[id]?.priceMax === "number" || (base.priceMin == null && base.priceMax == null), after.st.json?.vendors?.[id]);
R.check("GET /api/vendors/:id: 200, vendor.hidden:true, match:null, vẫn có tên (không 404)", after.one.status === 200 && after.one.json?.vendor?.hidden === true && after.one.json?.match === null && after.one.json?.vendor?.name === base.name, [after.one.status, after.one.json?.vendor?.hidden, after.one.json?.match]);

// Khôi phục: mọi bề mặt về như trước
const d2 = await A("GET", `/api/admin/vendors/${id}`);
const res = await A("POST", RES(id), { expected_version: d2.json?.version ?? 0 });
R.check("khôi phục thành công (200)", res.status === 200, [res.status, res.text.slice(0, 80)]);
const back = await surfaces();
R.check("sau khôi phục: hiện lại ở ghép theo id, ứng viên chat, đếm hạng mục", back.byIds && back.chat && back.catCount === before.catCount, [back.byIds, back.chat, back.catCount, before.catCount]);
R.check("sau khôi phục: trạng thái đã lưu hidden không phải true", back.st.json?.vendors?.[id]?.hidden !== true);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
