#!/usr/bin/env node
// T-156 tiêu chí 2 (tohong-back): API công khai mà app cặp đôi gọi luôn trả đủ dữ liệu để ghi công, kể cả sau khi admin sửa ảnh (overlay R2, T-157) và sau khi pool sinh lại.
//  - GET /api/vendors/<id> cho MỌI vendor thật có ảnh Google trong pool: mỗi ảnh Google trả về có `attribution` (chuỗi, sau trim không rỗng) bằng đúng tác giả của ảnh đó trong pool.
//  - GET /api/vendors/match theo từng hạng mục (pool thật): mọi ảnh Google trong kết quả có attribution không rỗng.
//  - Bản admin sửa ảnh: ảnh Google chỉ được lưu khi y hệt ảnh trong pool (url + source + attribution); thiếu attribution, đổi tác giả, URL Google lạ, hay ảnh marry mang attribution => 400 invalid_photos;
//    ảnh Google lưu được thì API trả ra vẫn kèm attribution của pool; ảnh marry của admin không có attribution.
//  - Pool sinh lại đổi tên tác giả của một ảnh Google (cùng URL): API KHÔNG bao giờ trả tên tác giả cũ (ảnh bị bỏ hoặc mang tên mới; không có ảnh Google nào trả ra thiếu hay lệch tác giả so với pool hiện hành).
import { boot, pick, pool, load, env, tok, A1, copyWithPool, reporter } from "../T-152/lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { bucket, put, pub } = await boot();
const P = pool();
const isG = (p) => p && typeof p.source === "string" && p.source.trim().toLowerCase() === "google";
const okA = (p) => typeof p.attribution === "string" && p.attribution.trim() !== "";
const withG = P.filter((v) => v.photos?.some(isG));
R.check("pool thật có vendor có ảnh Google (eval có việc để đo)", withG.length > 0, withG.length);

/* 1. chi tiết cho mọi vendor có ảnh Google */
let n1 = 0, bad1 = null;
for (const v of withG) {
  const r = await pub(`/api/vendors/${v.id}`);
  const got = r.json?.vendor?.photos || [];
  for (const g of v.photos.filter(isG)) {
    n1++;
    const m = got.find((x) => x.url === g.url);
    if (!m || m.attribution !== g.attribution || !okA(m)) { bad1 = bad1 || `${v.id} ${String(g.url).slice(-24)} trả ${JSON.stringify(m && m.attribution)} (pool: ${JSON.stringify(g.attribution)})`; }
  }
}
R.check(`GET /api/vendors/<id>: ${n1} ảnh Google của ${withG.length} vendor đều trả đúng attribution của pool`, !bad1, bad1);

/* 2. danh sách ghép theo hạng mục */
let n2 = 0, bad2 = null;
for (const cat of [...new Set(withG.map((v) => v.category))]) {
  const r = await pub(`/api/vendors/match?category=${cat}&limit=50`);
  for (const v of r.json?.vendors || []) for (const p of v.photos || []) if (isG(p)) { n2++; if (!okA(p)) bad2 = bad2 || `${cat}/${v.id}`; }
}
R.check(`GET /api/vendors/match: ${n2} ảnh Google trong kết quả đều có attribution`, n2 > 0 && !bad2, bad2 || "không có ảnh Google nào trong kết quả (eval không đo được)");

if (process.env.T156_VERBOSE) console.log("n1", n1, "vendors", withG.length, "n2", n2);
/* 3. bản admin sửa ảnh */
const { googleV, photog } = pick();
const gp = googleV.photos.find(isG);
const MARRY = "https://www.marry.vn/images/detailed/9/zz156.jpg";
const rej = async (photos, why) => { const r = await put(googleV.id, { expected_version: 0, photos }); R.check(`sửa ảnh bị từ chối 400 invalid_photos: ${why}`, r.status === 400 && /invalid_photos/.test(r.text), [r.status, r.text.slice(0, 80)]); };
await rej([{ url: gp.url, source: "google" }], "ảnh Google thiếu attribution");
await rej([{ url: gp.url, source: "google", attribution: "Tác giả khác ZZ" }], "ảnh Google đổi tác giả");
await rej([{ url: "https://lh3.googleusercontent.com/t156/la-hoac", source: "google", attribution: "Ai Đó" }], "URL Google không có trong pool của vendor");
await rej([{ url: MARRY, source: "marry", attribution: "Ai Đó ZZ" }], "ảnh marry mang attribution");
await rej([{ url: gp.url, source: "google", attribution: "   " }], "ảnh Google có attribution chỉ khoảng trắng");
const ok = await put(googleV.id, { expected_version: 0, photos: [{ url: MARRY, source: "marry" }, { url: gp.url, source: gp.source, attribution: gp.attribution }] });
R.check("sửa ảnh hợp lệ (marry của admin + ảnh Google y hệt pool): 200", ok.status === 200, [ok.status, ok.text.slice(0, 100)]);
const eff = (await pub(`/api/vendors/${googleV.id}`)).json?.vendor?.photos || [];
R.check("sau khi sửa: ảnh Google vẫn trả kèm attribution của pool, ảnh marry của admin không có attribution", eff.some((p) => p.url === gp.url && p.attribution === gp.attribution) && eff.filter((p) => !isG(p)).every((p) => p.attribution === undefined || p.attribution === null), JSON.stringify(eff).slice(0, 220));

/* 4. pool sinh lại đổi tác giả */
const NEWA = "Tac Gia Moi ZZ156";
const d = copyWithPool((arr) => { const x = arr.find((v) => v.id === googleV.id); const g = x.photos.find((p) => p.source === "google"); g.attribution = NEWA; });
const B2 = await load(d);
const ev2 = env(bucket);
const eff2 = (await B2.call(ev2, "GET", `/api/vendors/${googleV.id}`, { token: tok("user_khach") })).json?.vendor?.photos || [];
const stale = eff2.filter(isG).filter((p) => p.attribution !== NEWA && p.url.replace(/=[A-Za-z0-9-]+$/, "") === gp.url.replace(/=[A-Za-z0-9-]+$/, ""));
R.check("pool sinh lại đổi tác giả: API không trả tên tác giả cũ cho ảnh đó", !eff2.some((p) => p.attribution === gp.attribution && gp.attribution !== NEWA) && stale.length === 0, JSON.stringify(eff2.filter(isG)).slice(0, 220));
R.check("pool sinh lại: mọi ảnh Google API trả ra đều có attribution", eff2.filter(isG).every(okA), JSON.stringify(eff2).slice(0, 200));
R.done();
