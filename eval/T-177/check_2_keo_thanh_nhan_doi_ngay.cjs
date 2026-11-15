#!/usr/bin/env node
/* T-177 tiêu chí 2 (tohong-front): kéo thanh "Dự toán" thì nhãn đổi theo NGAY, theo số đang hiện trên thanh, kể cả khi chưa lưu và khi lưu lỗi (server giả trả 500, T-171 H5).
 * Venue 90 -> kéo 40: nhãn "... trong khoảng 40tr" đọc ngay sau khi thanh dừng (trước khi lưu tự động ~800ms), và vẫn 40tr sau khi lưu lỗi (không về 90tr theo server).
 * Rồi kéo 65: nhãn 65tr. Nút Reset (về mức gốc) cũng đổi nhãn theo số mới.
 * Chạy từ gốc tohong-hq: node eval/T-177/check_2_keo_thanh_nhan_doi_ngay.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, sliderVal, dragTo, mkDoc, sleep }) => {
  const { ctx, pg, S } = await openCat(br, dev, mkDoc([{ id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: 90 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110 }]), 'venue', { putFail: true });
  const want = (n) => `Tìm nhà hàng tiệc cưới trong khoảng ${n}tr`;
  let b = await findBtn(pg); if (b.text !== want(90)) bad(`khởi điểm phải là "${want(90)}", thấy "${b.text}"`);
  await dragTo(pg, 40); b = await findBtn(pg); const putsNow = S.puts.length;
  if (b.text !== want(40)) bad(`vừa kéo thanh tới 40 (chưa lưu, ${putsNow} lần ghi), nhãn phải là "${want(40)}", thấy "${b.text}"`);
  await sleep(2500); b = await findBtn(pg);
  if (S.puts.length < 1) bad('khung eval hỏng: không thấy lần lưu nào sau khi kéo');
  if (b.text !== want(40)) bad(`lưu lỗi (server 500) thì nhãn vẫn theo thanh 40, không về số server; thấy "${b.text}"`);
  await dragTo(pg, 65); b = await findBtn(pg);
  if (b.text !== want(65)) bad(`kéo tiếp tới 65, nhãn phải là "${want(65)}", thấy "${b.text}"`);
  const rs = pg.getByRole('button', { name: /Reset/ }).first();
  if (await rs.isEnabled().catch(() => false)) { await rs.click(); await sleep(150); b = await findBtn(pg); const sv = await sliderVal(pg); if (b.text !== want(sv)) bad(`bấm Reset (thanh về ${sv}) nhãn phải là "${want(sv)}", thấy "${b.text}"`); }
  await ctx.close();
});
