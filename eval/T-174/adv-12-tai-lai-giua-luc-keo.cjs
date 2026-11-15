#!/usr/bin/env node
/* T-174 adversary 12 (tohong-front, spec T-171 v3.1 H5): race "màn tải lại lúc lỗi xảy ra GIỮA lúc người dùng đang kéo" — bản ghép tính từ ảnh màn lúc tải về
 * và nền đặt = server ngay sau đó; kiểm số người dùng kéo không bị nuốt. Kéo bằng CHUỘT (pointermove liên tục, không phải phím).
 * Input (4 lượt, lần GET tải lại trễ 0/150/400/900ms để rơi giữa các bước kéo): lưu dự toán lỗi; mạng tốt; trong lúc giữ chuột kéo qua lại, bấm Chốt/bỏ chốt Alpha bằng script
 * (syncBudgetItem GET+PUT, rồi màn tải lại); thả chuột; V = số thanh lúc thả.
 * Mong đợi: sau lần tự lưu ghép, thanh vẫn V, server allocated = V, khoản vendor_t171_a có/không đúng theo chốt/bỏ chốt, câu báo mất.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-12-tai-lai-giua-luc-keo.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
runAdv(async ({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep }) => {
  const banner = async () => /Chưa lưu được dự toán/.test(await body());
  let gate = null; // { p0, delay, done }
  await pg.route('http://localhost:8787/api/couples/t171/budget', async (r) => {
    if (gate && !gate.done && r.request().method() === 'GET' && D.puts.length > gate.p0) { gate.done = true; if (gate.delay) await sleep(gate.delay); }
    return r.fallback();
  });
  let target = 40, confirmed = false;
  for (const delay of [0, 150, 400, 900]) {
    const L = `[trễ ${delay}ms]`;
    D.putFail = '500'; target = target === 40 ? 55 : 40; await dragTo(pg, target);
    if (!(await waitFor(banner))) { bad(`${L} khung: lưu lỗi phải hiện câu báo`); return; }
    D.putFail = null; gate = { p0: D.puts.length, delay, done: false };
    const box = await pg.getByRole('slider', { name: 'Dự toán' }).boundingBox();
    const y = box.y + box.height / 2; let x = box.x + box.width * 0.3;
    await pg.mouse.move(x, y); await pg.mouse.down();
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Chốt'); b && b.click(); });
    confirmed = !confirmed;
    const t0 = Date.now(); let dir = 1;
    while (Date.now() - t0 < 1800) { x += dir * box.width * 0.01; if (x > box.x + box.width * 0.7 || x < box.x + box.width * 0.2) dir = -dir; await pg.mouse.move(x, y); await sleep(15); }
    await pg.mouse.up(); const V = await slider();
    if (!gate.done) bad(`${L} khung: màn không tải lại trong lúc kéo`);
    await waitFor(async () => venue().allocated_tr === V && !(await banner()), 6000); await sleep(600);
    const has = (venue().items || []).some((x2) => x2.id === 'vendor_t171_a');
    if ((await slider()) !== V) bad(`${L} thanh nhảy khỏi số người dùng thả (${V}) sang ${await slider()}`);
    if (venue().allocated_tr !== V) bad(`${L} server phải lưu số người dùng thả ${V}, thấy ${venue().allocated_tr}`);
    if (has !== confirmed) bad(`${L} khoản vendor_t171_a phải ${confirmed ? 'có' : 'không có'} (theo chốt/bỏ chốt), thấy ${has ? 'có' : 'không'}`);
    if (await banner()) bad(`${L} câu báo còn sau khi lưu được`);
    target = V;
  }
});
