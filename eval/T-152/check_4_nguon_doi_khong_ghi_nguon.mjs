#!/usr/bin/env node
// T-152 tiêu chí 4 (tohong-back): xung đột khi nguồn (pool) đổi + không ghi ngược nguồn. Đo qua API/hành vi; dựng trạng thái chỉ bằng route PUT; "pool sinh lại" = bản sao repo back có pool đã đổi, dùng chung R2 giả.
// 1) Trường chữ (name, styles): pool đổi sang P2 -> BẢN ADMIN THẮNG; GET /api/admin/vendors/<id> trả source_changed = [{field, base: P1, now: P2}] cho đúng trường đã sửa mà pool đã đổi (description không đổi thì không có); bỏ sửa (null) xoá cờ, hiệu lực = P2; sửa lại thì cờ biến mất.
// 2) Ảnh Google (lọc khi áp): định danh ảnh Google = (url bỏ hậu tố kích thước "=s…-w…" ở cuối) + attribution; pool chỉ lộ ba trường url/source/attribution nên không có định danh bền hơn.
//    Khi áp overlay, ảnh Google trong bản sửa chỉ được giữ nếu vẫn có ảnh Google cùng định danh trong pool HIỆN HÀNH của chính vendor; ảnh marry giữ nguyên; lọc xong còn 0 ảnh thì dùng ảnh pool hiện hành.
//    (a) pool làm mới photoUri (đổi phần token) -> ảnh Google cũ bị bỏ khỏi tab Vendor, ảnh marry của admin còn; (b) pool chỉ đổi hậu tố kích thước -> ảnh Google vẫn giữ; (c) pool gỡ ảnh Google và bản sửa chỉ có ảnh Google -> hiện ảnh pool hiện hành;
//    source_changed có {field:"photos", base:[url Google trong bản sửa], now:[url Google hiện có trong pool], dropped:[url bị bỏ]} khi có ảnh bị bỏ; GET .effective.photos là danh sách đã lọc (drawer điền sẵn từ đây) và PUT lại đúng danh sách đó -> 200 (không 400 khó hiểu).
// 3) Không ghi ngược nguồn: mọi lần ghi R2 dưới data/admin/; repo back thật không đổi byte.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { boot, pick, pool, load, BACK, A1, env, tok, copyWithPool, reporter, outbound } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const hashDir = (d) => { const h = crypto.createHash("sha256"); const walk = (p) => { for (const n of fs.readdirSync(p).sort()) { if (n === "node_modules" || n === ".git") continue; const f = path.join(p, n); const s = fs.statSync(f); if (s.isDirectory()) walk(f); else h.update(n).update(fs.readFileSync(f)); } }; walk(d); return h.digest("hex"); };
const h0 = hashDir(BACK);
const { bucket, put, info, pub } = await boot();
const { venue } = pick();
const gv = pool().filter((v) => v.photos?.some((p) => p.source === "google" && p.attribution && /=[A-Za-z0-9-]+$/.test(p.url)));
const [G1, G2, G3] = gv;
const gOf = (v) => v.photos.find((p) => p.source === "google");
const MARRY = "https://www.marry.vn/images/detailed/9/admin-them.jpg";
const tmps = [];
const swap = (mut) => { const d = copyWithPool(mut); tmps.push(d); return load(d); };
const asA = (Bx, ev, m, p, body) => Bx.call(ev, m, p, { token: tok(A1), body });
const ev2 = env(bucket);

/* ---- 1. trường chữ ---- */
const r1 = await put(venue.id, { expected_version: 0, name: "Tên admin ZZ", description: "Mô tả admin ZZ", styles: ["soft"] });
R.check("sửa name, description, styles lúc pool = P1: 200", r1.status === 200, [r1.status, r1.text.slice(0, 100)]);
const s0 = (await info(venue.id)).json?.source_changed;
R.check("lúc pool chưa đổi: source_changed là mảng rỗng", Array.isArray(s0) && s0.length === 0, s0);
const P2name = venue.name + " (đổi tên nguồn)";
const B2 = await swap((arr) => { const x = arr.find((v) => v.id === venue.id); x.name = P2name; x.styles = ["modern"]; x.tags = ["modern"]; });
const gi = async (Bx) => (await asA(Bx, ev2, "GET", `/api/admin/vendors/${venue.id}`)).json || {};
let i2 = await gi(B2);
const by = Object.fromEntries((i2.source_changed || []).map((x) => [x.field, x]));
R.check("pool đổi: source_changed có name (P1 -> P2) và styles, KHÔNG có description", by.name?.base === venue.name && by.name?.now === P2name && JSON.stringify(by.styles?.base) === JSON.stringify(venue.styles) && JSON.stringify(by.styles?.now) === '["modern"]' && !by.description && (i2.source_changed || []).length === 2, JSON.stringify(i2.source_changed));
const vv = (await B2.call(ev2, "GET", `/api/vendors/${venue.id}`, { token: tok("user_khach") })).json?.vendor || {};
R.check("bản admin thắng: tab Vendor vẫn hiện tên/mô tả/gu của admin", vv.name === "Tên admin ZZ" && vv.description === "Mô tả admin ZZ" && JSON.stringify(vv.styles) === '["soft"]', JSON.stringify(vv).slice(0, 160));
const rr = await asA(B2, ev2, "PUT", `/api/admin/vendors/${venue.id}/override`, { expected_version: i2.version, name: null });
i2 = await gi(B2);
R.check("bỏ sửa name: hiệu lực = P2, cờ name biến mất, cờ styles còn", rr.status === 200 && (await B2.call(ev2, "GET", `/api/vendors/${venue.id}`, { token: tok("user_khach") })).json?.vendor?.name === P2name && !(i2.source_changed || []).some((x) => x.field === "name") && (i2.source_changed || []).some((x) => x.field === "styles"), JSON.stringify(i2.source_changed));
const rs = await asA(B2, ev2, "PUT", `/api/admin/vendors/${venue.id}/override`, { expected_version: i2.version, styles: ["rustic"] });
i2 = await gi(B2);
R.check("sửa lại styles sau khi pool đổi: cờ biến mất", rs.status === 200 && (i2.source_changed || []).length === 0, JSON.stringify(i2.source_changed));

