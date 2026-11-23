// T-229 đối kháng 01 (adversary). Spec T-228 mục 2: chỉ 2xx mới ghi khoá; mọi kết cục khác không khoá, tin lỗi kế tiếp POST lại.
// Ca: Slack 201/299 (2xx -> khoá, tin 6 im), 300 (không 2xx -> không khoá, tin 6 POST lại), 200 thân lỗi (2xx -> khoá; ghi nhận),
// fetch ném đồng bộ (không khoá, SSE không đổi, tin 6 POST lại), Slack trả 2xx sau 9,5 s (trong timeout -> khoá) và sau 10,8 s (bị huỷ -> không khoá),
// khoá KV put ném sau POST 2xx (chat không hỏng; ghi nhận: tin 6 gửi trùng), hai tin xen kẽ khi Slack chậm 9 s (SSE < 3 s, mỗi tin <= 1 POST; trùng là spec mục 6 chấp nhận).
import path from "node:path"; import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url";
import { BACK, T0, SENT, WEBHOOK_ENV, newKv, check, done } from "../T-224/lib.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); let seq = 0;
function chat(o = {}) { seq++; const id = String(seq).padStart(4, "0");
  const sc = { back: BACK, now: o.now ?? T0, gemini: o.gemini ?? 500, slack: o.slack, env: WEBHOOK_ENV, kv: o.kv || "file", kvFile: o.kvFile, waitMs: o.waitMs,
    message: SENT.text, coupleId: `couple_20261201_c${id}`, userId: `user_u${id}` };
  return new Promise((ok, bad) => { const p = spawn(process.execPath, [path.join(HERE, "adv_chat_once.mjs")]); let so = "", se = "";
    p.stdout.on("data", (d) => (so += d)); p.stderr.on("data", (d) => (se += d));
    p.on("close", (c) => { if (c) return bad(new Error(se.split("\n").slice(-4).join(" | "))); const out = JSON.parse(so);
      out.slackPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("slack")); out.lock = out.kvOps.puts.filter((x) => !/err/.test(x.key)).length; ok(out); });
    p.stdin.end(JSON.stringify(sc)); }); }
const fails = []; const names = (o) => o.sse.map((e) => e.event).filter((e) => !["intent", "conversation"].includes(e)).join(",");
// 4 tin lỗi chưa đạt ngưỡng, rồi tin 5 với Slack = s, rồi tin 6 với Slack 200. Trả [tin5, tin6].
async function scenario(s, extra = {}) { const kvFile = newKv(); for (let i = 1; i <= 4; i++) await chat({ kvFile, now: T0 + i * 1000 });
  const a = await chat({ kvFile, now: T0 + 5000, slack: s, ...extra }); const b = await chat({ kvFile, now: T0 + 6000, slack: 200, kv: "file" }); return [a, b]; }
for (const [s, is2xx, extra] of [[201, true], [299, true], [300, false], ["ok-errbody", true], ["syncthrow", false], ["slow:9500", true, { waitMs: 12000 }], ["slow:10800", false, { waitMs: 13000 }]]) {
  const [a, b] = await scenario(s, extra);
  check(fails, a.status === 200 && names(a) === "error" && a.eventMs < 3000, `${s}: SSE tin 5 = error, < 3 s (${names(a)}, ${Math.round(a.eventMs)} ms)`);
  check(fails, a.slackPosts.length === 1 && a.lock === (is2xx ? 1 : 0) && a.kvOps.puts.every((x) => x.ttl > 0), `${s}: tin 5 POST 1 lần, ${is2xx ? "có" : "không"} khoá (posts=${a.slackPosts.length}, khoá=${a.lock}, aborts=${a.aborts})`);
  check(fails, b.slackPosts.length === (is2xx ? 0 : 1), `${s}: tin 6 ${is2xx ? "im lặng" : "POST lại"} (posts=${b.slackPosts.length})`);
}
{ const [a, b] = await scenario(200, { kv: "throwlock" });
  check(fails, a.status === 200 && names(a) === "error" && a.slackPosts.length === 1, `put khoá ném sau 2xx: chat không đổi, 1 POST (${names(a)})`);
  console.log(`  -- thông tin (hệ quả chấp nhận): put khoá ném sau 2xx -> tin 6 POST ${b.slackPosts.length} lần (gửi trùng)`); }
{ const kvFile = newKv(); for (let i = 1; i <= 4; i++) await chat({ kvFile, now: T0 + i * 1000 });
  const pr = await Promise.all([5, 6].map((i) => chat({ kvFile, now: T0 + i * 1000, slack: "slow:9000", waitMs: 12000 })));
  check(fails, pr.every((o) => o.status === 200 && names(o) === "error" && o.eventMs < 3000 && o.slackPosts.length <= 1 && o.kvOps.puts.length <= 2), `xen kẽ Slack chậm 9 s: SSE < 3 s, mỗi tin <= 1 POST, <= 2 put (${pr.map((o) => `${Math.round(o.eventMs)}ms/${o.slackPosts.length}/${o.kvOps.puts.length}`)})`);
  const c = await chat({ kvFile, now: T0 + 7000, slack: 200 });
  console.log(`  -- thông tin (spec mục 6 chấp nhận): xen kẽ -> tổng POST ${pr.reduce((n, o) => n + o.slackPosts.length, 0)}; tin 7 sau đó POST ${c.slackPosts.length}`);
  check(fails, c.slackPosts.length === 0, `sau khi một tin xen kẽ nhận 2xx: tin 7 im lặng (posts=${c.slackPosts.length})`); }
done(fails);
