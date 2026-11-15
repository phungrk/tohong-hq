#!/usr/bin/env node
/* T-181 adv-01 (adversary, tầng 3): khuôn số ở biên mà check_1/check_3 chưa chạm (spec T-177 H1, H3, H4, "Câu hỏi mở": R = Math.round(X*10)/10, R < 0,05 coi là 0).
 * Ca: 1000,05 (R theo đúng công thức, không phân cách nghìn); 0,05 -> "0,1tr" (biên làm tròn); 0,049 -> nhãn cũ; 99,96 -> "100tr"; -5 (âm) -> nhãn cũ;
 *     null -> nhãn cũ; "abc" (chuỗi không phải số) -> nhãn cũ; "12.34" (số dạng chuỗi) -> "12,3tr"; tên viết hoa có dấu "ĐÁM CƯỚI TRỌN GÓI" -> chữ thường.
 * Mọi ca: chữ nút không có NaN / undefined / null / Infinity / "0tr" / dấu chấm thập phân / phân cách nghìn.
 * Chạy từ gốc tohong-hq: node eval/T-181/adv-01-khuon-so-bien.cjs [--repo <tohong-front>] */
const { run } = require('../T-177/_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, mkDoc }) => {
  const R = (x) => Math.round(Number(x) * 10) / 10;
  const lbl = (name, x) => { const r = R(x); return r > 0 ? `Tìm ${name.toLowerCase()} trong khoảng ${String(r).replace('.', ',')}tr` : `Tìm ${name.toLowerCase()}`; };
  const N = 'Nhà hàng tiệc cưới';
  const cases = [[N, 1000.05], [N, 0.05], [N, 0.049], [N, 99.96], [N, -5], [N, null], [N, 'abc'], [N, '12.34'], ['ĐÁM CƯỚI TRỌN GÓI', 30]];
  for (const [name, v] of cases) {
    const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: 'venue', name, allocated_tr: v }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 100 }]), 'venue');
    const b = await findBtn(pg), want = lbl(name, v), tag = `[${JSON.stringify(v)}]`;
    if (b.n !== 1) bad(`${tag} cần đúng một nút "Tìm", thấy ${b.n}`);
    else {
      if (b.text !== want) bad(`${tag} nhãn phải là "${want}", thấy "${b.text}"`);
      if (/NaN|undefined|null|Infinity|\b0tr|\d\.\d|\d[ .]\d{3}tr/.test(b.text)) bad(`${tag} nhãn có chữ rác/khuôn sai: "${b.text}"`);
    }
    await ctx.close();
  }
});
