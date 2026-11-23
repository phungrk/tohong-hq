// TC3: có POSTHOG_KEY -> cùng tín hiệu tới PostHog (event tên giống, ẩn danh); không có khoá -> không gửi gì tới PostHog.
import { chat, phEvents, check, done, SENT, PH_KEY } from "./lib.mjs";
const fails = [];
const f = chat({ gemini: 402, env: { POSTHOG_KEY: PH_KEY } });
const ev = phEvents(f);
const pe = ev.filter((e) => e.event === "llm_provider_error"), re = ev.filter((e) => e.event === "chat_llm_result");
check(fails, pe.length === f.geminiCalls && pe.length >= 1, `có khoá: ${pe.length} sự kiện llm_provider_error cho ${f.geminiCalls} lần gọi lỗi`);
check(fails, re.length === 1 && re[0].properties?.ok === false, "có khoá: đúng 1 chat_llm_result ok=false");
check(fails, ev.every((e) => e.api_key === PH_KEY), "mọi sự kiện mang đúng khoá dự án đã cấu hình");
check(fails, pe.every((e) => e.properties?.provider === "gemini" && e.properties?.http_status === 402 && typeof e.properties?.category === "string"), "thuộc tính: provider, http_status, category");
check(fails, ev.every((e) => typeof e.distinct_id === "string" && e.distinct_id && ![SENT.userId, SENT.coupleId].some((s) => String(e.distinct_id).includes(s)) && e.properties?.$process_person_profile === false), "ẩn danh: distinct_id không phải user/couple id, $process_person_profile=false");
const g = chat({ gemini: "ok", env: { POSTHOG_KEY: PH_KEY } });
const eg = phEvents(g);
check(fails, eg.filter((e) => e.event === "chat_llm_result" && e.properties?.ok === true).length === 1 && eg.every((e) => e.event !== "llm_provider_error"), "thành công có khoá: 1 chat_llm_result ok=true, không có llm_provider_error");
const n = chat({ gemini: 402 });
check(fails, n.phPosts.length === 0, "không có POSTHOG_KEY: 0 request tới PostHog");
const h = chat({ gemini: 402, env: { POSTHOG_KEY: PH_KEY, POSTHOG_HOST: "https://eu.i.posthog.com" } });
check(fails, h.phPosts.length >= 1 && h.phPosts.every((p) => new URL(p.url).hostname === "eu.i.posthog.com"), "POSTHOG_HOST đặt thì gửi tới đúng host đó");
done(fails);
