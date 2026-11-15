// T-173 · eval đối kháng 06 (adversary). GHI CHỈ BẰNG TRƯỜNG CŨ VẪN LÀ MỘT LẦN GHI.
// Spec T-169 H3: "Một lần ghi một thông tin = payload có mặt ít nhất một trường (chuẩn hoặc cũ) của thông tin đó"; H3.1 trường chuẩn nhận giá trị mới;
// H3.3 không có trường chuẩn thì ứng viên đứng trước trong H1 thắng. Lựa chọn 4 của engineering (trường cũ chưa có thì không lưu) KHÔNG được làm rơi giá trị:
// PATCH chỉ mang MỘT trường cũ (mỗi trường cũ của bảng H1, kể cả lồng như `location.city`) lên hồ sơ chưa có trường đó -> giá trị hiệu lực ở mọi bề mặt = giá trị gửi,
// và các khoá khác trong cùng object payload (vd `location.district`) không bị mất.
// Chạy từ gốc tohong-hq: node eval/T-173/adv-06-ghi-chi-truong-cu-van-ghi.mjs
import { setup, bucket, readAll, api, storedProfile, ids, done } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const P0 = () => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", wedding_date: "2027-12-29" }, preferences: {}, families: {} });
const d10 = (x) => (x ? String(x).slice(0, 10) : null);
const CA = [
  ["wedding_date top-level", { wedding_date: "2028-01-01" }, (r) => [d10(r.summary?.profile?.wedding_date), d10(r.snap?.weddingDate)], "2028-01-01"],
  ["preferences.guest_count", { preferences: { guest_count: 180 } }, (r) => [r.snap?.guestCount, r.budget?.guests, r.profile?.guest_count], 180],
  ["couple.guest_count", { couple: { guest_count: 160 } }, (r) => [r.snap?.guestCount, r.budget?.guests, r.profile?.guest_count], 160],
  ["city top-level", { city: "HN" }, (r) => [r.summary?.profile?.city, r.snap?.city], "HN"],
  ["location.city", { location: { city: "HN", district: "Quận Ba Đình" } }, (r) => [r.summary?.profile?.city, r.snap?.city], "HN"],
  ["style_tags top-level", { style_tags: ["rustic"] }, (r) => [r.snap?.styles, r.chatBlock?.preferences?.style_tags], ["rustic"]],
  ["preferences.theme", { preferences: { theme: ["luxury"] } }, (r) => [r.snap?.styles, r.chatBlock?.preferences?.style_tags], ["luxury"]],
];
for (const [tag, patch, read, want] of CA) {
  const b = bucket(M, { profile: P0(), overlay: ov });
  const res = await api(M, b, "PATCH", "", patch); if (res.status >= 400) { fails.push(`${tag}: PATCH ${res.status}`); continue; }
  const r = await readAll(M, b);
  read(r).forEach((v, i) => { if (JSON.stringify(v ?? null) !== JSON.stringify(want)) fails.push(`PATCH chỉ ${tag}=${JSON.stringify(want)} lên hồ sơ chưa có: bề mặt #${i + 1} = ${JSON.stringify(v ?? null)} (mong ${JSON.stringify(want)}, giá trị gửi bị rơi)`); });
  if (tag === "location.city") { const s = await storedProfile(M, b); if (s?.location?.district !== "Quận Ba Đình") fails.push(`${tag}: mất location.district gửi kèm`); }
}
done(fails);
