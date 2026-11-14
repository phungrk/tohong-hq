// T-159 tiêu chí 1 (chat): hạng mục có allocated_tr > 0 thì chat lọc theo đúng số đó (triệu -> VND), đổi phân bổ đổi kết quả;
// thứ tự nguồn: số trong tin nhắn > allocated_tr (> 0) > trường cũ budget_breakdown (VND) > tổng x tỷ lệ.
// Pool điều khiển: 6 vendor ảnh, priceMin 38. Hồ sơ tổng 300tr (tổng x 10% = 30tr; nới x1,2 = 36tr: không bao giờ tới 38 nếu không có phân bổ).
import { loadBack, chat, eligible, overlayKeep, keepPrice, doc, coupleProfile, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const six = eligible(M, "photography").slice(0, 6);
const run = (o) => chat(M, { overlay: overlayKeep(M, "photography", keepPrice(six, o.pmin ?? 38, (o.pmin ?? 38) + 1)), ...o });
const expect = async (label, o, n) => { const r = await run(o); if (r.err) fails.push(`${label}: ném ${r.err.message}`); else if (r.ids.length !== n) fails.push(`${label}: ${r.ids.length} ứng viên, mong ${n}`); };
const P = coupleProfile({ budget: 300 });
await expect("allocated 40tr, tin nhắn không có số", { budgetDoc: doc({ photography: 40 }) }, 5);
await expect("đổi phân bổ xuống 20tr", { budgetDoc: doc({ photography: 20 }) }, 0);
await expect("allocated thập phân 37,5tr (vendor 37tr)", { budgetDoc: doc({ photography: 37.5 }), pmin: 37 }, 5);
await expect("số trong tin nhắn (20tr) thắng allocated 40tr", { budgetDoc: doc({ photography: 40 }), message: "Tìm photographer chụp ảnh cưới giúp anh chị 20tr" }, 0);
await expect("số trong tin nhắn (45tr) thắng allocated 20tr", { budgetDoc: doc({ photography: 20 }), message: "Tìm photographer chụp ảnh cưới giúp anh chị 45tr" }, 5);
await expect("allocated 40tr thắng trường cũ budget_breakdown 20tr (VND)", { budgetDoc: doc({ photography: 40 }), profile: coupleProfile({ budget: 300, budget_breakdown: { photography: 20_000_000 } }) }, 5);
await expect("trường cũ budget_breakdown 50tr (VND) thắng tổng x tỷ lệ khi chưa phân bổ", { budgetDoc: doc({ photography: 0 }), profile: coupleProfile({ budget: 300, budget_breakdown: { photography: 50_000_000 } }) }, 5);
await expect("phân bổ hạng mục khác không ảnh hưởng ảnh cưới", { budgetDoc: doc({ venue: 500, attire: 400, photography: 20 }) }, 0);
done(fails);
