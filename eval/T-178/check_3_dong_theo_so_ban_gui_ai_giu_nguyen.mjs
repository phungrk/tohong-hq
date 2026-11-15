// T-178 tiêu chí 3. Quyết định: dòng chat "Theo số bàn" gửi AI (lib/matchFormatter.js) KHÔNG thêm tổng. Vẫn đúng khuôn cũ "   Theo số bàn: ≈ {giá}tr/bàn × {N} bàn" (hết dòng, không dấu "="),
// vẫn chỉ có với venue giá riêng, vendor ước tính vẫn không có; khối ứng viên không chứa phép "= {tổng}tr" ở bất kỳ dòng nào. (Hàng rào: xanh trên main, phải xanh sau T-178.)
// Chạy từ gốc tohong-hq: node eval/T-178/check_3_dong_theo_so_ban_gui_ai_giu_nguyen.mjs
import { setup, chat, coupleProfile, restoreNow, done, ids } from "./_lib.mjs";
const fails = []; const bad = (m) => { if (fails.length < 15) fails.push(m); };
const M = await setup();
const msg = "Tìm nhà hàng tiệc cưới giúp anh chị 150tr";
const r = await chat(M, { message: msg, profile: coupleProfile({ budget: 300, guest_count: 300, budget_breakdown: { venue: 150_000_000 } }), overlay: M.hideExcept("venue", [ids.D, ids.E]) });
if (r.err || !r.sp) bad("chat venue lỗi " + (r.err?.message || "không có prompt"));
else {
  const i = r.sp.indexOf("## Vendor matching candidates\n"); const rest = i < 0 ? "" : r.sp.slice(i + 31); const j = rest.indexOf("\n## "); const block = j < 0 ? rest : rest.slice(0, j);
  const lines = block.split("\n"); const nameOf = (id) => M.POOL.find((v) => v.id === id).name;
  const at = (id) => lines.findIndex((l) => l.includes(nameOf(id)) && /^\d+\./.test(l.trim()));
  const iD = at(ids.D), iE = at(ids.E);
  if (iD < 0 || iE < 0) bad(`chat venue 150tr, 30 bàn: D (4,6 x 30 = 138tr) và E phải qua lọc, thấy ${r.ids.length} ứng viên`);
  else {
    const own = (k) => { let e = k + 1; while (e < lines.length && !/^\d+\./.test(lines[e].trim())) e++; return lines.slice(k, e); };
    const d = own(iD), e = own(iE);
    if (!d.includes("   Theo số bàn: ≈ 4.6tr/bàn × 30 bàn")) bad(`vendor giá riêng: mong đúng dòng "   Theo số bàn: ≈ 4.6tr/bàn × 30 bàn", thấy ${JSON.stringify(d.filter((l) => /Theo số bàn/.test(l)))}`);
    if (e.some((l) => /Theo số bàn/.test(l))) bad("vendor ước tính không được có dòng 'Theo số bàn'");
  }
  const withEq = lines.filter((l) => /bàn\s*=\s*[\d.,]+\s*tr/.test(l));
  if (withEq.length) bad(`khối ứng viên gửi AI không được có phép "= {tổng}tr": ${JSON.stringify(withEq)}`);
}
restoreNow(); done(fails);
