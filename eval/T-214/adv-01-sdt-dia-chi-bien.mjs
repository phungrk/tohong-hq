#!/usr/bin/env node
// T-214 adv-01 (adversary, tầng 3): input biên cho SĐT + địa chỉ vendor (spec T-211 mục 2, 3, 4, 6) mà check_1..12 chưa chạm.
// Chạy từ gốc tohong-hq: TOHONG_BACK_REPO=<repo back> node eval/T-214/adv-01-sdt-dia-chi-bien.mjs
// Nhóm: (A) SĐT dạng biên: +84/84/0084 dính liền, chữ số toàn-góc, chữ số Ả Rập-Ấn, ký tự ẩn đầu/cuối, tab giữa, U+3000,
//        tổng đài 9 chữ số, 40/41 ký tự (ký tự ẩn không tính), "+" giữa chuỗi, "(+84)"; (B) địa chỉ: 4/5/250/251 code point,
//        emoji tính 1, NFD → NFC làm ngắn lại, RLO bị bỏ, HTML giữ nguyên, U+0085, kiểu lạ; (C) một trường sai thì không trường nào được lưu;
//        (D) lưu y giá trị (viết khác khoảng trắng) = không ghi gì; (E) PUT song song cùng phiên bản: đúng một 200, một 409;
//        (F) lịch sử khi đổi SĐT + zalo cùng lúc và khi Bỏ ghi đè: không lộ zalo/website; (G) ADMIN_OPEN chỉ đúng "1".
import { setup, PUT, nowrite, phoneOf, addrOf } from "../T-211/lib/common.mjs";
import { call, makeEnv, MemoryBucket, resetOverlayCache, pickTarget, reporter, outbound, snapshot, diff, AUDIT_PREFIX } from "../T-203/lib/common.mjs";
const R = reporter();

// (A) SĐT
{
  const ok = [
    ["+84912345678", "0912345678"], ["84912345678", "0912345678"], ["0084912345678", "0912345678"],
    ["​0912345678﻿", "0912345678"], ["⁠‮0912 345 678‬", "0912345678"], ["0912345678\n", "0912345678"],
    ["0912　345　678", "0912345678"], ["190012345", "190012345"], ["1800 1234", "18001234"], ["+84 28 3822 2222", "02838222222"],
    ["0912" + " ".repeat(30) + "345678", "0912345678"], // đúng 40 ký tự
    ["0912345678" + "​".repeat(40), "0912345678"], // ký tự ẩn bỏ trước khi đếm
  ];
  const bad = [
    "０９１２３４５６７８", "٠٩١٢٣٤٥٦٧٨", "۰۹۱۲۳۴۵۶۷۸", "0912\t345678", "0912\n345678", "09123+45678", "++84912345678", "(+84) 912 345 678",
    "+0084912345678", "+84 0912 345 678", "1900 123", "0912" + " ".repeat(31) + "345678" /* 41 */, "0912345678 ext 12", "0912345678,", true, {}, 912345678,
  ];
  for (const [inp, want] of ok) {
    const s = await setup();
    const r = await s.put({ contact: { phone: inp } });
    const got = phoneOf(await s.detail());
    R.check(`SĐT hợp lệ ${JSON.stringify(inp)} → 200, lưu ${want}`, r.status === 200 && got === want, [r.status, r.json?.error, got]);
  }
  for (const inp of bad) {
    const s = await setup();
    const s0 = snapshot(s.bucket);
    const r = await s.put({ contact: { phone: inp } });
    R.check(`SĐT sai ${JSON.stringify(inp)} → 400 invalid_phone, không ghi`, r.status === 400 && r.json?.error === "invalid_phone" && nowrite(diff(s0, snapshot(s.bucket))), [r.status, r.json?.error]);
  }
}

