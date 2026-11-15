// T-172 tiêu chí 2: (a) "Hướng dẫn trả lời" gửi AI không dặn nêu nguồn/nhãn giá (không chữ "nhãn", "nguồn"), vẫn bảo trình bày giá;
// (b) lời AI trong chat, sinh qua luồng chat thật (handleCoupleChat) với một LLM giả "học trò ngoan" (trích lại mọi dòng giá và mọi dòng hướng dẫn nhắc giá của prompt),
// không chứa chữ nguồn giá nhưng vẫn có số giá của từng ứng viên. Không mạng.
import { twinBack, chatTurn, profileFor, MSG_BY_CAT, EST, REAL, NOSRC, candBlock, guidance, leaks, chatEcho, reporter, setNow } from "./_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
async function run(tag, specs, cat, wantGuide) {
  const { M, dir, ov } = await twinBack(specs);
  const t = await chatTurn(M, dir, { message: MSG_BY_CAT[cat], profile: profileFor(cat), overlay: ov, reply: chatEcho });
  if (t.status !== 200 || !t.system) return bad(`${tag}: chat không chạy (HTTP ${t.status}, ${t.calls.length} lượt LLM)`);
  const g = guidance(candBlock(t.system));
  if (!g) return bad(`${tag}: không thấy "Hướng dẫn trả lời" trong khối ứng viên`);
  if (/nhãn|nguồn/i.test(g)) bad(`${tag}: hướng dẫn còn dặn nêu nhãn/nguồn giá: ${g.split("\n").filter((l) => /nhãn|nguồn/i.test(l)).join(" | ").trim()}`);
  if (!g.includes(wantGuide)) bad(`${tag}: hướng dẫn thiếu "${wantGuide}"`);
  if (/\(kèm/.test(g)) bad(`${tag}: hướng dẫn còn "(kèm …)"`);
  const l = leaks(t.text); if (l.length) bad(`${tag}: lời AI còn chữ nguồn giá: ${[...new Set(l)].join(" | ")}`);
  for (const [i, s] of specs.entries()) { const p = s.ov?.priceMin != null ? s.ov : s.price; const want = `${Math.round(p.priceMin)}-${Math.round(p.priceMax)}tr`; if (!t.text.includes(want)) bad(`${tag} ứng viên ${i + 1}: lời AI mất số giá "${want}" (eval không đo đủ hoặc giá bị bỏ)`); }
}
await run("ảnh, có nguồn giá", [
  { cat: "photography", price: EST(6, 8) }, { cat: "photography", price: REAL(11, 13) },
  { cat: "photography", price: EST(21, 23), ov: { priceMin: 17, priceMax: 19, price_verified: true } }, { cat: "photography", price: NOSRC(31, 33) },
], "photography", "rõ giá và style");
await run("venue có nguồn giá", [{ cat: "venue", price: EST(4, 5) }, { cat: "venue", price: REAL(6, 7) }], "venue", "rõ giá và style");
await run("pool cũ không nguồn (giữ như cũ)", [{ cat: "photography", price: NOSRC(6, 8) }, { cat: "photography", price: NOSRC(12, 14) }], "photography", "rõ ngân sách và style");
end();
