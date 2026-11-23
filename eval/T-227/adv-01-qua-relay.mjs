// T-227 đối kháng 01 (adversary): biến thể check_1 và check_4 khi mọi lời gọi LLM đi qua LLM_RELAY_URL (production luôn qua relay).
// Mong đợi: mỗi lần thử thất bại qua relay -> đúng 1 dòng llm_provider_error với http_status = mã relay chuyển (402/500/429/403) hoặc null (mạng);
// 5 tin lỗi 402 qua relay -> cảnh báo đúng ở tin thứ 5, text có provider, 5, 402; không lộ URL/bí mật relay, coupleId, nội dung.
import { chat, sig, leaks, newKv, check, done, T0, WEBHOOK_ENV, RELAY } from "./adv_lib.mjs";
const fails = [];
for (const g of [402, 500, 429, 403, "throw"]) {
  const o = await chat({ gemini: "ok", relay: g, env: RELAY, coupleId: "couple_20261201_relay1" }); o.coupleId = "couple_20261201_relay1";
  const pe = sig(o, "llm_provider_error"); const want = g === "throw" ? null : g;
  check(fails, o.llmCalls > 0 && pe.length === o.llmCalls, `1/${g}: ${o.llmCalls} lần gọi relay = ${pe.length} dòng llm_provider_error`);
  check(fails, pe.every((e) => e.http_status === want && e.provider === "gemini" && typeof e.category === "string" && e.category), `1/${g}: http_status=${want}, provider, category (${JSON.stringify(pe)})`);
  const r = sig(o, "chat_llm_result");
  check(fails, r.length === 1 && r[0].ok === false && r[0].attempts === o.llmCalls && r[0].http_status === want, `1/${g}: chat_llm_result ok=false, attempts, http_status (${JSON.stringify(r)})`);
  check(fails, leaks(o).length === 0, `1/${g}: không lộ (${leaks(o)})`);
}
{ const o = await chat({ gemini: "throw", relay: "ok", env: RELAY });
  check(fails, sig(o, "llm_provider_error").length === 0 && sig(o, "chat_llm_result")[0]?.ok === true, "1/ok qua relay: 0 dòng lỗi, ok=true"); }
{ const kv = newKv(); const res = []; let last;
  for (let i = 1; i <= 5; i++) { last = await chat({ kvFile: kv, now: T0 + i * 1000, gemini: "ok", relay: 402, env: { ...WEBHOOK_ENV, ...RELAY } }); res.push(last.slackPosts.length); }
  const t = (() => { try { return JSON.parse(last.slackPosts[0].body).text; } catch { return ""; } })();
  check(fails, res.slice(0, 4).every((n) => n === 0) && res[4] === 1, `4: 5 tin 402 qua relay: cảnh báo đúng ở tin thứ 5 (nhận ${res})`);
  check(fails, /gemini/i.test(t) && /\b5\b/.test(t) && /402/.test(t) && !/relay|bi-mat/i.test(t), `4: text có gemini, 5, 402, không lộ relay ("${t.slice(0, 140)}")`); }
done(fails);
