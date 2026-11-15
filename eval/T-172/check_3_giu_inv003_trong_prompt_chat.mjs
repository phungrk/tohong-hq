// T-172 tiêu chí 3 (giữ inv-003 ở chat khi bỏ nhãn): thông tin "giá này chưa đủ cơ sở để khẳng định ngân sách" vẫn tới AI, bằng một cờ nội bộ KHÔNG mang chữ nguồn giá.
// Hợp đồng chữ cố định (xem _lib.mjs): mỗi ứng viên có nguồn giá kiểu ước tính (estimate_category/estimate_default, và chỉ họ) có đúng một dòng `   Ngân sách: chưa đủ cơ sở để khẳng định vendor này hợp hoặc nằm trong ngân sách`;
// dòng "Phù hợp vì" của họ không nói ngân sách và không ngoặc nguồn ("phù hợp với nhu cầu của anh chị"); vendor giá riêng/admin giữ "phù hợp với ngân sách và nhu cầu của anh chị" và KHÔNG có cờ;
// đúng một dòng hướng dẫn `- Vendor có dòng "Ngân sách: chưa đủ cơ sở": không khẳng định vendor hợp hoặc nằm trong ngân sách của anh chị.` khi khối có ít nhất một ứng viên ước tính, và không có dòng đó khi không có.
// Cộng quét 5 hạng mục x 3 ngân sách trên pool đóng dấu đầy đủ. Không mạng.
import { twinBack, stampedBack, loadModules, chat, coupleProfile, MSG_BY_CAT, EST, REAL, NOSRC, candBlock, guidance, entries, leaks, FLAG_LINE, GUIDE_LINE, reporter, setNow } from "./_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const count = (t, s) => t.split("\n").filter((l) => l === s).length;
{ // A. cặp/đủ loại trong một khối
  const specs = [{ cat: "photography", price: EST(6, 8) }, { cat: "photography", price: REAL(6, 8) }, { cat: "photography", price: EST(6, 8), ov: { priceMin: 7, priceMax: 9, price_verified: true } },
    { cat: "photography", price: EST(6, 8), ov: { priceMin: 5, priceMax: 6 } }, { cat: "photography", price: NOSRC(6, 8) }];
  const { M, ids, ov, nameOf } = await twinBack(specs);
  const r = await chat(M, { message: MSG_BY_CAT.photography, profile: coupleProfile({ budget: 300 }), overlay: ov });
  const block = candBlock(r.sp); const ents = entries(block, Object.fromEntries(ids.map((id) => [id, nameOf(id)])));
  ids.forEach((id, i) => {
    const e = ents[id]; if (!e) return bad(`A ứng viên ${i + 1}: không vào khối`);
    const est = i === 0; const flags = e.filter((l) => l === FLAG_LINE).length; const why = e.find((l) => /Phù hợp vì:/.test(l)) || "";
    if (est && flags !== 1) bad(`A ứng viên ước tính: mong đúng 1 dòng cờ "${FLAG_LINE.trim()}", thấy ${flags}`);
    if (!est && flags) bad(`A ứng viên ${i + 1} (không phải ước tính): không được có dòng cờ`);
    if (est && (/ngân sách|[()]/.test(why) || !/phù hợp với nhu cầu của anh chị$/.test(why.trim()))) bad(`A ứng viên ước tính: "Phù hợp vì" mong "…phù hợp với nhu cầu của anh chị" không ngân sách/ngoặc, thấy "${why.trim()}"`);
    if (!est && !/phù hợp với ngân sách và nhu cầu của anh chị/.test(why)) bad(`A ứng viên ${i + 1}: vendor không phải ước tính giữ "phù hợp với ngân sách và nhu cầu của anh chị", thấy "${why.trim()}"`);
    if (leaks(e.join("\n")).length) bad(`A ứng viên ${i + 1}: còn chữ nguồn giá trong mục: ${leaks(e.join("\n")).join("|")}`);
  });
  if (count(guidance(block), GUIDE_LINE) !== 1) bad(`A: hướng dẫn phải có đúng 1 dòng ${GUIDE_LINE}`);
}
{ // B. không ứng viên ước tính: không cờ, không dòng hướng dẫn
  const { M, ids, ov } = await twinBack([{ cat: "photography", price: REAL(6, 8) }, { cat: "photography", price: NOSRC(7, 9) }]);
  const r = await chat(M, { message: MSG_BY_CAT.photography, profile: coupleProfile({ budget: 300 }), overlay: ov });
  const block = candBlock(r.sp);
  if (block.includes("Ngân sách: chưa đủ cơ sở")) bad("B: không có ứng viên ước tính nhưng khối vẫn có cờ/dòng hướng dẫn 'chưa đủ cơ sở'");
  if (!/Giá: 6-8tr/.test(block)) bad("B: eval không đo đủ (thiếu ứng viên)");
}
{ // C. venue ước tính (giá theo bàn): cờ vẫn có
  const { M, ids, ov, nameOf } = await twinBack([{ cat: "venue", price: EST(4, 5) }, { cat: "venue", price: REAL(4, 5) }]);
  const r = await chat(M, { message: MSG_BY_CAT.venue, profile: coupleProfile({ budget: 300, guest_count: 200 }), overlay: ov });
  const block = candBlock(r.sp); const ents = entries(block, Object.fromEntries(ids.map((id) => [id, nameOf(id)])));
  if (!ents[ids[0]] || !ents[ids[1]]) bad("C venue: thiếu ứng viên");
  else { if (ents[ids[0]].filter((l) => l === FLAG_LINE).length !== 1) bad("C venue ước tính: thiếu cờ"); if (ents[ids[1]].includes(FLAG_LINE)) bad("C venue giá riêng: không được có cờ"); if (ents[ids[0]].some((l) => /Theo số bàn/.test(l))) bad("C venue ước tính: không được có dòng 'Theo số bàn' (không khẳng định tổng so ngân sách)"); }
}
{ // D. quét pool đóng dấu đầy đủ: mọi ứng viên estimate_* có cờ + Phù hợp vì không ngân sách; mọi ứng viên khác không có cờ
  const dir = stampedBack(); const M = await loadModules(dir); let nEst = 0, nOther = 0;
  for (const cat of ["photography", "attire", "makeup", "decor", "transport"]) for (const bc of [3, 10, 30]) {
    const r = await chat(M, { message: `${MSG_BY_CAT[cat]} ${bc}tr`, profile: coupleProfile({ budget: 300 }) });
    const block = candBlock(r.sp); const matches = r.md?.matches || []; if (!matches.length) continue;
    const names = Object.fromEntries(matches.map((m) => [m.vendor_id, M.POOL.find((v) => v.id === m.vendor_id).name])); const ents = entries(block, names);
    let anyEst = false;
    for (const m of matches) {
      const e = ents[m.vendor_id]; if (!e) { bad(`D ${cat} ${bc}tr: ứng viên ${m.vendor_id} không vào khối`); continue; }
      const est = /^estimate_/.test(String(m.price_basis)); const has = e.includes(FLAG_LINE); const why = e.find((l) => /Phù hợp vì:/.test(l)) || "";
      if (est) { nEst++; anyEst = true; if (!has) bad(`D ${cat} ${bc}tr: ${m.vendor_id} (ước tính) thiếu cờ`); if (/ngân sách/.test(why)) bad(`D ${cat} ${bc}tr: ${m.vendor_id} (ước tính) "Phù hợp vì" nói ngân sách: "${why.trim()}"`); }
      else { nOther++; if (has) bad(`D ${cat} ${bc}tr: ${m.vendor_id} (không ước tính) có cờ`); }
    }
    if (count(guidance(block), GUIDE_LINE) !== (anyEst ? 1 : 0)) bad(`D ${cat} ${bc}tr: dòng hướng dẫn phải ${anyEst ? "có đúng 1" : "không có"}`);
  }
  if (nEst < 10) bad(`D: chỉ ${nEst} ứng viên ước tính (eval không đo đủ)`);
}
end();
