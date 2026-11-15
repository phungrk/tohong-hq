// T-172 tiêu chí 6: API vẫn trả price_label + price_basis (ADR-099/100: chỉ bỏ nhãn khỏi prompt và lời AI, không đổi API, admin vẫn thấy) ở tab Vendor, chi tiết và /status
// với đúng chữ nhãn của T-164; và bất biến planner/vendor/inv-002 (đo API) vẫn PASS. Không mạng.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { twinBack, coupleProfile, CID, EST, REAL, AUTH, openDetail, whyEcho, reporter, setNow } from "./_lib.mjs";
import { tab } from "../T-159/_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const { M, ids, ov } = await twinBack([{ cat: "photography", price: EST(6, 8) }, { cat: "photography", price: REAL(6, 8) }, { cat: "photography", price: EST(6, 8), ov: { priceMin: 7, priceMax: 9, price_verified: true } }]);
const WANT = [["estimate_category", "Ước tính theo hạng mục"], ["legacy_marry", "Giá marry.vn · 06/2026"], ["admin_verified", "Giá đã xác minh"]];
const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile: coupleProfile({ budget: 300 }), overlay: ov });
ids.forEach((id, i) => {
  const v = r.body?.vendors?.find((x) => x.id === id);
  if (!v) return bad(`tab: thiếu vendor ${i + 1}`);
  if (v.price_basis !== WANT[i][0] || v.price_label !== WANT[i][1]) bad(`tab ${i + 1}: mong ${WANT[i][0]} / "${WANT[i][1]}", thấy ${v.price_basis} / "${v.price_label}"`);
});
for (const [i, id] of ids.entries()) {
  const d = await openDetail(M, id, { overlay: ov, reply: whyEcho });
  const v = d.body?.vendor; if (v?.price_basis !== WANT[i][0] || v?.price_label !== WANT[i][1]) bad(`chi tiết ${i + 1}: mong ${WANT[i][0]} / "${WANT[i][1]}", thấy ${v?.price_basis} / "${v?.price_label}"`);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const p = spawnSync("python3", ["-I", path.join(here, "..", "invariants", "planner", "vendor", "inv-002-gia-hien-ra-luon-co-nhan.py")], { encoding: "utf8", timeout: 300000 });
const last = (p.stdout.trim().split("\n").pop() || p.stderr.slice(-200));
if (!/^PASS/.test(last)) bad(`inv-002: ${last}`);
end();
