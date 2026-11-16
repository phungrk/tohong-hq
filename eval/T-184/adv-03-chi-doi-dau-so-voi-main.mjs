// T-184 adv-03 (adversary): diff hành vi back so với main 2d1a76c (trước T-183) trên lưới hồ sơ nhiều hạng mục, có/không gu, ngày, ước tính.
// Mong: id, thứ tự, điểm, breakdown, mọi số JSON, icon chip, budgetBasis (cả text) GIỐNG HỆT; chip và whyThisVendor giống hệt sau khi đổi "d,d" -> "d.d";
// whyThoseVendors giống hệt sau khi thay mọi số bằng "#" (main in số thô ở vế ngân sách/giá dao động nên chỉ so khung câu).
// Bản main lấy bằng `git archive 2d1a76c` của TOHONG_BACK_REPO vào thư mục tạm, xoá khi xong.
import p from "path"; import os from "os"; import fs from "fs"; import { execSync } from "child_process"; import { pathToFileURL as u } from "url";
import { computeMatches as cur, venue, bad, done } from "../T-183/_lib.mjs";
const back = process.env.TOHONG_BACK_REPO || p.resolve(p.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "tohong-back");
const tmp = fs.mkdtempSync(p.join(os.tmpdir(), "t184-adv03-"));
let n = 0;
try {
  execSync(`git -C "${back}" archive 2d1a76c lib package.json | tar -x -C "${tmp}"`);
  fs.symlinkSync(p.join(back, "node_modules"), p.join(tmp, "node_modules")); // phụ thuộc của lib (yaml…) lấy từ repo back
  const { computeMatches: old } = await import(u(p.join(tmp, "lib", "vendorMatcher.js")).href);
  const dot = (s) => String(s ?? "").replace(/(\d),(\d)/g, "$1.$2");
  const shape = (s) => String(s ?? "").replace(/\d+(?:[.,]\d+)?/g, "#");
  const strip = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === "reasons" || k === "whyThisVendor" || k === "whyThoseVendors" ? undefined : v)));
  const ph = (id, a, b, extra = {}) => ({ ...venue({ id, name: "P" + id, priceMin: a, priceMax: b, ...extra }), category: "photography", price_basis: undefined, priceSource: undefined });
  const pools = [
    ["venue", [venue({ id: "a", name: "A", priceMin: 3.9, priceMax: 3.9, rating: 4.9, reviewCount: 120, styles: ["modern"] }), venue({ id: "b", name: "B", priceMin: 4.25, priceMax: 4.25 }),
      venue({ id: "c", name: "C", priceMin: 3, priceMax: 5.55, price_basis: "estimate_category", priceSource: "estimate_category" }), venue({ id: "d", name: "D", priceMin: 2.95, priceMax: 3.96, availability: ["2027-03-20"] })]],
    ["photography", [ph("1", 10.5, 15.5, { rating: 4.85, reviewCount: 60 }), ph("2", 8, 12.25), ph("3", 20, 20)]],
  ];
  const profiles = [];
  for (const g of [null, 95, 300, 330, 3600]) for (const b of [null, 12.25, 139.5, 400]) for (const st of [[], ["modern"]]) for (const d of [null, "2027-03-20"])
    profiles.push({ guestCount: g, budgetByCategory: b == null ? {} : { venue: b, photography: b / 10 }, budgetTotal: b == null ? 600 : null, preferredStyles: st, weddingDate: d, city: "HCMC" });
  for (const [cat, pool] of pools) for (const prof of profiles) {
    const A = old(prof, { category: cat, pool, limit: 50 }), B = cur(prof, { category: cat, pool, limit: 50 });
    n++;
    const sa = JSON.stringify(strip(A)), sb = JSON.stringify(strip(B));
    if (sa !== sb) { bad(`${cat} ${JSON.stringify(prof)}: JSON/thứ tự/điểm khác main`); continue; }
    A.vendors.forEach((va, i) => {
      const vb = B.vendors[i];
      const la = va.match.reasons.map((r) => r.icon + "|" + r.label), lb = vb.match.reasons.map((r) => r.icon + "|" + dot(r.label));
      if (JSON.stringify(la) !== JSON.stringify(lb)) bad(`chip khác ngoài dấu: ${JSON.stringify(la)} vs ${JSON.stringify(vb.match.reasons.map((r) => r.label))}`);
      if (va.match.whyThisVendor !== dot(vb.match.whyThisVendor)) bad(`whyThisVendor khác ngoài dấu: "${va.match.whyThisVendor}" vs "${vb.match.whyThisVendor}"`);
    });
    if (shape(A.whyThoseVendors) !== shape(B.whyThoseVendors)) bad(`whyThoseVendors khác khung: "${A.whyThoseVendors}" vs "${B.whyThoseVendors}"`);
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
done(n);
