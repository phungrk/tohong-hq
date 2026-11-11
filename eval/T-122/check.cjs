// T-122 eval tầng 1 (hành vi): footer onboarding trong suốt dần khi còn nội dung nằm dưới, đặc lại khi hết.
// Chạy: node eval/T-122/check.cjs --repo <tohong-front> [--only 1,2,...]   -> in PASS hoặc FAIL <lý do>, mã thoát 0/1 (2 = lỗi chạy)
// 390x650: Chrome iOS ước từ ảnh Capu (GIẢ ĐỊNH, ~60%); 393x662: đo từ ảnh (1179x2556 @3x, vùng nhìn thấy ~662); 375x632: iPhone mini; 390x664: T-115.
const { run, open, install, shot, alphaAt, diffPct, contrastIn } = require('./lib.cjs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const REPO = arg('--repo') || process.env.TOHONG_FRONT_REPO || process.cwd();
const ONLY = (arg('--only') || '1,2,3,4,5').split(',');
const FADE_VPS = [[390, 650], [375, 632], [390, 664], [393, 662]];
const A_TOP = 0.6, A_VEIL0 = 0.1, A_BAND = 0.95, A_SOLID = 0.98, DIFF_MIN = 0.5, CONTRAST = 4.5, GAP = 4;
const fails = []; const bad = (vp, m) => fails.push(`${vp}: ${m}`);
const f1 = v => Math.round(v * 100) / 100;

// Chụp một trạng thái tại scrollTop y. Trả về số đo + ảnh 'n' (thường), 'p' (nền tím), 'h' (ẩn vùng nội dung).
async function capture(page, y) {
  await page.evaluate(y => window.__m.scrollTo(y), y); await page.waitForTimeout(500);
  const g = await page.evaluate(() => window.__m.geo());
  await shot(page, 'n');
  await page.evaluate(() => window.__m.probe(true)); await page.waitForTimeout(300); await shot(page, 'p'); await page.evaluate(() => window.__m.probe(false));
  await page.evaluate(() => window.__m.hide(true)); await page.waitForTimeout(300); await shot(page, 'h'); await page.evaluate(() => window.__m.hide(false));
  g.x = g.sheet.left + 3; g.paperY = g.scroller.top - 6;
  g.aTop = (await alphaAt(page, g.x, [g.footer.top + 1], g.paperY))[0];
  const yp = []; for (let y2 = g.footer.top - 16; y2 <= g.prim.top; y2 += 2) yp.push(y2);
  g.prof = await alphaAt(page, g.x, yp, g.paperY); g.aAbove0 = g.prof[0];
  g.aAboveMax = Math.max(...(await alphaAt(page, g.x, [g.footer.top - 14, g.footer.top - 8, g.footer.top - 2], g.paperY)));
  const ys = []; for (let y2 = g.footer.top + 1; y2 < g.footer.top + 31; y2 += 3) ys.push(y2);
  g.aMin30 = Math.min(...(await alphaAt(page, g.x, ys, g.paperY)));
  const ys2 = []; for (let y2 = g.prim.top; y2 < g.footer.bottom - 1; y2 += 6) ys2.push(y2);
  g.aLow = Math.min(...(await alphaAt(page, g.x, ys2, g.paperY)));
  return g;
}
const mid = r => [r.left + r.w / 2, r.top + r.h / 2];
async function btnsOk(page, vp, g, tag) {
  for (const k of ['prim', 'sec']) { const [cx, cy] = mid(g[k]); if (!(await page.evaluate(([k, cx, cy]) => window.__m.hitIs(k, cx, cy), [k, cx, cy]))) bad(vp, `${tag}: nút ${k === 'prim' ? 'chính' : 'phụ'} bị phủ hoặc ngoài vùng nhìn thấy`); }
  if (g.prim.h < 44) bad(vp, `${tag}: nút chính cao ${f1(g.prim.h)}px < 44`);
}
// Phát biểu trạng thái đúng theo luật: còn nội dung dưới đỉnh footer đặc -> mờ; hết -> đặc.
function expectState(c, solidTop) { return c.contentBottom > solidTop - GAP ? 'fade' : 'solid'; }
function checkState(vp, tag, c, want) {
  if (want === 'fade') {
    if (c.aAbove0 > A_VEIL0) bad(vp, `${tag}: 16px trên đỉnh footer đã mờ đục (alpha ${f1(c.aAbove0)} > ${A_VEIL0})`);
    if (c.aTop > A_TOP) bad(vp, `${tag}: còn nội dung dưới footer nhưng mép trên footer đã đặc (alpha ${f1(c.aTop)} > ${A_TOP})`);
    for (let i = 1; i < c.prof.length; i++) if (c.prof[i] < c.prof[i - 1] - 0.05) { bad(vp, `${tag}: độ đặc không tăng dần từ 16px trên footer tới nút Tiếp theo (tụt ${f1(c.prof[i - 1])} -> ${f1(c.prof[i])})`); break; }
  } else {
    if (c.aMin30 < A_SOLID) bad(vp, `${tag}: hết nội dung dưới footer nhưng footer chưa đặc (alpha nhỏ nhất ${f1(c.aMin30)} < ${A_SOLID})`);
    if (c.aAboveMax > A_VEIL0) bad(vp, `${tag}: hết nội dung dưới footer nhưng còn dải mờ phủ nội dung phía trên footer (alpha ${f1(c.aAboveMax)} > ${A_VEIL0})`);
  }
  if (c.aLow < A_BAND) bad(vp, `${tag}: vùng từ đỉnh nút Tiếp theo trở xuống không đặc (alpha nhỏ nhất ${f1(c.aLow)} < ${A_BAND})`);
}

(async () => {
  await run(REPO, async (browser, url) => {
    // 1 + 2 + 3 + 4 trên bước 2
    for (const [W, H] of FADE_VPS) {
      const vp = `${W}x${H}`; const { ctx, page } = await open(browser, url, W, H, 2); await install(page, 2);
      const end = await capture(page, 1e5); const solidTop = end.footer.top;
      const top = await capture(page, 0);
      if (ONLY.includes('1')) {
        if (top.maxScroll <= 0) bad(vp, 'vùng nội dung không cuộn được');
        if (expectState(top, solidTop) !== 'fade') bad(vp, `tiền đề sai: chưa cuộn mà không còn nội dung dưới footer (đáy nội dung ${f1(top.contentBottom)} <= ${f1(solidTop - GAP)})`);
        checkState(vp, '1 chưa cuộn', top, 'fade');
        const band = { left: top.sheet.left + 16, right: top.sheet.right - 16, top: top.footer.top, bottom: top.prim.top };
        const hasInk = await page.evaluate(([a, c]) => window.__m.textIn(a, c), [top.footer.top, top.prim.top]);
        const d = hasInk ? await diffPct(page, band) : 100; if (process.env.DBG) console.log('band', JSON.stringify(band), d); if (d < DIFF_MIN) bad(vp, `1 chưa cuộn: không thấy nội dung xuyên qua footer (khác biệt ${f1(d)}% < ${DIFF_MIN}% trong dải trên nút Tiếp theo)`);
        const b = await page.evaluate(([a, c]) => window.__m.contentBtnAt(a, c), [top.footer.top, top.prim.top]);
        if (!b) bad(vp, '1 chưa cuộn: không có nút nội dung nào nằm dưới dải mờ của footer'); else { const h = await page.evaluate(([x, y]) => window.__m.hit(x, y), [b.cx, b.y]); if (h !== 'content') bad(vp, `1 chưa cuộn: chạm vào dải mờ không xuống tới nội dung (phần tử trên cùng thuộc "${h}")`); }
      }
      if (ONLY.includes('2')) {
        await btnsOk(page, vp, top, '2 chưa cuộn');
        const cp = await contrastIn(page, top.prim), cs = await contrastIn(page, top.sec), ce = await contrastIn(page, end.prim);
        if (cp.ratio < CONTRAST) bad(vp, `2: chữ nút Tiếp theo tương phản ${f1(cp.ratio)}:1 < ${CONTRAST}:1`);
        if (cs.ratio < CONTRAST) bad(vp, `2: chữ "Quay lại bước 1" tương phản ${f1(cs.ratio)}:1 < ${CONTRAST}:1`);
        const cpp = await contrastIn(page, top.prim, 'p');
        if (cp.bg.some((v, i) => Math.abs(v - cpp.bg[i]) > 8)) bad(vp, `2: nút Tiếp theo trong suốt, lộ nền phía sau (${cp.bg} so với ${cpp.bg} khi nền sau đổi màu)`);
        if (cp.bg.some((v, i) => Math.abs(v - ce.bg[i]) > 8)) bad(vp, `2: nền nút Tiếp theo khi mờ (${cp.bg}) khác khi đặc (${ce.bg}): nút bị làm mờ`);
      }
      if (ONLY.includes('3')) {
        checkState(vp, '3 đã cuộn hết', end, 'solid');
        if (Math.abs(end.footer.h - 119) > 1) bad(vp, `3 đã cuộn hết: footer cao ${f1(end.footer.h)} != 119`);
        if (Math.abs(end.footer.bottom - end.inner.h) > 1) bad(vp, '3 đã cuộn hết: footer không sát đáy vùng nhìn thấy');
        if (end.contentBottom > end.footer.top - GAP) bad(vp, `3 đã cuộn hết: nội dung cuối còn dưới footer (đáy ${f1(end.contentBottom)} > ${f1(end.footer.top - GAP)})`);
        if (end.docScrollW > end.inner.w) bad(vp, '3: trang cuộn ngang');
        await btnsOk(page, vp, end, '3 đã cuộn hết');
      }
      if (ONLY.includes('4')) {
        // dải trung gian: chỉ thử trên hai viewport thấp nhất, nơi còn đủ khoảng cuộn
        if (W <= 390 && H <= 650) {
          const sClear = top.contentBottom - (solidTop - 6), sFade = top.contentBottom - (solidTop + 20);
          if (sClear > top.maxScroll + 0.5 || sFade < 0) bad(vp, `4: không dựng được điểm cuộn thử (sClear ${f1(sClear)}, sFade ${f1(sFade)}, max ${f1(top.maxScroll)})`);
          else {
            const a = await capture(page, sClear); checkState(vp, `4 đáy nội dung cách đỉnh footer đặc 6px`, a, expectState(a, solidTop));
            if (expectState(a, solidTop) !== 'solid') bad(vp, '4: tiền đề sai (điểm cuộn sClear vẫn còn nội dung dưới footer)');
            const b = await capture(page, sFade); checkState(vp, '4 nội dung còn lấn 20px dưới đỉnh footer', b, 'fade');
            const c = await capture(page, 0); checkState(vp, '4 cuộn ngược về đầu', c, 'fade');
          }
        }
      }
      await ctx.close();
    }
    if (ONLY.includes('2')) {
      for (const [lab, re, want] of [['Tiếp theo', /^Tiếp theo/, 'BƯỚC 3 / 3'], ['Quay lại bước 1', /^Quay lại bước 1/, 'BƯỚC 1 / 3']]) {
        const { ctx, page } = await open(browser, url, 375, 632, 2);
        try { await page.getByRole('button', { name: re }).click({ timeout: 4000 }); await page.getByText(want).first().waitFor({ timeout: 4000 }); }
        catch (e) { bad('375x632', `2: bấm "${lab}" khi footer đang mờ không sang được ${want}`); }
        await ctx.close();
      }
    }
    if (ONLY.includes('3')) {
      { const vp = '430x932'; const { ctx, page } = await open(browser, url, 430, 932, 2); await install(page, 2); const c = await capture(page, 0);
        if (c.maxScroll > 0) bad(vp, '3: tiền đề sai, màn cao mà vẫn cuộn được');
        checkState(vp, '3 màn cao, chưa cuộn', c, 'solid'); if (Math.abs(c.footer.h - 119) > 1 || Math.abs(c.footer.top - 813) > 1) bad(vp, `3 màn cao: footer đỉnh ${f1(c.footer.top)} cao ${f1(c.footer.h)}, mong 813 / 119`);
        await btnsOk(page, vp, c, '3 màn cao'); await ctx.close(); }
      { const vp = '1280x800'; const { ctx, page } = await open(browser, url, 1280, 800, 2, { desktop: true }); await install(page, 2); const c = await capture(page, 0);
        checkState(vp, '3 desktop', c, 'solid');
        if (Math.abs(c.footer.top - 681) > 1 || Math.abs(c.footer.h - 119) > 1 || Math.abs(c.sheet.top - 76) > 1 || Math.abs(c.sheet.h - 724) > 1) bad(vp, `3 desktop đổi: sheet ${f1(c.sheet.top)}/${f1(c.sheet.h)}, footer ${f1(c.footer.top)}/${f1(c.footer.h)}, mong 76/724 và 681/119`);
        await ctx.close(); }
    }
    if (ONLY.includes('5')) {
      for (const [W, H] of [[390, 650], [320, 568]]) {
        const vp = `3a ${W}x${H}`; const { ctx, page } = await open(browser, url, W, H, 'grid'); await install(page, 'grid');
        const end = await capture(page, 1e5), top = await capture(page, 0);
        checkState(vp, '5 đã cuộn hết', end, 'solid'); if (end.contentBottom > end.footer.top - GAP) bad(vp, '5 đã cuộn hết: ảnh cuối còn dưới footer');
        const want = expectState(top, end.footer.top); if (want !== 'fade') bad(vp, '5: tiền đề sai (lưới ảnh không tràn dưới footer)');
        checkState(vp, '5 chưa cuộn', top, 'fade');
        const b = await page.evaluate(([a, c]) => window.__m.contentBtnAt(a, c), [top.footer.top, top.prim.top]);
        if (b) { const h = await page.evaluate(([x, y]) => window.__m.hit(x, y), [b.cx, b.y]); if (h !== 'content') bad(vp, `5 chưa cuộn: chạm vào dải mờ không xuống tới nội dung ("${h}")`); }
        const [cx, cy] = mid(top.prim); if (!(await page.evaluate(([cx, cy]) => window.__m.hitIs('prim', cx, cy), [cx, cy]))) bad(vp, '5: nút chính bị phủ khi footer mờ');
        await ctx.close();
      }
    }
  });
  if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch(e => { console.log('FAIL (lỗi chạy) ' + (e.stack || e.message)); process.exit(2); });
