// T-217 tiêu chí 6 (ADR-138, bổ sung hạ tầng back): venue có pool priceSource "verified" tính giá theo BÀN, như venue legacy_marry (T-164 H7):
// điểm ngân sách = so (priceMax x số bàn, số bàn = ceil(khách/10)) với ngân sách hạng mục (tổng); lọc cứng chat theo priceMin x số bàn (nới x1,2 lên tổng); chip "≈ Xtr/bàn × T bàn = Ytr" khi điểm = 1;
// KHÔNG phải giá ước tính (đếm là bằng chứng ngân sách: có chip, vào "giá dao động" của câu danh sách; chat có dòng "Theo số bàn").
// Ca Bạch Kim: 3,4tr/bàn x 30 bàn = 102tr. Nếu bị so với tổng như vendor "không nguồn giá" thì ra 3,4 so 90 = điểm 1 (sai). Chạy: node eval/T-217/<file> · Biến: TOHONG_BACK_REPO.
import * as H from "./_back217.mjs";
const M = await H.loadBack(); const { VA, VB, LC, EC } = H.ids;
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const ov = H.hide(M, [VA, VB, LC, EC]);
const P = (g, bc) => H.coupleProfile({ budget: 300, ...(g ? { guest_count: g } : {}), budget_by_category: { venue: bc } });
const bs = (r, id) => r.body?.vendors?.find((v) => v.id === id)?.match?.scoreBreakdown?.budget;
const reasons = (r, id) => (r.body?.vendors?.find((v) => v.id === id)?.match?.reasons || []).map((x) => x.label);
{ // a. 300 khách = 30 bàn, ngân sách venue 90tr: VA 102tr -> 1 - (12/90)/0,2 = 0,3333; VB 191tr -> 0
  const r = await H.match(M, "venue", { overlay: ov, profile: P(300, 90) });
  if (r.status !== 200) bad("match venue lỗi " + (r.err?.message || r.status));
  else {
    if (!H.near(bs(r, VA), 1 - (12 / 90) / 0.2)) bad(`VA 30 bàn x 3,4 = 102tr so 90tr: điểm mong 0,333, thấy ${bs(r, VA)} (so giá bàn với tổng thì ra 1)`);
    if (!H.near(bs(r, VB), 0)) bad(`VB 30 bàn x 6,37 = 191tr so 90tr: điểm mong 0, thấy ${bs(r, VB)}`);
    if (!H.near(bs(r, LC), bs(r, EC))) bad("đối chứng legacy_marry và estimate_category cùng giá phải cùng điểm");
  }
  const d = await H.api(M, { url: `/api/vendors/${VA}?coupleId=${H.CID}`, overlay: ov, profile: P(300, 90) });
  if (!H.near(d.body?.match?.scoreBreakdown?.budget, 1 - (12 / 90) / 0.2)) bad(`chi tiết VA: điểm ngân sách mong 0,333, thấy ${d.body?.match?.scoreBreakdown?.budget}`);
}
{ // b. ngân sách 150tr: chip theo bàn cho VA (giá riêng), không chip cho vendor ước tính; câu danh sách theo bàn và tính VA, VB vào "giá dao động"
  const r = await H.match(M, "venue", { overlay: ov, profile: P(300, 150) });
  if (!H.near(bs(r, VA), 1) || !H.near(bs(r, VB), 0)) bad(`150tr, 30 bàn: điểm VA/VB mong 1/0, thấy ${bs(r, VA)}/${bs(r, VB)}`);
  if (!reasons(r, VA).some((l) => /≈ 3[.,]4tr\/bàn × 30 bàn/.test(l))) bad(`VA phải có chip "≈ 3,4tr/bàn × 30 bàn", thấy ${JSON.stringify(reasons(r, VA))}`);
  if (reasons(r, VA).some((l) => /^Rẻ hơn|^Trong ngân sách/.test(l))) bad("VA (venue có số bàn) không được còn chip 'Rẻ hơn'/'Trong ngân sách'");
  if (reasons(r, EC).some((l) => /ngân sách|^Rẻ hơn|bàn/.test(l))) bad(`vendor ước tính không có chip ngân sách/bàn, thấy ${JSON.stringify(reasons(r, EC))}`);
  const w = r.body?.whyThoseVendors || "";
  if (!/≈ 5tr\/bàn × 30 bàn/.test(w)) bad(`câu danh sách venue phải theo bàn: "${w}"`);
  if (!/giá dao động 3,4–6,4tr\/bàn/.test(w)) bad(`"giá dao động" phải gồm VA (3,4) và VB (6,4) tr/bàn vì verified không là ước tính: "${w}"`);
}
{ // c. không có số khách: trung tính 0,5, không chip
  const r = await H.match(M, "venue", { overlay: ov, profile: P(0, 90) });
  if (bs(r, VA) !== 0.5) bad(`không có số khách: điểm VA mong đúng 0,5, thấy ${bs(r, VA)}`);
  if (reasons(r, VA).some((l) => /bàn|ngân sách|^Rẻ hơn/.test(l))) bad("không có số khách: VA không được có chip ngân sách/bàn");
}
{ // d. chat: lọc cứng theo priceMin x bàn
  const msg = "Tìm nhà hàng tiệc cưới giúp anh chị";
  const lo = await H.chat(M, { message: msg + " 60tr", profile: H.coupleProfile({ budget: 300, guest_count: 300 }), overlay: ov });
  if (lo.err) bad("chat 60tr lỗi " + lo.err.message);
  if (lo.ids.includes(VA)) bad("chat 60tr, 30 bàn: VA (3,4 x 30 = 102tr, kể cả nới x1,2 = 72tr) phải bị lọc (so giá bàn với tổng thì lọt)");
  const hi = await H.chat(M, { message: msg + " 150tr", profile: H.coupleProfile({ budget: 300, guest_count: 300 }), overlay: ov });
  if (!hi.ids.includes(VA)) bad("chat 150tr, 30 bàn: VA (102tr) phải qua lọc");
  if (hi.ids.includes(VB)) bad("chat 150tr, 30 bàn: VB (6,37 x 30 = 191tr, kể cả nới x1,2 = 180tr) phải bị lọc");
  const lines = (hi.sp || "").split("\n"); const nameVA = M.POOL.find((v) => v.id === VA).name; const at = lines.findIndex((l) => l.includes(nameVA) && /^\d+\./.test(l.trim()));
  if (at < 0 || !/Giá: [\d.,]+-[\d.,]+tr\/bàn/.test(lines[at + 1] || "")) bad(`khối chat: dòng giá của VA mong "Giá: a-btr/bàn", thấy "${(lines[at + 1] || "").trim()}"`);
  if (at >= 0 && !/Theo số bàn: ≈ 3\.4tr\/bàn × 30 bàn/.test(lines.slice(at, at + 6).join("\n"))) bad("khối chat: VA (giá verified, không ước tính) phải có dòng 'Theo số bàn: ≈ 3.4tr/bàn × 30 bàn'");
}
H.done(fails);
