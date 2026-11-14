// T-159 tiêu chí 4 (tab Vendor): GET /api/vendors/match và GET /api/vendors/:id chấm điểm ngân sách theo allocated_tr > 0 của hạng mục; đổi phân bổ đổi điểm;
// KHÔNG nới x1,2 (vendor vượt 10% chỉ được 0,5 điểm ngân sách, không phải 1); không loại vendor nào vì ngân sách; chưa phân bổ thì như cũ (tổng x tỷ lệ).
// Hồ sơ tổng 300tr -> tổng x tỷ lệ ảnh cưới = 30tr. Vendor A priceMax 20, B priceMax 30, C priceMax 22.
// Chưa phân bổ ảnh: A=1, B=1, C=1. allocated 20tr: A=1, B=0 (vượt 50%), C=0,5. allocated 30tr: tất cả 1.
import { loadBack, tabMatch, tab, CID, eligible, overlayKeep, doc, coupleProfile, budgetScoreOf, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const [A, B, C] = eligible(M, "photography").slice(0, 3);
const overlay = overlayKeep(M, "photography", [{ id: A.id, priceMin: 10, priceMax: 20 }, { id: B.id, priceMin: 10, priceMax: 30 }, { id: C.id, priceMin: 10, priceMax: 22 }]);
const P = coupleProfile({ budget: 300 });
const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 0.01;
const scores = async (budgetDoc) => { const r = await tabMatch(M, "photography", { profile: P, budgetDoc, overlay }); return { r, a: budgetScoreOf(r, A.id), b: budgetScoreOf(r, B.id), c: budgetScoreOf(r, C.id) }; };
const want = (label, s, [a, b, c]) => {
  if (s.r.err || s.r.status !== 200) return fails.push(`${label}: lỗi ${s.r.err?.message || s.r.status}`);
  if (!near(s.a, a) || !near(s.b, b) || !near(s.c, c)) fails.push(`${label}: điểm ngân sách A/B/C = ${s.a}/${s.b}/${s.c}, mong ${a}/${b}/${c}`);
};
want("allocated 20tr", await scores(doc({ photography: 20 })), [1, 0, 0.5]);
want("đổi phân bổ lên 30tr", await scores(doc({ photography: 30 })), [1, 1, 1]);
want("allocated_tr = 0 (chưa phân bổ) -> tổng x tỷ lệ 30tr", await scores(doc({ photography: 0 })), [1, 1, 1]);
want("không có bảng -> tổng x tỷ lệ 30tr", await scores(undefined), [1, 1, 1]);
want("bảng hỏng -> tổng x tỷ lệ, không ném", await scores("{hỏng"), [1, 1, 1]);
want("chỉ reserve/hạng mục khác có số -> ảnh vẫn tổng x tỷ lệ", await scores(doc({ reserve: 900, venue: 5 })), [1, 1, 1]);
{ // vendor vượt ngân sách vẫn nằm trong danh sách (tab không lọc cứng theo ngân sách)
  const r = await tabMatch(M, "photography", { profile: P, budgetDoc: doc({ photography: 20 }), overlay });
  if (![A, B, C].every((v) => r.body?.vendors?.some((x) => x.id === v.id))) fails.push("allocated 20tr: tab loại vendor vì ngân sách (không được)");
}
{ // màn chi tiết vendor dùng cùng ngân sách
  const r = await tab(M, { url: `/api/vendors/${B.id}?coupleId=${CID}`, profile: P, budgetDoc: doc({ photography: 20 }), overlay });
  const s = r.body?.match?.scoreBreakdown?.budget;
  if (r.err || !near(s, 0)) fails.push(`chi tiết vendor B, allocated 20tr: điểm ngân sách ${s}, mong 0`);
}
{ // trăng mật: chưa phân bổ giữ hành vi cũ (tỷ lệ 0% -> ngân sách 0 -> điểm trung tính 0,5); có phân bổ thì theo phân bổ
  const [H1, H2] = eligible(M, "honeymoon").slice(0, 2);
  if (H1 && H2) {
    const ov = overlayKeep(M, "honeymoon", [{ id: H1.id, priceMin: 10, priceMax: 20 }, { id: H2.id, priceMin: 10, priceMax: 30 }]);
    const u = await tabMatch(M, "honeymoon", { profile: P, budgetDoc: doc({ honeymoon: 0 }), overlay: ov });
    if (!near(budgetScoreOf(u, H1.id), 0.5) || !near(budgetScoreOf(u, H2.id), 0.5)) fails.push(`trăng mật chưa phân bổ: điểm ngân sách ${budgetScoreOf(u, H1.id)}/${budgetScoreOf(u, H2.id)}, mong 0,5/0,5 như cũ`);
    const a = await tabMatch(M, "honeymoon", { profile: P, budgetDoc: doc({ honeymoon: 20 }), overlay: ov });
    if (!near(budgetScoreOf(a, H1.id), 1) || !near(budgetScoreOf(a, H2.id), 0)) fails.push(`trăng mật allocated 20tr: điểm ${budgetScoreOf(a, H1.id)}/${budgetScoreOf(a, H2.id)}, mong 1/0`);
  }
}
done(fails);