// (B) địa chỉ
{
  const cp = (n, ch = "a") => "1" + ch.repeat(n - 1);
  const ok = [
    [cp(5), cp(5)], [cp(250), cp(250)], ["A" + "😀".repeat(249), "A" + "😀".repeat(249)], ["A😀😀😀😀", "A😀😀😀😀"],
    ["‮12 Lê Lợi", "12 Lê Lợi"], ["<b>12 Lê Lợi</b>", "<b>12 Lê Lợi</b>"], ["12\u0085Lê Lợi", "12 Lê Lợi"],
    ["12 Lễ Lợi", "12 Lễ Lợi"], [" ".repeat(5) + cp(250) + "\n\n", cp(250)],
  ];
  const bad = [cp(4), cp(251), "A" + "😀".repeat(250), "Aé 1" /* NFD 5 → NFC 4 */, "😀😀😀😀😀", "ㅤㅤㅤㅤㅤ", ".,;:-!", 12345, ["12 Lê Lợi"], { a: 1 }, true];
  for (const [inp, want] of ok) {
    const s = await setup();
    const r = await s.put({ address: inp });
    const got = addrOf(await s.detail());
    R.check(`địa chỉ hợp lệ ${JSON.stringify(inp).slice(0, 40)} → 200, lưu đúng`, r.status === 200 && got === want, [r.status, r.json?.error, got && got.slice(0, 40)]);
  }
  for (const inp of bad) {
    const s = await setup();
    const s0 = snapshot(s.bucket);
    const r = await s.put({ address: inp });
    R.check(`địa chỉ sai ${JSON.stringify(inp).slice(0, 40)} → 400 invalid_address, không ghi`, r.status === 400 && r.json?.error === "invalid_address" && nowrite(diff(s0, snapshot(s.bucket))), [r.status, r.json?.error]);
  }
  for (const inp of ["​​", "‮", " \t\n "]) {
    const s = await setup();
    await s.put({ address: "12 Lê Lợi", contact: { phone: "0912345678" } });
    const r = await s.put({ address: inp });
    const d = await s.detail();
    R.check(`địa chỉ ${JSON.stringify(inp)} = xoá địa chỉ, SĐT còn`, r.status === 200 && addrOf(d) === null && phoneOf(d) === "0912345678", [r.status, d.override]);
  }
}

// (C) một trường sai thì không lưu gì; cả hai sai thì 400 một trong hai mã
{
  for (const [body, codes] of [
    [{ address: "12 Lê Lợi", contact: { phone: "abc" } }, ["invalid_phone"]],
    [{ address: "ab", contact: { phone: "0912345678" } }, ["invalid_address"]],
    [{ address: "ab", contact: { phone: "abc" } }, ["invalid_phone", "invalid_address"]],
    [{ address: "12 Lê Lợi", contact: { phone: "0912345678" }, priceMin: -1 }, ["invalid_price"]],
  ]) {
    const s = await setup();
    const s0 = snapshot(s.bucket);
    const r = await s.put(body);
    R.check(`${JSON.stringify(body).slice(0, 70)} → 400 ${codes.join("|")}, không ghi gì`, r.status === 400 && codes.includes(r.json?.error) && nowrite(diff(s0, snapshot(s.bucket))), [r.status, r.json?.error]);
  }
}

// (D) lưu y giá trị viết khác = không ghi gì
{
  const s = await setup();
  await s.put({ address: "12 Lê Lợi, Quận 1", contact: { phone: "+84 912 345 678", zalo: "z1" } });
  for (const body of [
    { address: "  12  Lê Lợi,\nQuận 1 ", contact: { phone: "0912.345.678", zalo: "z1" } },
    { address: "12 Lê Lợi, Quận 1​", contact: { phone: "0084 912 345 678", zalo: " z1 " } },
  ]) {
    const v0 = await s.ver();
    const s0 = snapshot(s.bucket);
    const r = await s.put(body);
    R.check(`lưu lại cùng giá trị viết khác ${JSON.stringify(body).slice(0, 60)} → 200, không tăng version, không ghi`, r.status === 200 && (await s.ver()) === v0 && nowrite(diff(s0, snapshot(s.bucket))), [r.status, v0, await s.ver(), diff(s0, snapshot(s.bucket))]);
  }
}

