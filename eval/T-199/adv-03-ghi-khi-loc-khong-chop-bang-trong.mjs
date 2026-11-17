#!/usr/bin/env node
// T-199 adv-03 (tầng 3, adversary): spec T-197 mục 8: "Nếu trang đang đứng không còn hàng nào mà vẫn còn hàng ở trước, bảng về trang cuối còn hàng ...
// không bao giờ hiện bảng trống khi tổng > 0". check_6 chỉ đọc bảng SAU KHI đã ổn định, nên một bản cài vẽ ra bảng trống ("Không có vendor nào khớp bộ lọc.",
// "Hiển thị 101–100 / 100") rồi mới nhảy trang vẫn xanh. Eval này ghi lại MỌI khung hình được vẽ (requestAnimationFrame) và mọi thay đổi DOM trong lúc Rút lại hàng
// cuối của trang cuối, và đòi không KHUNG HÌNH nào (đo bằng requestAnimationFrame, tức trạng thái trước mỗi lần vẽ) có bảng trống hay "Hiển thị a–b / N" với a > b
// khi N > 0. Trạng thái trung gian chỉ có trong DOM giữa hai lần vẽ (người dùng không thấy) chỉ được in ra để biết, không làm đỏ.
//  hồ sơ big3: 101 "Chờ Capu", đang ở trang 3 (1 hàng), Rút lại -> về trang 2
//  hồ sơ big : 51 "Chờ Capu", đang ở trang 2 (1 hàng), Rút lại -> về trang 1
// Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-199/adv-03-ghi-khi-loc-khong-chop-bang-trong.mjs --repo . --case 1   (TOHONG_BACK_REPO)
import { scenario, closeAll, settle, hien, act, pickStatus, PAGE } from "../T-197/lib/ui.mjs";
import { ROWS, reporter } from "../T-197/lib/common.mjs";

const R = reporter();
const watch = (S) => S.page.evaluate(() => {
  window.__adv = [];
  const look = (src) => {
    const t = document.body.innerText;
    const m = /Hiển thị (\d+)–(\d+) \/ (\d+)/.exec(t);
    const bad = (m && Number(m[3]) > 0 && Number(m[1]) > Number(m[2])) || (t.includes("Không có vendor nào khớp bộ lọc.") && (!m || Number(m[3]) > 0));
    if (bad) window.__adv.push(src + ": " + (m ? m[0] : "") + (t.includes("Không có vendor nào khớp bộ lọc.") ? " + bảng trống" : ""));
  };
  new MutationObserver(() => look("DOM")).observe(document.body, { subtree: true, childList: true, characterData: true });
  const tick = () => { look("khung hình"); window.__advRaf = requestAnimationFrame(tick); }; tick();
});
try {
  for (const [profile, n, from, to] of [["big3", 101, 2 * PAGE, PAGE], ["big", 51, PAGE, 0]]) {
    const S = await scenario(profile);
    await settle(S, hien(0, ROWS.length));
    await act(S, () => pickStatus(S, "Chờ Capu"));
    await settle(S, hien(0, n));
    for (let off = PAGE; off <= from; off += PAGE) { await act(S, () => S.page.getByRole("button", { name: "Trang sau" }).click()); await settle(S, hien(off, n)); }
    await watch(S);
    await act(S, () => S.table.locator("tbody tr").first().getByRole("button", { name: "Rút lại" }).click());
    await settle(S, hien(to, n - 1));
    await S.page.waitForTimeout(300);
    const all = await S.page.evaluate(() => window.__adv);
    const seen = all.filter((x) => x.startsWith("khung hình"));
    if (all.length && !seen.length) console.log(`  (biết) [${profile}] trạng thái trống chỉ thoáng qua trong DOM, không được vẽ: ${[...new Set(all)][0]}`);
    R.check(`[${profile}] Rút lại hàng ${n} ở trang cuối: về "${hien(to, n - 1)}" mà không lúc nào vẽ bảng trống / "Hiển thị a–b" với a > b`, seen.length === 0, [...new Set(seen)].slice(0, 3));
    await S.ctx.close();
  }
} catch (e) {
  R.check("thao tác không thực hiện được", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
