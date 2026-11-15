// T-173 · eval đối kháng 03 (adversary). THÀNH PHỐ: tab Vendor và chat cùng tập vendor cho mọi cách viết người thật/AI hay gõ (spec T-169 H5).
// Ngoài các ca của check_4: viết hoa, dấu cách thừa, dấu chấm, "TP. Hồ Chí Minh", "Thành phố Hồ Chí Minh", "Sai Gon", "hcm", "H.N", "Ha Noi", "HÀ NỘI", "han"; cặp đôi HCMC hợp lệ không bao giờ thành 0 vendor ở chat. (Pool eval chỉ có vendor HCMC và Hà Nội nên không đo Đà Nẵng.)
// Không gồm "Hà Nội" dạng NFD: spec H5 để chuỗi lạ theo cách chuẩn hoá cũ, và không đường ghi hiện có nào (onboarding chọn nhãn, AI ghi mã) sinh NFD; ghi nhận minor.
// Chạy từ gốc tohong-hq: node eval/T-173/adv-03-thanh-pho-tab-chat-cung-tap.mjs
import { setup, bucket, readAll, ids, done } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const HS = (city) => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city, wedding_date: "2027-12-29" }, guest_count: 200, budget: 3000, preferences: { style_tags: [] } });
const CA = [
  ["HCMC", ids.R1], ["hcmc", ids.R1], ["  TP.HCM  ", ids.R1], ["TP. Hồ Chí Minh", ids.R1], ["Thành phố Hồ Chí Minh", ids.R1], ["Sai Gon", ids.R1], ["SÀI GÒN", ids.R1],
  ["hcm", ids.R1], ["S.G", ids.R1], ["Quận 7, TP HCM", ids.R1],
  ["HN", ids.HN], ["H.N", ids.HN], [" hn ", ids.HN], ["Ha Noi", ids.HN], ["HÀ NỘI", ids.HN], ["han", ids.HN],
];
for (const [city, want] of CA) {
  const b = bucket(M, { profile: HS(city), overlay: ov });
  const r = await readAll(M, b);
  const tab = r.tabIds.filter((x) => x === ids.R1 || x === ids.HN), chat = r.chatIds.filter((x) => x === ids.R1 || x === ids.HN);
  const tag = `couple.city ${JSON.stringify(city)}`;
  if (JSON.stringify(tab) !== JSON.stringify(chat)) fails.push(`${tag}: tab ${JSON.stringify(tab)} khác chat ${JSON.stringify(chat)}`);
  if (JSON.stringify(tab) !== JSON.stringify([want])) fails.push(`${tag}: tab ${JSON.stringify(tab)}, mong [${want === ids.R1 ? "vendor HCMC" : "vendor Hà Nội"}]`);
  if (want === ids.R1 && !chat.length) fails.push(`${tag}: cặp đôi HCMC hợp lệ, chat ghép 0 vendor`);
}
done(fails);