// (E) hai PUT song song cùng expected_version trên cùng vendor
{
  const s = await setup();
  const v = await s.ver();
  const [a, b] = await Promise.all([
    s.A("PUT", PUT(s.T.id), { expected_version: v, contact: { phone: "0912345678" } }),
    s.A("PUT", PUT(s.T.id), { expected_version: v, address: "99 Trần Hưng Đạo" }),
  ]);
  const st = [a.status, b.status].sort().join();
  const d = await s.detail();
  const one = (phoneOf(d) === "0912345678") !== (addrOf(d) === "99 Trần Hưng Đạo");
  R.check("PUT song song cùng phiên bản: đúng một 200 + một 409 version_conflict, chỉ một bản thắng", st === "200,409" && one, [a.status, a.json?.error, b.status, b.json?.error, d.override]);
}

// (F) lịch sử: SĐT + zalo cùng đổi; Bỏ ghi đè; không lộ zalo/website
{
  const s = await setup();
  await s.put({ address: "12 Lê Lợi", contact: { phone: "0912345678", zalo: "ZALO_SENTINEL_1", website: "https://web-sentinel-1.vn" } });
  await s.put({ address: "12 Lê Lợi", contact: { phone: "0987654321", zalo: "ZALO_SENTINEL_2", website: "https://web-sentinel-1.vn" } });
  let d = await s.detail();
  const h0 = d.history?.[0]?.changes || {};
  R.check("đổi SĐT + zalo cùng lúc: changes.phone trước/sau + changes.contact {changed:true}, không có address", JSON.stringify(h0.phone) === JSON.stringify({ before: "0912345678", after: "0987654321" }) && JSON.stringify(h0.contact) === JSON.stringify({ changed: true }) && !("address" in h0), h0);
  const r = await s.del();
  d = await s.detail();
  const hc = d.history?.[0] || {};
  R.check("Bỏ ghi đè: mục clear có address/phone về null", r.status === 200 && hc.action === "clear" && hc.changes?.address?.after === null && hc.changes?.phone?.after === null && hc.changes?.phone?.before === "0987654321", hc);
  const ht = JSON.stringify(d.history);
  R.check("lịch sử không chứa giá trị zalo/website ở bất kỳ mục nào", !/ZALO_SENTINEL|web-sentinel/.test(ht), ht.slice(0, 300));
  const aud = await s.audit();
  R.check("Nhật ký: 2 dòng vendor.override + 1 vendor.override_clear", aud.filter((e) => e.action === "vendor.override").length === 2 && aud.filter((e) => e.action === "vendor.override_clear").length === 1, aud.map((e) => e.action));
}

// (G) ADMIN_OPEN: chỉ đúng "1" mở PUT địa chỉ/SĐT cho người không token
{
  for (const flag of [undefined, "", "0", "true", " 1", "1 "]) {
    resetOverlayCache();
    const bucket = new MemoryBucket();
    const env = makeEnv(bucket, flag === undefined ? {} : { ADMIN_OPEN: flag });
    const T = await pickTarget(env, "photography");
    const s0 = snapshot(bucket);
    const r = await call(env, "PUT", PUT(T.id), { body: { expected_version: 0, address: "12 Lê Lợi", contact: { phone: "0912345678" } } });
    R.check(`ADMIN_OPEN=${JSON.stringify(flag)} không token: PUT 403, không ghi`, r.status === 403 && nowrite(diff(s0, snapshot(bucket))), [r.status, r.text.slice(0, 40)]);
  }
  resetOverlayCache();
  const bucket = new MemoryBucket();
  const env = makeEnv(bucket, { ADMIN_OPEN: "1" });
  const T = await pickTarget(env, "photography");
  const r = await call(env, "PUT", PUT(T.id), { body: { expected_version: 0, address: "12 Lê Lợi", contact: { phone: "+84 912 345 678" } } });
  const aud = [...bucket.data.keys()].filter((k) => k.startsWith(AUDIT_PREFIX)).map((k) => JSON.parse(bucket.data.get(k)));
  R.check("ADMIN_OPEN=1 không token: PUT 200, SĐT chuẩn hoá, Nhật ký 1 dòng danh tính cố định", r.status === 200 && aud.length === 1 && aud[0].admin_id === "admin-khong-dang-nhap" && aud[0].after?.contact?.phone === "0912345678" && aud[0].after?.address === "12 Lê Lợi", [r.status, aud.map((e) => [e.action, e.admin_id])]);
}

R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
