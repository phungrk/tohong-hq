// T-173 · eval đối kháng 02 (adversary). NGÀY KHÔNG HỢP LỆ KHÔNG ĐƯỢC XOÁ NGÀY THẬT ĐÃ LƯU.
// Spec T-169 H1: ngày "hợp lệ" = chuỗi không rỗng mà `new Date` đọc được. H3.4: chỉ null/chuỗi rỗng là xoá. H4: "không có đường nào xoá ... giá trị cũ".
// Một lần ghi ngày mang chuỗi KHÁC rỗng mà không phải ngày hợp lệ (người dùng/AI viết kiểu Việt "29/12/2027", "31/12/2027", "cuối năm sau")
// không phải xoá tường minh. Kỳ vọng tối thiểu: sau lần ghi, (a) ngày hiệu lực ở mọi bề mặt không về "không có", và (b) mọi trường ngày đã lưu
// mà trước đó hợp lệ vẫn còn một ngày hợp lệ trong R2 (không bị ghi đè bằng chuỗi không đọc được).
// Ghi chú: "Tết 2028" KHÔNG nằm ở đây vì V8 `new Date("Tết 2028")` đọc được (1/1/2028) nên theo H1 nó là ngày hợp lệ (điểm yếu của định nghĩa H1, báo product).
// Chấp nhận: bỏ qua giá trị không hợp lệ (như thông tin không có mặt, H3.5) HOẶC đọc đúng kiểu ngày/tháng/năm ("31/12/2027" là 2027-12-31).
// Chạy từ gốc tohong-hq: node eval/T-173/adv-02-ngay-rac-khong-xoa-ngay-that.mjs
import { setup, bucket, readAll, api, chatAction, storedProfile, ids, done } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const HS = () => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-29" }, wedding_date: "2027-12-29", guest_count: 200, budget: 300, preferences: { style_tags: ["korean"] } });
const valid = (s) => typeof s === "string" && s.trim() !== "" && !Number.isNaN(new Date(s).getTime());
const d10 = (x) => (valid(x) ? new Date(x).toISOString().slice(0, 10) : null);

for (const [duong, ghi] of [["chat update_profile", (b, v) => chatAction(M, b, { wedding_date: v })], ["PATCH couple.wedding_date", (b, v) => api(M, b, "PATCH", "", { couple: { wedding_date: v } })]]) {
  for (const [raw, parsed] of [["29/12/2027", "2027-12-29"], ["31/12/2027", "2027-12-31"], ["cuối năm sau", null]]) {
    const ok = (x) => x === "2027-12-29" || (parsed && x === parsed);
    const b = bucket(M, { profile: HS(), overlay: ov }); await ghi(b, raw);
    const r = await readAll(M, b); const s = await storedProfile(M, b);
    const tag = `${duong} wedding_date=${JSON.stringify(raw)} (đã lưu 2027-12-29 ở couple.wedding_date và wedding_date)`;
    const seen = { "summary wedding_date": r.summary?.profile?.wedding_date, "profileSnapshot weddingDate": r.snap?.weddingDate, "chat khối hồ sơ couple.wedding_date": r.chatBlock?.couple?.wedding_date };
    for (const [k, v] of Object.entries(seen)) if (!ok(d10(v))) fails.push(`${tag}: ${k} = ${JSON.stringify(v ?? null)} (mong 2027-12-29 không đổi${parsed ? ` hoặc ${parsed}` : ""}, không phải mất ngày)`);
    if (!valid(s?.couple?.wedding_date) && !valid(s?.wedding_date)) fails.push(`${tag}: R2 không còn ngày hợp lệ nào (couple.wedding_date=${JSON.stringify(s?.couple?.wedding_date)}, wedding_date=${JSON.stringify(s?.wedding_date)})`);
  }
}
done(fails);
