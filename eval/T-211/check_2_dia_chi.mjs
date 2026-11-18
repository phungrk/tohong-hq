#!/usr/bin/env node
// T-211 tiêu chí 2 (repo tohong-back): địa chỉ vendor admin nhập (override.address) được kiểm hợp lệ và chuẩn hoá; 5..250 ký tự (đếm theo code point).
// Chạy từ gốc tohong-hq: node eval/T-211/check_2_dia_chi.mjs
import { setup, reporter, outbound, addrOf } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, bucket } = S;
const OK = [
  ["12 Nguyễn Huệ, Quận 1, TP.HCM", "12 Nguyễn Huệ, Quận 1, TP.HCM"],
  ["  12 Nguyễn Huệ,   Quận 1  ", "12 Nguyễn Huệ, Quận 1"],
  ["12 Nguyễn Huệ, Quận 1", "12 Nguyễn".length ? "12 Nguyễn Huệ, Quận 1".replace("Nguyễn", "Nguyễn") : ""],
  ["12 Nguyễn Huệ\nQuận 1\r\nTP.HCM", "12 Nguyễn Huệ Quận 1 TP.HCM"],
  ["12 Nguyễn Huệ\t\tQuận 1", "12 Nguyễn Huệ Quận 1"],
  ["12 Nguyễn Huệ", "12 Nguyễn Huệ"],
  ["‮12 Lê Lợi‬, Q.1", "12 Lê Lợi, Q.1"],
  ["12 Lê​ Lợi", "12 Lê Lợi"],
  ["Q1 HN", "Q1 HN"],
  ["12 <b>Lê</b> Lợi & Co", "12 <b>Lê</b> Lợi & Co"],
  ["1" + "😀".repeat(249), "1" + "😀".repeat(249)],
  ["a".repeat(250), "a".repeat(250)],
];
for (const [input, want] of OK) {
  const r = await put({ address: input });
  const got = addrOf(await detail());
  R.check(`hợp lệ ${JSON.stringify(input).slice(0, 44)} -> 200, lưu ${JSON.stringify(want).slice(0, 44)}`, r.status === 200 && got === want, [r.status, r.json?.error, got && got.slice(0, 40)]);
}
// NFD -> NFC: viết tách dấu rồi đối chiếu với dạng gộp
{
  const nfd = "12 Nguyễn Huệ, Quận 1".normalize("NFD");
  const r = await put({ address: nfd });
  R.check("chuẩn hoá NFC: nhập dạng tách dấu, lưu dạng gộp", r.status === 200 && addrOf(await detail()) === "12 Nguyễn Huệ, Quận 1".normalize("NFC") && nfd !== nfd.normalize("NFC"), [r.status, addrOf(await detail())]);
}
const BAD = ["Q1 H", "abc", "-----", "....... ,,,", "ㅤㅤㅤㅤㅤㅤ", "a".repeat(251), "1" + "😀".repeat(250), 12345, ["12 Lê Lợi"], { a: "12 Lê Lợi" }, true];
await put({ address: "12 Nguyễn Huệ, Quận 1" });
const s0 = S.snapshot(bucket), v0 = (await detail()).version;
for (const input of BAD) {
  const r = await put({ address: input });
  R.check(`không hợp lệ ${JSON.stringify(input).slice(0, 30)} -> 400 invalid_address`, r.status === 400 && r.json?.error === "invalid_address", [r.status, r.json?.error]);
}
const d0 = S.diff(s0, S.snapshot(bucket));
R.check("các lần bị từ chối không ghi gì, địa chỉ cũ còn nguyên", d0.added.length + d0.removed.length + d0.changed.length === 0 && (await detail()).version === v0 && addrOf(await detail()) === "12 Nguyễn Huệ, Quận 1", d0);
const lim = (await detail()).editable?.limits || {};
R.check("editable.limits công bố address_min = 5, address_max = 250", lim.address_min === 5 && lim.address_max === 250, lim);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
