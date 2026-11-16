#!/usr/bin/env node
/* T-193 đối kháng 1: thẻ ngân sách chat với số phân bổ rỗng/lạ từ API và tổng 0.
 * Spec T-192 H1: mỗi hàng ghi số của chính hạng mục, CÙNG số màn Ngân sách ghi (màn Ngân sách đọc `allocated_tr || 0` -> "0tr");
 * "Không hàng nào còn 'tr' đứng riêng, 'undefined', 'NaN'". H3: thanh tỷ lệ = phần trong tổng.
 * (Đã đo màn Ngân sách cùng dự toán: "" -> "Chụp ảnh 0tr". Chuỗi lạ "abc" cố ý KHÔNG đo: màn Ngân sách cũng ra "tr" với nó, ngoài phạm vi.)
 * Ca A: Chụp ảnh "" (chuỗi rỗng), Tiệc & nhà hàng null, Nhẫn bỏ khuyết, Dự phòng 40 -> ba hàng đầu "0tr", Dự phòng "40tr"; thanh: 0,0,0,100%.
 * Ca B: mọi hạng mục 0 (tổng 0) -> mọi hàng "0tr", mọi thanh 0% (không NaN thành đầy rãnh).
 * Chạy: node eval/T-193/adv-01-the-ngan-sach-so-rong-va-tong-0.cjs [--repo <tohong-front>] */
const path = require('path');
const { E, rows, BARE_TR, waitCard } = require(path.join(__dirname, '../T-192/_mini.cjs')); const S = E.setup();
const widths = (pg) => pg.evaluate(() => [...document.querySelectorAll('div')].filter((e) => getComputedStyle(e).height === '5px' && getComputedStyle(e).overflow === 'hidden' && e.children.length === 1).map((e) => e.children[0].getBoundingClientRect().width / e.getBoundingClientRect().width * 100));
const A = [['photography', 'Chụp ảnh', ''], ['venue', 'Tiệc & nhà hàng', null], ['jewelry', 'Nhẫn cưới & trang sức', undefined], ['reserve', 'Dự phòng', 40]];
const WA = { 'Chụp ảnh': 0, 'Tiệc & nhà hàng': 0, 'Nhẫn cưới & trang sức': 0, 'Dự phòng': 40 };
const B = [['photography', 'Chụp ảnh', 0], ['venue', 'Tiệc & nhà hàng', 0], ['reserve', 'Dự phòng', 0]];
S.run(async () => {
  for (const [label, cats, want, bars] of [['A rỗng/null/lạ', A, WA, [0, 0, 0, 100]], ['B tổng 0', B, { 'Chụp ảnh': 0, 'Tiệc & nhà hàng': 0, 'Dự phòng': 0 }, [0, 0, 0]]]) {
    const pg = await S.page('__t187c.html', '', { budget: E.budgetDoc(cats, { total_tr: 100 }) });
    try {
      await waitCard(pg); await pg.waitForTimeout(800);
      const r = await rows(pg, cats.map((c) => c[1]));
      for (const [, name] of cats) {
        const x = r[name];
        if (!x) { S.bad(`(${label}) không thấy hàng "${name}"`); continue; }
        if (BARE_TR.test(x.text) || /undefined|NaN|null/.test(x.text)) S.bad(`(${label}) hàng "${name}": "tr" trơ hoặc chữ lỗi, thấy "${x.text}" (mong "${name} ${want[name]}tr", như màn Ngân sách)`);
        else if (x.btn !== `${want[name]}tr`) S.bad(`(${label}) hàng "${name}": mong "${want[name]}tr", thấy "${x.btn}"`);
      }
      const w = await widths(pg);
      if (w.length !== bars.length) S.bad(`(${label}) mong ${bars.length} thanh, thấy ${w.length}`);
      else bars.forEach((b, i) => { if (!(Math.abs(w[i] - b) <= 2)) S.bad(`(${label}) thanh ${i + 1}: mong ~${b}%, thấy ${w[i].toFixed(1)}%`); });
    } catch (e) { S.bad(`(${label}) lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
