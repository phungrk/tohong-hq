// T-227 đối kháng 03 (adversary): KV get/put ném lỗi, webhook 500/429, POSTHOG_KEY rỗng/khoảng trắng, đồng hồ đúng ranh giới khung, mid_stream, không rò coupleId.
import { chat, sig, leaks, newKv, check, done, T0, MIN, WEBHOOK_ENV, PH_KEY } from "./adv_lib.mjs";
const fails = []; const W = Math.floor(T0 / 900_000) * 900_000; // đầu khung chứa T0 (03:00)
// a) KV ném lỗi: SSE như không có KV.
{ const base = await chat({ gemini: 402 }); const o = await chat({ gemini: 402, kv: "throw", kvFile: newKv(), env: WEBHOOK_ENV });
  check(fails, o.status === 200 && !o.thrown && JSON.stringify(o.sse.map((e) => e.event)) === JSON.stringify(base.sse.map((e) => e.event)) && sig(o, "chat_llm_result").length === 1, "a KV ném lỗi: SSE giữ nguyên, vẫn 1 chat_llm_result"); }
// b) Webhook 500 rồi 429: chat không đổi; đếm vẫn tăng.
for (const s of [500, 429]) { const kv = newKv(); let o;
  for (let i = 1; i <= 5; i++) o = await chat({ kvFile: kv, now: T0 + i * 1000, gemini: 402, slack: s, env: WEBHOOK_ENV });
  check(fails, o.status === 200 && o.slackPosts.length === 1 && o.sse.some((e) => e.event === "error"), `b webhook ${s}: đã POST 1 lần ở tin thứ 5, SSE vẫn error`);
  const n6 = await chat({ kvFile: kv, now: T0 + 10_000, gemini: 402, slack: "ok", env: WEBHOOK_ENV });
  console.log(`  -- thông tin: sau webhook ${s}, tin lỗi thứ 6 gửi lại cảnh báo? ${n6.slackPosts.length} (khoá chống lặp đặt trước khi POST)`); }
// c) POSTHOG_KEY rỗng hoặc khoảng trắng: 0 request PostHog; có khoá + host có dấu / cuối: đúng host, ẩn danh.
for (const k of ["", "   "]) { const o = await chat({ gemini: 402, env: { POSTHOG_KEY: k } }); check(fails, o.phPosts.length === 0, `c POSTHOG_KEY=${JSON.stringify(k)}: 0 request PostHog`); }
{ const o = await chat({ gemini: 402, env: { POSTHOG_KEY: PH_KEY, POSTHOG_HOST: "https://eu.i.posthog.com/" } });
  const ok = o.phPosts.length >= 1 && o.phPosts.every((p) => p.url.startsWith("https://eu.i.posthog.com/") && !p.url.includes("//batch"));
  const b = o.phPosts.map((p) => p.body).join(""); check(fails, ok && b.includes("$process_person_profile") && !b.includes(o.coupleId ?? "couple_2026"), `c host có '/' cuối: đúng host, ẩn danh (${o.phPosts.map((p) => p.url)})`); }
// d) Ranh giới khung: 4 lỗi lúc 02:59:59.999 (khung 02:45) + 1 lỗi đúng 03:00:00.000 -> cảnh báo; 4 lỗi 02:44:59.999 + 1 lỗi 03:00:00.000 -> không.
{ const kv = newKv(); let n = []; for (let i = 0; i < 4; i++) n.push((await chat({ kvFile: kv, now: W - 1, gemini: 402, env: WEBHOOK_ENV })).slackPosts.length);
  n.push((await chat({ kvFile: kv, now: W, gemini: 402, env: WEBHOOK_ENV })).slackPosts.length);
  check(fails, n.join() === "0,0,0,0,1", `d 4 lỗi 02:59:59.999 + 1 lỗi 03:00:00: cảnh báo ở tin 5 (${n})`); }
{ const kv = newKv(); let n = 0; for (let i = 0; i < 4; i++) n += (await chat({ kvFile: kv, now: W - 15 * MIN - 1, gemini: 402, env: WEBHOOK_ENV })).slackPosts.length;
  n += (await chat({ kvFile: kv, now: W, gemini: 402, env: WEBHOOK_ENV })).slackPosts.length;
  check(fails, n === 0, `d 4 lỗi 02:44:59.999 + 1 lỗi 03:00:00: không cảnh báo (${n})`); }
// e) mid_stream: 200, có chữ rồi đứt -> 1 dòng llm_provider_error (http_status null), chat_llm_result ok=false; vẫn đếm là tin lỗi; cả qua relay.
for (const env of [{}, { LLM_RELAY_URL: "https://relay.test/api/proxy", RELAY_SECRET: "bi-mat-relay-gia-t227" }]) {
  const kv = newKv(); const n = [];
  let o; for (let i = 1; i <= 5; i++) { o = await chat({ kvFile: kv, now: T0 + i * 1000, gemini: "midstream", env: { ...WEBHOOK_ENV, ...env } }); n.push(o.slackPosts.length); }
  const pe = sig(o, "llm_provider_error"), r = sig(o, "chat_llm_result")[0], via = env.LLM_RELAY_URL ? "relay" : "trực tiếp";
  check(fails, o.sse.some((e) => e.event === "chunk") && o.sse.some((e) => e.event === "error"), `e mid_stream ${via}: SSE có chunk rồi error`);
  check(fails, o.llmCalls === 1 && pe.length === 1 && pe[0].http_status === null && pe[0].category, `e mid_stream ${via}: 1 gọi, 1 dòng lỗi (${JSON.stringify(pe)})`);
  check(fails, r && r.ok === false && r.attempts === 1 && r.error_category, `e mid_stream ${via}: chat_llm_result ok=false (${JSON.stringify(r)})`);
  check(fails, n.join() === "0,0,0,0,1", `e mid_stream ${via}: tin lỗi sau nội dung vẫn đếm, cảnh báo ở tin 5 (${n})`); }
for (const g of [402, 500, 429, "throw"]) { const o = await chat({ gemini: g }); const r = sig(o, "chat_llm_result")[0];
  check(fails, r && r.ok === false && typeof r.error_category === "string" && r.error_category && r.attempts >= 1, `e ${g}: error_category không rỗng (${JSON.stringify(r)})`); }
// f) Không rò coupleId/userId/nội dung ở cả log, PostHog, Slack, kể cả khi coupleId xuất hiện trong thân lỗi provider.
{ const kv = newKv(); let o; const cid = "couple_20261201_sentn1";
  for (let i = 1; i <= 5; i++) { o = await chat({ kvFile: kv, now: T0 + i * 1000, gemini: 402, coupleId: cid, userId: "user_sentinel_ab12", message: `${cid} user_sentinel_ab12 SENTINEL-NOIDUNG`, env: { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY } }); o.coupleId = cid;
    const l = leaks(o).concat(JSON.stringify(o.logs).includes("user_sentinel_ab12") ? ["userId"] : []); if (l.length) { check(fails, false, `f tin ${i}: lộ ${l}`); break; } }
  check(fails, o.slackPosts.length === 1, "f cảnh báo vẫn gửi, không lộ"); }
done(fails);
