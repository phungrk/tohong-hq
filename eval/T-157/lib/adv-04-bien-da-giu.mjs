// T-157 adv-04 · biên đã giữ (đối kháng, xanh trên PR back#56): spec T-152 4.2, 4.5, 4.9.
// Ảnh 0/5, ảnh Google của vendor khác / đổi hậu tố, http, userinfo, port lạ, đuôi giả, IDN; gu sai chính tả / trùng / "__proto__";
// sức chứa âm, số thực, min>max, chuỗi, >5000, vendor không phải venue; khoá "__proto__"/"constructor";
// trường hợp lệ đi cùng giá sai -> không ghi gì; hai PUT ĐỒNG THỜI (Promise.all) cùng vendor cùng expected_version -> một 200 một 409;
// hai vendor khác nhau đồng thời -> cả hai còn; DELETE rồi PUT lại từ version 0; liên hệ không lộ sau >20 lần sửa.
import { boot, pick, pool, A1, A2 } from "../../T-152/lib/back152.mjs";
import { reporter as rep0 } from "../../T-152/lib/back152.mjs";
const reporter = () => { const r = rep0(); const all = []; return { check(n, ok, x) { if (!ok) all.push(n + (x !== undefined ? " [" + String(JSON.stringify(x)).slice(0, 160) + "]" : "")); r.check(n, ok, x); }, done() { for (const l of all) console.error("  - " + l); r.done(); } }; };
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { bucket, put, del, info, pub } = await boot();
const P = pool();
const { venue, googleV, photog } = pick(P);
const ver = async (id) => (await info(id)).json?.version ?? 0;
const bad = async (lbl, id, body, code) => {
  const w0 = bucket.putLog.length;
  const r = await put(id, { expected_version: await ver(id), ...body }, A1);
  R.check(`${lbl} -> 400 ${code}, không ghi`, r.status === 400 && r.json?.error === code && bucket.putLog.length === w0, [r.status, r.text.slice(0, 80)]);
};
const gp = googleV.photos.find((p) => p.source === "google");
await bad("0 ảnh", photog.id, { photos: [] }, "invalid_photos");
await bad("5 ảnh", photog.id, { photos: [1, 2, 3, 4, 5].map((i) => ({ url: `https://www.marry.vn/images/${i}.jpg` })) }, "invalid_photos");
await bad("ảnh Google của vendor khác", photog.id, { photos: [gp] }, "invalid_photos");
await bad("ảnh Google của chính vendor nhưng đổi hậu tố kích thước", googleV.id, { photos: [{ ...gp, url: gp.url.replace(/=[^=]*$/, "=s100") }] }, "invalid_photos");
await bad("ảnh Google gửi như ảnh marry", googleV.id, { photos: [{ url: gp.url }] }, "invalid_photos");
await bad("ảnh Google với attribution khác", googleV.id, { photos: [{ ...gp, attribution: gp.attribution + " x" }] }, "invalid_photos");
for (const u of ["http://www.marry.vn/a.jpg", "https://x@www.marry.vn/a.jpg", "https://www.marry.vn:8443/a.jpg", "https://www.marry.vn.evil.com/a.jpg", "https://www.marry.vn./a.jpg", "https://www.xn--mrry-loa.vn/a.jpg", "javascript:alert(1)//www.marry.vn", "//www.marry.vn/a.jpg", "https://www.marry.vn/" + "a".repeat(500)])
  await bad(`url ${JSON.stringify(u).slice(0, 50)}`, photog.id, { photos: [{ url: u }] }, "invalid_photos");
await bad("ảnh marry có attribution", photog.id, { photos: [{ url: "https://www.marry.vn/images/x.jpg", attribution: "ai đó" }] }, "invalid_photos");
for (const s of [["Korean"], ["korean", "korean"], [" korean"], ["__proto__"], ["lux"], ["korean", "luxury", "rustic", "natural", "modern", "soft"]])
  await bad(`gu ${JSON.stringify(s)}`, photog.id, { styles: s }, "invalid_styles");
