// T-227 đối kháng 02 (adversary): hai tin lỗi xử lý xen kẽ khi KV trả chậm (mỗi thao tác KV trễ 300 ms, hai tin chạy cùng lúc, tiến trình riêng).
// Spec T-224 mục "Không làm" chấp nhận đọc-sửa-ghi không nguyên tử: có thể mất đếm hoặc trùng cảnh báo trong ~60 giây. Eval này đo và chỉ
// FAIL ở những gì spec KHÔNG chấp nhận: SSE bị chậm (>= 3 s), chat đổi dãy sự kiện, quá 1 put bộ đếm + 1 put khoá mỗi tin, put không TTL, list/delete.
// Đồng thời in ra (không FAIL) số đếm mất và số cảnh báo trùng để Chief thấy độ lớn.
import fs from "node:fs";
import { chat, newKv, check, done, T0, WEBHOOK_ENV } from "./adv_lib.mjs";
const fails = []; const kv = newKv();
for (let i = 0; i < 3; i++) await chat({ kvFile: kv, now: T0 + i * 1000, gemini: 500, env: WEBHOOK_ENV });
const pair = await Promise.all([1, 2].map((j) => chat({ kvFile: kv, now: T0 + 10_000 + j, gemini: 500, env: WEBHOOK_ENV, kvDelayMs: 300, waitMs: 8000 })));
for (const [j, o] of pair.entries()) {
  check(fails, o.status === 200 && o.eventMs != null && o.eventMs < 3000 && o.closeMs < 3000, `tin xen kẽ ${j + 1}: SSE kết thúc < 3 s (${Math.round(o.eventMs)} ms)`);
  check(fails, o.sse.map((e) => e.event).filter((e) => !["intent", "conversation"].includes(e)).join(",") === "error", `tin xen kẽ ${j + 1}: dãy SSE chỉ có error (${o.sse.map((e) => e.event)})`);
  const puts = o.kvOps.puts; const cnt = puts.filter((p) => !/alert|lock/i.test(p.key)).length;
  check(fails, cnt <= 1 && puts.length <= 2 && puts.every((p) => p.ttl > 0) && !o.kvOps.lists && !o.kvOps.deletes, `tin xen kẽ ${j + 1}: <=1 put đếm, <=2 put, có TTL, 0 list/delete (${JSON.stringify(o.kvOps)})`);
}
const d = JSON.parse(fs.readFileSync(kv, "utf8")); const counter = Object.entries(d).find(([k]) => /err/.test(k))?.[1]?.v;
const alerts = pair.reduce((a, o) => a + o.slackPosts.length, 0);
console.log(`  -- thông tin (spec chấp nhận, không FAIL): 5 tin lỗi, bộ đếm KV = ${counter}, số cảnh báo = ${alerts}`);
done(fails);
