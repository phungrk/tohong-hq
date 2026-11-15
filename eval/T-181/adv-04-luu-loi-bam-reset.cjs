#!/usr/bin/env node
/* T-181 adv-04 (adversary, tầng 3): tổ hợp lưu lỗi + bấm + Reset (spec T-177 H2, H5). check_4 chỉ bấm khi dữ liệu đã lưu; ở đây bấm KHI ĐANG lưu lỗi.
 * Kịch bản (server giả trả 500 cho PUT): 90 -> kéo 35, chờ lưu lỗi; nhãn "… 35tr". Đo nền số PUT tự thử lại trong 2,5s, rồi bấm nút: mở tìm "venue" đúng một lần,
 * số PUT trong 2,5s sau bấm không vượt nền, không POST; nhãn vẫn 35tr. Bấm Reset: nhãn theo thanh. Kéo tiếp về 5: "… 5tr".
 * Chạy từ gốc tohong-hq: node eval/T-181/adv-04-luu-loi-bam-reset.cjs [--repo <tohong-front>] */
const { run } = require('../T-177/_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, sliderVal, dragTo, mkDoc, fmt, sleep }) => {
  const { ctx, pg, S } = await openCat(br, dev, mkDoc([{ id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: 90 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110 }]), 'venue', { putFail: true });
  const want = (n) => `Tìm nhà hàng tiệc cưới trong khoảng ${fmt(n)}tr`;
  await dragTo(pg, 35); await sleep(2500);
  let b = await findBtn(pg); if (b.text !== want(35)) bad(`lưu lỗi ở 35: nhãn phải "${want(35)}", thấy "${b.text}"`);
  const p0 = S.puts.length; await sleep(2500); const base = S.puts.length - p0, posts0 = S.posts;
  const p1 = S.puts.length;
  await pg.locator('button', { hasText: /^\s*Tìm\s/ }).click(); await sleep(2500);
  const opened = await pg.evaluate(() => window.__opened);
  if (opened.length !== 1 || opened[0] !== 'venue') bad(`bấm khi lưu lỗi phải mở tìm "venue" đúng một lần, thấy ${JSON.stringify(opened)}`);
  if (S.puts.length - p1 > base) bad(`bấm nút gây thêm PUT (${S.puts.length - p1} sau bấm, nền ${base})`);
  if (S.posts !== posts0) bad(`bấm nút gây POST (${S.posts - posts0})`);
  b = await findBtn(pg); if (b.n === 1 && b.text !== want(35)) bad(`sau bấm nhãn phải còn "${want(35)}", thấy "${b.text}"`);
  const rs = pg.getByRole('button', { name: /Reset/ }).first();
  if (await rs.isEnabled().catch(() => false)) { await rs.click(); await sleep(200); b = await findBtn(pg); const sv = await sliderVal(pg); const w = sv > 0 ? want(sv) : 'Tìm nhà hàng tiệc cưới'; if (b.text !== w) bad(`Reset (thanh ${sv}) nhãn phải "${w}", thấy "${b.text}"`); }
  await dragTo(pg, 5); await sleep(100); b = await findBtn(pg); if (b.text !== want(5)) bad(`kéo về 5 sau Reset: nhãn phải "${want(5)}", thấy "${b.text}"`);
  await ctx.close();
});
