// T-204 tiêu chí 2: cờ "1": review MỚI (Approve, Sửa thủ công link, Sửa thủ công gỡ) của danh tính cố định (mọi loại token) -> by_capu=true, "Chờ áp dụng", có trong export.
import { reporter, mkEnv, MemoryBucket, pickIds, review, listAll, exportOf, FIXED, ADM } from "./lib/common.mjs";
const R = reporter();
const [a, b, c, d] = pickIds(4);
const env = mkEnv(new MemoryBucket(), "1");
const puts = [
  [a, { decision: "approve" }, undefined],
  [b, { decision: "manual", action: "accept_place", maps_link: "https://share.google/T204abc", note: "Có trên Maps" }, "khong-phai-token"],
  [c, { decision: "manual", action: "remove", note: "Không có trên Maps" }, "dev:" + ADM],
];
for (const [id, body, tok] of puts) {
  const r = await review(env, id, body, tok);
  R.check(`PUT ${body.decision}/${body.action || "-"} (token ${tok || "không"}): 200, reviewed_by cố định, by_capu=true`, r.status === 200 && r.json?.review?.reviewed_by === FIXED && r.json?.review?.by_capu === true, [r.status, r.text.slice(0, 160)]);
}
const pa = await listAll(env, "pending_apply"), pc = await listAll(env, "pending_capu");
R.check("3 review mới nằm ở 'Chờ áp dụng', không ở 'Chờ Capu'", [a, b, c].every((id) => pa.rows.some((x) => x.id === id && x.review?.by_capu === true)) && pc.rows.length === 0, [pa.rows.length, pc.rows.length]);
const ex = await exportOf(env);
R.check("export có đúng 3 mục, by_capu=true", ex.status === 200 && JSON.stringify((ex.json?.entries || []).map((e) => e.vendor_id).sort()) === JSON.stringify([a, b, c].sort()) && ex.json.entries.every((e) => e.by_capu === true), [ex.status, (ex.json?.entries || []).map((e) => e.vendor_id)]);
R.done();