for (const c of [{ min: -1, max: 10 }, { min: 0, max: 10 }, { min: 1.5, max: 10 }, { min: 10, max: 5 }, { min: "10", max: "20" }, { min: 1, max: 5001 }, { min: 10 }, [1, 2]])
  await bad(`sức chứa ${JSON.stringify(c)}`, venue.id, { capacity: c }, "invalid_capacity");
await bad("sức chứa ở vendor không phải venue", photog.id, { capacity: { min: 1, max: 10 } }, "invalid_capacity");
await bad("khoá __proto__", venue.id, JSON.parse('{"__proto__": {"name": "x"}}'), "field_not_editable");
await bad("khoá constructor", venue.id, { constructor: 1 }, "field_not_editable");
await bad("khoá tags", venue.id, { tags: ["korean"] }, "field_not_editable");
await bad("tên hợp lệ + giá âm", venue.id, { name: "Tên mới adv04", priceMin: -5 }, "invalid_price");
R.check("sau lỗi, tên hiệu lực vẫn là tên pool", (await pub(`/api/vendors/${venue.id}`)).json?.vendor?.name === venue.name);
// đồng thời, cùng vendor
const v0 = await ver(photog.id);
const [a, b] = await Promise.all([put(photog.id, { expected_version: v0, name: "AAA adv04" }, A1), put(photog.id, { expected_version: v0, name: "BBB adv04" }, A2)]);
const nm = (await pub(`/api/vendors/${photog.id}`)).json?.vendor?.name;
R.check("hai PUT đồng thời cùng vendor cùng version: đúng một 200, một 409 version_conflict", [a.status, b.status].sort().join() === "200,409", [a.status, b.status]);
R.check("giá trị còn lại là của bản 200", nm === (a.status === 200 ? "AAA adv04" : "BBB adv04"), nm);
// đồng thời, hai vendor
const [c1, c2] = await Promise.all([put(venue.id, { expected_version: await ver(venue.id), name: "Venue adv04" }, A1), put(googleV.id, { expected_version: await ver(googleV.id), name: "Google adv04" }, A2)]);
R.check("hai PUT đồng thời hai vendor: cả hai 200 và cả hai còn", c1.status === 200 && c2.status === 200 && (await pub(`/api/vendors/${venue.id}`)).json?.vendor?.name === "Venue adv04" && (await pub(`/api/vendors/${googleV.id}`)).json?.vendor?.name === "Google adv04", [c1.status, c2.status]);
// DELETE rồi PUT lại
const d = await del(photog.id, { expected_version: await ver(photog.id) }, A1);
const p2 = await put(photog.id, { expected_version: 0, name: "Sau xoá adv04" }, A1);
const ip = (await info(photog.id)).json || {};
R.check("DELETE rồi PUT lại từ version 0: 200, lịch sử giữ mục clear", d.status === 200 && p2.status === 200 && ip.history?.[0]?.action === "edit" && ip.history?.[1]?.action === "clear", [d.status, p2.status, (ip.history || []).map((h) => h.action).join()]);
// liên hệ không lộ sau >20 lần sửa
await put(venue.id, { expected_version: await ver(venue.id), contact: { phone: "0912345678", zalo: "0987654321" } }, A1);
for (let k = 0; k < 22; k++) await put(venue.id, { expected_version: await ver(venue.id), description: `mô tả adv04 ${k}`, ...(k === 10 ? { contact: { phone: "0911111111" } } : {}) }, A1);
const iv = (await info(venue.id)).json || {};
const hs = JSON.stringify(iv.history || []);
R.check("lịch sử 20 mục, không có số liên hệ nào", (iv.history || []).length === 20 && !/0912345678|0987654321|0911111111/.test(hs), [(iv.history || []).length]);
R.done();
