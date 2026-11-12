// T-136 tiêu chí 8: khi mọi match bị bỏ vì ngoài pool (kept == 0 && dropped > 0) prompt có KHỐI RIÊNG, không dùng khối "Không có vendor phù hợp" (khối đó khuyên mở rộng ngân sách / đổi style / ngày: sai với cặp đôi).
// Khối riêng: dòng đầu đúng "[VENDOR MATCHER — Dữ liệu vendor đang cập nhật]"; có "Không đề xuất vendor cụ thể bằng tên"; KHÔNG có lời khuyên nới ngân sách, đổi style, đổi ngày hay "tiêu chí khác".
// matcher trả rỗng thật (dropped == 0) thì GIỮ khối cũ; có match hợp lệ thì khối ứng viên, không khối riêng.
import { chat, item, poolPhotographers, done } from "./_lib.mjs";
const fails = [];
const HDR = /^\[VENDOR MATCHER — Dữ liệu vendor đang cập nhật\]/m, OLD = /^\[VENDOR MATCHER — Không có vendor phù hợp hiện tại\]/m, CAND = /^\[VENDOR CANDIDATES — chỉ dùng/m;
const blockOf = (sp, re) => { const m = sp.match(re); if (!m) return ""; const rest = sp.slice(m.index); const e = rest.indexOf("\n\n## "); return e < 0 ? rest : rest.slice(0, e); };
const a = await chat({ matches: [item("marry_photography_cu-1", "ZZ_1"), item("marry_deadbeef0001", "ZZ_2")], total_pool: 2, passed_filters: 2 });
if (!HDR.test(a.systemPrompt)) fails.push("kept==0 && dropped>0: thiếu khối riêng 'Dữ liệu vendor đang cập nhật'");
if (OLD.test(a.systemPrompt)) fails.push("kept==0 && dropped>0: vẫn dùng khối 'Không có vendor phù hợp' (khuyên nới ngân sách)");
const blk = blockOf(a.systemPrompt, HDR);
if (!blk.includes("Không đề xuất vendor cụ thể bằng tên")) fails.push("khối riêng phải cấm nêu tên vendor");
if (/ngân sách|style|ngày|tiêu chí khác/i.test(blk.replace(/Không khuyên[^\n]*/gi, ""))) fails.push("khối riêng có lời khuyên đổi ngân sách/style/ngày/tiêu chí: " + blk.replace(/\n/g, " | ").slice(0, 200));
if (!/Không khuyên[^\n]*(ngân sách|đổi)/i.test(blk)) fails.push("khối riêng phải nói rõ KHÔNG khuyên nới ngân sách / đổi gu / đổi ngày");
const e = await chat({ matches: [], total_pool: 0, passed_filters: 0 });
if (!OLD.test(e.systemPrompt) || HDR.test(e.systemPrompt)) fails.push("matcher trả rỗng thật (dropped==0) phải giữ khối cũ 'Không có vendor phù hợp'");
const k = await chat({ matches: [item("marry_deadbeef0001", "ZZ_2"), item(poolPhotographers[0].id, "x")], total_pool: 2, passed_filters: 2 });
if (!CAND.test(k.systemPrompt) || HDR.test(k.systemPrompt)) fails.push("còn match hợp lệ: phải là khối ứng viên, không khối riêng");
const r = await chat("500");
if (HDR.test(r.systemPrompt)) fails.push("matcher lỗi (không có match nào bị bỏ vì pool) không được dùng khối riêng");
done(fails);
