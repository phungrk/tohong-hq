// T-169 tiêu chí 4. THÀNH PHỐ và GU (style): cùng một thông tin, cùng một giá trị ở mọi bề mặt.
// THÀNH PHỐ: nguồn couple.city, rồi location.city, rồi city top-level (thứ tự main); không có thì tab/chat mặc định HCMC còn summary null (như main); các cách viết của cùng một thành phố ("Hà Nội", "HN", "hanoi"; "TP.HCM", "HCMC"; "Đà Nẵng", "DN") là MỘT thành phố ở cả tab Vendor lẫn chat
// (hôm nay chat đổi "Hà Nội" thành mã khác với tab nên cặp đôi Hà Nội thấy tab có vendor còn chat không có). Giá trị hiển thị người dùng đã nhập giữ nguyên.
// GU: preferences.style_tags (mảng không rỗng) thắng; rỗng/không có thì style_tags top-level; rồi preferences.theme; chữ thường, bỏ khoảng trắng thừa, không trùng.
// Chạy từ gốc tohong-hq: node eval/T-169/check_4_thanh_pho_va_gu_mot_gia_tri.mjs
import { setup, bucket, readAll, checker, LECH, ids, done } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]); // R1 ở HCMC, HN ở Hà Nội: thành phố của cặp đôi quyết định ai hiện
const city = (couple, top, loc) => () => { const p = LECH(); if (couple === undefined) delete p.couple.city; else p.couple.city = couple; if (top !== undefined) p.city = top; if (loc !== undefined) p.location = { city: loc }; return p; };
const cityCases = [
  ["couple.city 'Hà Nội'", city("Hà Nội"), "Hà Nội", ids.HN], ["couple.city 'HN' (mã AI ghi)", city("HN"), "HN", ids.HN], ["couple.city 'hanoi'", city("hanoi"), "hanoi", ids.HN],
  ["chỉ city top-level 'Hà Nội'", city(undefined, "Hà Nội"), "Hà Nội", ids.HN], ["couple.city 'TP.HCM'", city("TP.HCM"), "TP.HCM", ids.R1], ["couple.city 'HCMC' + top-level 'Hà Nội' (couple thắng)", city("HCMC", "Hà Nội"), "HCMC", ids.R1],
  ["chỉ location.city 'Hà Nội' (thứ tự couple.city, location.city, city như main)", city(undefined, undefined, "Hà Nội"), "Hà Nội", ids.HN], ["location.city 'Hà Nội' + city top-level 'TP.HCM' (location thắng)", city(undefined, "TP.HCM", "Hà Nội"), "Hà Nội", ids.HN],
  ["'Quận 1, TP.HCM' (chuỗi dài khớp một phần như main)", city("Quận 1, TP.HCM"), "Quận 1, TP.HCM", ids.R1], ["'Sài Gòn' / 'Ho Chi Minh' giữ như main", city("Ho Chi Minh"), "Ho Chi Minh", ids.R1],
];
for (const [name, mk, shown, want] of cityCases) {
  const r = await readAll(M, bucket(M, { profile: mk(), overlay: ov }));
  for (const e of r.err) fails.push(`${name}: ${e}`);
  eq(`${name}: tab Vendor chỉ hiện vendor đúng thành phố`, r.tabIds.filter((x) => x === ids.R1 || x === ids.HN), [want]);
  eq(`${name}: chat ghép đúng vendor đúng thành phố (cùng tab)`, r.chatIds.filter((x) => x === ids.R1 || x === ids.HN), [want]);
  eq(`${name}: màn hồ sơ (summary) city giữ chữ người dùng nhập`, r.summary?.profile?.city ?? null, shown);
  eq(`${name}: hồ sơ couple.city`, r.profile?.couple?.city ?? null, shown);
}
// Không có thành phố ở đâu: giữ hành vi main: tab và chat mặc định HCMC (chỉ vendor HCMC), summary null.
{ const name = "không có thành phố"; const p = LECH(); delete p.couple.city; const r = await readAll(M, bucket(M, { profile: p, overlay: ov }));
  for (const e of r.err) fails.push(`${name}: ${e}`);
  eq(`${name}: tab mặc định HCMC`, r.tabIds.filter((x) => x === ids.R1 || x === ids.HN), [ids.R1]); eq(`${name}: chat mặc định HCMC`, r.chatIds.filter((x) => x === ids.R1 || x === ids.HN), [ids.R1]); eq(`${name}: summary city null`, r.summary?.profile?.city ?? null, null); }
const style = (mut) => () => { const p = LECH(); mut(p); return p; };
const styleCases = [
  ["preferences thắng (chữ hoa/khoảng trắng chuẩn hoá)", style((p) => { p.preferences.style_tags = ["Korean", " luxury ", "korean"]; }), ["korean", "luxury"]],
  ["preferences rỗng, top-level có", style((p) => { p.preferences.style_tags = []; }), ["rustic"]],
  ["chỉ preferences.theme", style((p) => { p.preferences.style_tags = []; delete p.style_tags; p.preferences.theme = ["Modern"]; }), ["modern"]],
  ["không có gu ở đâu", style((p) => { p.preferences.style_tags = []; delete p.style_tags; }), []],
];
for (const [name, mk, want] of styleCases) {
  const r = await readAll(M, bucket(M, { profile: mk(), overlay: ov }));
  for (const e of r.err) fails.push(`${name}: ${e}`);
  eq(`${name}: ghép vendor (profileSnapshot) styles`, r.snap?.styles ?? [], want);
  eq(`${name}: hồ sơ preferences.style_tags`, r.profile?.preferences?.style_tags ?? [], want);
  eq(`${name}: chat: preferences.style_tags trong khối hồ sơ`, r.chatBlock?.preferences?.style_tags ?? [], want);
  if (r.chatBlock && "style_tags" in r.chatBlock) eq(`${name}: chat: style_tags top-level trong khối hồ sơ`, r.chatBlock.style_tags ?? [], want);
}
done(fails);
