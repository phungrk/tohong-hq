// INV-044 (thăng từ T-161 adv-01, ADR-092). Gốc: T-161 adv-01 (Code Gate, tầng 3). Spec T-159 H5(d): "không đổi gì ảnh hưởng ngân sách hiệu lực của hạng mục đó
// (kể cả đổi phân bổ hạng mục khác) thì dùng lại cache, 0 lượt LLM".
// Input phá: KHÔNG đổi gì trong bảng; cặp đôi đã phân bổ ảnh 20tr và tiệc 150tr; mở chi tiết vendor ảnh V, rồi vendor tiệc X, rồi mở lại V.
// Mong: mở lại V tốn 0 lượt LLM (ngân sách hiệu lực của ảnh không đổi). Đối chứng: cùng trình tự khi không có bảng (hành vi cũ) cũng 0.
import { existsSync as __ex } from "fs"; import { fileURLToPath as __f, pathToFileURL as __u } from "url"; import __p from "path";
// ADR-070: tìm gốc HQ bằng cách đi lên tới scripts/gate.py (không theo độ sâu thư mục).
let __hq = __p.dirname(__f(import.meta.url)); while (!__ex(__p.join(__hq, "scripts", "gate.py")) && __p.dirname(__hq) !== __hq) __hq = __p.dirname(__hq);
const { loadBack, tab, newBucket, CID, eligible, overlayKeep, doc, coupleProfile, done } = await import(__u(__p.join(__hq, "eval", "T-159", "_lib.mjs")).href);
const M = await loadBack(); const fails = [];
const [V] = eligible(M, "photography"); const [X] = eligible(M, "venue");
if (!V || !X) { console.log("FAIL tín hiệu thử hỏng: pool thiếu vendor ảnh/tiệc"); process.exit(1); }
const overlay = { ...overlayKeep(M, "photography", [{ id: V.id, priceMin: 10, priceMax: 20 }]), ...overlayKeep(M, "venue", [{ id: X.id, priceMin: 100, priceMax: 150 }]) };
for (const [label, budgetDoc] of [["không có bảng (đối chứng)", undefined], ["có bảng: ảnh 20tr, tiệc 150tr", doc({ photography: 20, venue: 150 })]]) {
  const bucket = newBucket(M, { profile: coupleProfile({ budget: 300 }), budgetDoc, overlay, members: true });
  const open = async (id) => { const c = { n: 0 }; const r = await tab(M, { url: `/api/vendors/${id}?coupleId=${CID}`, bucket, env: { CLAUDE_API_KEY: "fake-eval" }, countFetch: c }); if (r.err || r.status !== 200) fails.push(`${label}: mở ${id} lỗi ${r.err?.message || r.status}`); return c.n; };
  const n0 = await open(V.id);
  if (!(n0 > 0)) { fails.push(`${label}: tín hiệu thử hỏng, mở lần đầu không gọi LLM`); continue; }
  await open(X.id);
  const again = await open(V.id);
  if (again !== 0) fails.push(`${label}: mở lại vendor ảnh sau khi mở vendor tiệc, không đổi bảng, tốn ${again} lượt fetch LLM (mong 0)`);
}
done(fails);