/* ---- 2. ảnh Google ---- */
const g1 = gOf(G1), g2 = gOf(G2), g3 = gOf(G3);
const base = (u) => u.replace(/=[A-Za-z0-9-]+$/, "");
await put(G1.id, { expected_version: 0, photos: [{ url: g1.url, source: "google", attribution: g1.attribution }, { url: MARRY }] });
await put(G2.id, { expected_version: 0, photos: [{ url: g2.url, source: "google", attribution: g2.attribution }] });
await put(G3.id, { expected_version: 0, photos: [{ url: g3.url, source: "google", attribution: g3.attribution }, { url: MARRY }] });
const regen = await swap((arr) => {
  const a = arr.find((v) => v.id === G1.id); for (const p of a.photos) if (p.source === "google") p.url = base(p.url) + "XYZ-lam-moi=s4800-w800"; // (a) photoUri làm mới
  const c = arr.find((v) => v.id === G3.id); for (const p of c.photos) if (p.source === "google") p.url = base(p.url) + "=s2400-w600";       // (b) chỉ đổi hậu tố kích thước
  const b = arr.find((v) => v.id === G2.id); b.photos = [{ url: "https://www.marry.vn/images/detailed/9/pool-moi.jpg", source: "marry" }];       // (c) ảnh Google bị gỡ
});
const pubR = async (id) => (await regen.call(ev2, "GET", `/api/vendors/${id}`, { token: tok("user_khach") })).json?.vendor || {};
const infoR = async (id) => (await asA(regen, ev2, "GET", `/api/admin/vendors/${id}`)).json || {};
const ua = (await pubR(G1.id)).photos || [];
R.check("(a) photoUri làm mới: tab Vendor chỉ còn ảnh marry của admin, không còn URL Google cũ", ua.length === 1 && ua[0].url === MARRY && !ua.some((p) => p.url === g1.url), JSON.stringify(ua));
const ia = await infoR(G1.id);
const sp = (ia.source_changed || []).find((x) => x.field === "photos");
R.check("(a) source_changed có photos với dropped = [URL Google cũ]", !!sp && JSON.stringify(sp.dropped) === JSON.stringify([g1.url]) && Array.isArray(sp.base) && Array.isArray(sp.now), JSON.stringify(sp));
R.check("(a) effective.photos của API admin = danh sách đã lọc (drawer điền sẵn từ đây)", JSON.stringify((ia.effective?.photos || []).map((p) => p.url)) === JSON.stringify([MARRY]), JSON.stringify(ia.effective?.photos));
const pa = await asA(regen, ev2, "PUT", `/api/admin/vendors/${G1.id}/override`, { expected_version: ia.version, photos: (ia.effective?.photos || []).map(({ url, source, attribution }) => (attribution ? { url, source, attribution } : { url })), description: "sửa tiếp ZZ" });
R.check("(a) lưu lại đúng danh sách đã điền sẵn (kèm sửa khác): 200, không 400 invalid_photos", pa.status === 200, [pa.status, pa.text.slice(0, 100)]);
const ub = (await pubR(G3.id)).photos || [];
R.check("(b) chỉ đổi hậu tố kích thước: ảnh Google vẫn giữ (URL hiện hành của pool) + ảnh marry của admin", ub.length === 2 && ub.some((p) => p.source === "google" && base(p.url) === base(g3.url) && p.attribution === g3.attribution) && ub.some((p) => p.url === MARRY), JSON.stringify(ub));
R.check("(b) không cờ photos khi không ảnh nào bị bỏ", !((await infoR(G3.id)).source_changed || []).some((x) => x.field === "photos"));
const uc = (await pubR(G2.id)).photos || [];
R.check("(c) ảnh Google bị gỡ khỏi pool và bản sửa chỉ có ảnh Google: hiện ảnh pool hiện hành, không còn 0 ảnh", uc.length === 1 && uc[0].url === "https://www.marry.vn/images/detailed/9/pool-moi.jpg", JSON.stringify(uc));
R.check("(c) source_changed có photos, dropped = [URL Google cũ]", ((await infoR(G2.id)).source_changed || []).some((x) => x.field === "photos" && x.dropped?.includes(g2.url)));
for (const [n, id] of [["(a)", G1.id], ["(b)", G3.id], ["(c)", G2.id]]) {
  const e = await pubR(id), o = pool().find((v) => v.id === id);
  R.check(`${n} mọi ảnh Google hiệu lực đều có ghi công`, (e.photos || []).filter((p) => p.source === "google" || /googleusercontent/.test(p.url)).every((p) => p.attribution && p.attribution.trim()), JSON.stringify(e.photos));
}

/* ---- 3. không ghi nguồn ---- */
R.check("mọi lần ghi R2 nằm dưới data/admin/", bucket.putLog.every((k) => k.startsWith("data/admin/")), [...new Set(bucket.putLog)]);
R.check("repo back thật không đổi byte nào sau toàn bộ thao tác sửa", hashDir(BACK) === h0);
R.check("không gọi mạng", outbound.length === 0, outbound);
for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
R.done();
