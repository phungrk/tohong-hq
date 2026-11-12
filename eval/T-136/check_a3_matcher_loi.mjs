// T-136 tiêu chí 3: matcher lỗi (500, mất mạng, trả rác) vẫn có prompt hợp lệ, không ném lỗi, không vendor nào lọt vào.
import { chat, done } from "./_lib.mjs";
const fails = [];
for (const [label, mode] of [["500", "500"], ["mất mạng", "throw"], ["matches không phải mảng", { matches: "rac", total_pool: 1 }], ["thiếu matches", {}], ["item null", { matches: [null, 5, "x"] }]]) {
  try {
    const r = await chat(mode);
    if (!r.systemPrompt || !r.systemPrompt.includes("Hồ sơ cặp đôi")) fails.push(`${label}: prompt thiếu phần chuẩn`);
    if (/^\[VENDOR CANDIDATES/m.test(r.systemPrompt)) fails.push(`${label}: có khối ứng viên dù matcher không trả gì hợp lệ`);
  } catch (e) { fails.push(`${label}: ném lỗi ${e.message}`); }
}
done(fails);
