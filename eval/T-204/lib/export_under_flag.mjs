// In ra JSON {export, pub}: export ký của back khi cờ "1", kho gồm bản ghi cũ (Approve) + mới (link, gỡ) của danh tính cố định. Dùng cho check_5 (chạy apply_admin_reviews.py thật).
import { mkEnv, MemoryBucket, seedReviews, stored, pickIds, review, exportOf, FIXED, PUB } from "./common.mjs";
const [fo, fl, fr] = pickIds(3);
const bucket = new MemoryBucket();
seedReviews(bucket, { [fo]: stored(fo, FIXED, false) });
const env = mkEnv(bucket, "1");
const w1 = await review(env, fl, { decision: "manual", action: "accept_place", maps_link: "https://share.google/T204abc", note: "Có trên Maps" });
const w2 = await review(env, fr, { decision: "manual", action: "remove", note: "Không có trên Maps" });
const ex = await exportOf(env);
console.log(JSON.stringify({ ids: { old: fo, link: fl, remove: fr }, puts: [w1.status, w2.status], status: ex.status, export: ex.text, pub: PUB }));
process.exit(0);
