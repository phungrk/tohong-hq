// T-136 tiêu chí 2: match còn trong pool thì tên + giá hiển thị trong prompt lấy theo pool hiện hành; thứ tự và lý do của matcher giữ nguyên;
// giá admin đã nhập (overlay) vẫn thắng giá pool; vendor admin ẩn vẫn bị lọc.
import { chat, item, poolPhotographers, done } from "./_lib.mjs";
const fails = [];
const [a, b, c] = poolPhotographers.filter((v) => v.priceMin > 0 && v.priceMax >= v.priceMin).slice(0, 3);
const hid = poolPhotographers.find((v) => ![a.id, b.id, c.id].includes(v.id));
const fmt = (v) => `${Math.round(v.priceMin)}-${Math.round(v.priceMax)}tr (giá ước tính)`;
const p = await chat({
  matches: [item(b.id, "TEN_CU_B", 1, 2), item(a.id, "TEN_CU_A", 99, 120), item(c.id, "TEN_CU_C", 7, 8), item(hid.id, "TEN_CU_HIDDEN")],
  total_pool: 4, passed_filters: 4,
}, { overlay: { [c.id]: { priceMin: 20, priceMax: 25, price_verified: true }, [hid.id]: { hidden: true, hidden_reason: "dong cua" } } });
const sp = p.systemPrompt;
if (/TEN_CU_/.test(sp)) fails.push("tên matcher (cũ) còn trong prompt: tên phải lấy theo pool");
if (sp.includes(hid.name)) fails.push("vendor admin ẩn lọt prompt");
const block = sp.slice(sp.lastIndexOf("\n[VENDOR CANDIDATES"));
const pos = (v) => block.indexOf(v.name);
if (!(pos(b) >= 0 && pos(a) > pos(b) && pos(c) > pos(a))) fails.push("thứ tự matcher (B, A, C) không giữ");
const line = (v) => (block.slice(pos(v)).split("\n")[1] || "");
if (!line(b).includes(fmt(b))) fails.push(`giá B phải theo pool: mong "${fmt(b)}", thấy "${line(b).trim()}"`);
if (!line(a).includes(fmt(a))) fails.push(`giá A phải theo pool (matcher 99-120tr là giá cũ): mong "${fmt(a)}", thấy "${line(a).trim()}"`);
if (!line(c).includes("20-25tr (giá đã xác minh)")) fails.push(`giá overlay phải thắng pool: thấy "${line(c).trim()}"`);
done(fails);
