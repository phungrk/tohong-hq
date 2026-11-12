// T-136 tiêu chí 1: match có id không thuộc pool hiện hành không bao giờ vào prompt (mọi dạng chỗ đặt id, kể cả không có id).
// Chạy: node eval/T-136/check_a1_loc_theo_pool.mjs   (TOHONG_BACK_REPO trỏ worktree back; mặc định ../tohong-back)
import { chat, item, poolPhotographers, POOL, done } from "./_lib.mjs";
const fails = [];
const ok = poolPhotographers[0];
const ids = new Set(POOL.map((v) => v.id));
const gone = "marry_deadbeef0001"; // dạng hiện hành nhưng không có trong pool
const legacy = "marry_photography_studio-da-go"; // dạng slug trước đợt đổi id 2026-07-15
if (ids.has(gone) || ids.has(legacy)) fails.push("id thử trùng id pool");
const p = await chat({
  matches: [
    item(gone, "ZZ_DA_GO_1"),
    item(legacy, "ZZ_DA_GO_2"),
    { vendor: { id: "marry_deadbeef0002", name: "ZZ_DA_GO_3", price_range: { min_vnd: 5e6, max_vnd: 6e6 } } },
    { id: "marry_deadbeef0003", name: "ZZ_DA_GO_4" },
    item(ok.id, "ten cu cua matcher"),
  ],
  total_pool: 5, passed_filters: 5,
});
// prompt chỉ liệt kê tối đa 5 ứng viên nên các ca còn lại chạy ở lượt riêng
const p2 = await chat({
  matches: [
    { name: "ZZ_KHONG_ID_5", price_range: { min_vnd: 5e6, max_vnd: 6e6 } },
    { vendor_id: "", name: "ZZ_ID_RONG_6" },
    { vendor_id: ok.id.toUpperCase(), name: "ZZ_ID_SAI_HOA_7" }, // id khác chữ hoa không phải id pool
    { vendor_id: 12345, name: "ZZ_ID_SO_8" },
    item(ok.id, "ten cu cua matcher"),
  ],
  total_pool: 5, passed_filters: 5,
});
const sp = p.systemPrompt;
for (let i = 1; i <= 4; i++) if (new RegExp(`ZZ_[A-Z_]*${i}`).test(sp)) fails.push(`vendor ngoài pool #${i} lọt vào prompt`);
for (let i = 5; i <= 8; i++) if (new RegExp(`ZZ_[A-Z_]*${i}`).test(p2.systemPrompt)) fails.push(`vendor không id hợp lệ #${i} lọt vào prompt`);
if (!p2.systemPrompt.includes(ok.name)) fails.push("vendor còn trong pool biến mất (lượt 2)");
if (!sp.includes(ok.name)) fails.push("vendor còn trong pool biến mất khỏi prompt");
const q = await chat({ matches: [item(gone, "ZZ_DA_GO_1"), item(legacy, "ZZ_DA_GO_2")], total_pool: 2, passed_filters: 2 });
if (/ZZ_DA_GO/.test(q.systemPrompt)) fails.push("tất cả match ngoài pool nhưng vẫn lọt prompt");
if (!q.systemPrompt.includes("Không có vendor phù hợp")) fails.push("không còn match hợp lệ thì prompt phải là khối 'Không có vendor phù hợp'");
done(fails);
