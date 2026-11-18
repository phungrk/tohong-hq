#!/usr/bin/env node
// T-211 tiêu chí 10 (repo tohong-back): chỉ admin (ADMIN_USER_IDS) sửa/đọc địa chỉ + SĐT vendor; người khác 403 {"error":"forbidden"} và không ghi gì; Capu không có đặc quyền ở đây (mọi admin sửa được).
// Chạy từ gốc tohong-hq: node eval/T-211/check_10_quyen.mjs
import { setup, reporter, outbound, call, makeEnv, PUT, snapshot, diff, addrOf, MemoryBucket, resetOverlayCache } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { env, bucket, T, detail } = S;
const body = { expected_version: 0, address: "12 Nguyễn Huệ, Quận 1", contact: { phone: "0912345678" } };
const s0 = snapshot(bucket);
const who = { "không token": undefined, "token rác": "garbage", "user thường (couple_1)": "dev:couple_1" };
for (const [name, token] of Object.entries(who)) {
  const w = await call(env, "PUT", PUT(T.id), { token, body });
  const g = await call(env, "GET", `/api/admin/vendors/${T.id}`, { token });
  const dl = await call(env, "DELETE", PUT(T.id) + "?expected_version=0", { token });
  R.check(`${name}: PUT / GET / DELETE đều 403 forbidden`, [w, g, dl].every((x) => x.status === 403 && x.json?.error === "forbidden"), [w.status, g.status, dl.status]);
}
const empty = makeEnv(bucket, { ADMIN_USER_IDS: "" });
resetOverlayCache();
const e = await call(empty, "PUT", PUT(T.id), { token: "dev:admin", body });
R.check("ADMIN_USER_IDS rỗng: 403", e.status === 403, e.status);
const nodev = makeEnv(bucket, { DEV_AUTH_BYPASS: "" });
const n = await call(nodev, "PUT", PUT(T.id), { token: "dev:admin", body });
R.check("token dev: khi DEV_AUTH_BYPASS tắt: 403 hoặc 401, không ghi", n.status === 403 || n.status === 401, n.status);
const d = diff(s0, snapshot(bucket));
R.check("mọi lần bị từ chối không ghi gì vào R2 (không bản ghi, không Nhật ký)", d.added.length + d.removed.length + d.changed.length === 0, d);
// Capu chỉ trong CAPU_USER_IDS (không phải admin): 403; admin thường: 200
resetOverlayCache();
const capuOnly = await call(env, "PUT", PUT(T.id), { token: "dev:user_capu", body });
R.check("người chỉ có trong CAPU_USER_IDS (không phải admin): 403", capuOnly.status === 403, capuOnly.status);
const ok = await call(env, "PUT", PUT(T.id), { token: "dev:admin", body });
R.check("admin thường (không phải Capu): 200 và lưu được", ok.status === 200 && addrOf(await detail()) === body.address, [ok.status, ok.json?.error]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
