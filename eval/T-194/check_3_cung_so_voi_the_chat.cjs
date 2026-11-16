#!/usr/bin/env node
/* T-194 tiêu chí 3: màn Ngân sách và thẻ ngân sách trong chat (ChatBudgetMini) ghi CÙNG số cho từng hạng mục, và số đó đúng quy tắc (rỗng/null/không phải số = 0, chuỗi số = số).
 * Cùng một dự toán giả (như check_1, mục tiêu 100) cho hai nơi. Mỗi hạng mục: số ở hàng tổng quan Ngân sách == số ở nút số của hàng thẻ chat == số mong đợi (ca 1: 0tr, 0tr, 30tr, 20tr, 0tr). Ca 2 (cách đọc số, H0): "20,5" -> 0tr, " 7 " -> 7tr, "20tr" -> 0tr, "3.4" -> 3,4tr, "" -> 0tr, đúng như thẻ chat (Number(x) || 0); Infinity ngoài phạm vi.
 * Ngoài ra: tổng các hàng ở thẻ chat == "Đã phân bổ" ở màn Ngân sách (50tr).
 * Đỏ trên main 6b9ad94: thẻ chat đúng (0tr...), màn Ngân sách ghi "tr" và "Đã phân bổ tr".
 * Chạy: node eval/T-194/check_3_cung_so_voi_the_chat.cjs [--repo <tohong-front>] */
const { E, rows, waitCard, waitText, listRow, val, MIX, MIX2 } = require('./_b.cjs'); const S = E.setup();
const runCase = async (MIX, tag) => {
  const doc = E.budgetDoc(MIX, { total_tr: 100, mung_tr: 0 });
  const names = MIX.map((c) => c[1]);
  const want = Object.fromEntries(MIX.map((c) => [c[1], E.tr(val(c[2]))]));
  const sum = MIX.reduce((s, c) => s + val(c[2]), 0);
  let chat = {}, screen = {}, header = '';
  let pg = await S.page('__t187c.html', '', { budget: doc });
  try { await waitCard(pg); await pg.waitForTimeout(800); const r = await rows(pg, names); for (const n of names) chat[n] = r[n] ? r[n].btn : null; } catch (e) { S.bad(tag + ' thẻ chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget', { budget: doc });
  try {
    await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
    for (const n of names) { const r = await listRow(pg, n); screen[n] = r ? r.amt : null; }
    header = E.dash(await S.bodyText(pg));
  } catch (e) { S.bad(tag + ' màn Ngân sách: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  for (const n of names) {
    if (chat[n] !== want[n]) S.bad(`${tag} thẻ chat: hàng "${n}" mong "${want[n]}", thấy "${chat[n]}"`);
    if (screen[n] !== want[n]) S.bad(`${tag} màn Ngân sách: hàng "${n}" mong "${want[n]}" (cùng thẻ chat), thấy "${screen[n]}"`);
    else if (chat[n] !== screen[n]) S.bad(`${tag} hàng "${n}": thẻ chat "${chat[n]}" khác màn Ngân sách "${screen[n]}"`);
  }
  if (!header.toLowerCase().includes(`đã phân bổ ${E.tr(sum)} / `)) S.bad(`${tag} màn Ngân sách: "Đã phân bổ" phải bằng tổng các hàng thẻ chat ${E.tr(sum)}, thấy "${header.slice(0, 200)}"`);
};
S.run(async () => { await runCase(MIX, '[ca 1: rỗng/abc/số/"20"]'); await runCase(MIX2, '[ca 2: "20,5", " 7 ", "20tr", "3.4", ""]'); });
