#!/usr/bin/env node
/* T-177 tiêu chí 1 (tohong-front): mở chi tiết hạng mục thì nút hiện đúng "Tìm <tên hạng mục chữ thường> trong khoảng <X>tr", X = số trên thanh "Dự toán", khuôn T-167.
 * Ca: 90 -> "90tr"; 12,5 -> "12,5tr"; 12,34 -> "12,3tr" (làm tròn 1 chữ số); 1440 -> "1440tr" (không phân cách nghìn, không đổi sang tỷ).
 * Tên hạng mục: lấy từ tài liệu giả, giữ nguyên chữ (chỉ chữ thường), vd "Chụp ảnh + quay phim" -> "chụp ảnh + quay phim".
 * Chạy từ gốc tohong-hq: node eval/T-177/check_1_nhan_theo_du_toan.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, sliderVal, mkDoc, fmt }) => {
  const cases = [
    { id: 'venue', name: 'Nhà hàng tiệc cưới', amt: 90, want: 'Tìm nhà hàng tiệc cưới trong khoảng 90tr' },
    { id: 'photography', name: 'Chụp ảnh + quay phim', amt: 12.5, want: 'Tìm chụp ảnh + quay phim trong khoảng 12,5tr' },
    { id: 'decor', name: 'Trang trí tiệc + hoa', amt: 12.34, want: 'Tìm trang trí tiệc + hoa trong khoảng 12,3tr' },
    { id: 'jewelry', name: 'Nhẫn cưới + trang sức', amt: 1440, want: 'Tìm nhẫn cưới + trang sức trong khoảng 1440tr' },
  ];
  for (const c of cases) {
    const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: c.id, name: c.name, allocated_tr: c.amt }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 10 }]), c.id);
    const b = await findBtn(pg);
    if (b.n !== 1) bad(`[${c.id}] màn phải có đúng một nút bắt đầu bằng "Tìm", thấy ${b.n}`);
    else {
      if (b.text !== c.want) bad(`[${c.id}] nhãn nút phải là "${c.want}", thấy "${b.text}"`);
      const sv = await sliderVal(pg); // số thanh Dự toán (có thể bị làm tròn theo bước); nhãn phải khớp số đang hiện trên thanh khi thanh là số nguyên bằng dự toán
      if (Number.isInteger(c.amt) && b.text !== `Tìm ${c.name.toLowerCase()} trong khoảng ${fmt(sv)}tr`) bad(`[${c.id}] nhãn phải dùng đúng số thanh Dự toán (${sv}), thấy "${b.text}"`);
    }
    await ctx.close();
  }
});
