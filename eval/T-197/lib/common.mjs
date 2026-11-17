// T-197: khung chung cho eval. Worker thật của tohong-back + R2 giả của chính repo; mạng bị chặn; không ghi gì vào repo.
// Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Không thấy -> in FAIL, thoát 2.
// "Nhà tiên tri" (oracle) của eval: Status HIỂN THỊ của một hàng, tính độc lập từ báo cáo nhúng + danh sách review đã gieo (không gọi code lọc của back).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Dò ngược tới thư mục có scripts/gate.py (không đếm cấp).
let HQ = HERE; while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "worker.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(2); }

export const outbound = [];
globalThis.fetch = async (input) => { const u = typeof input === "string" ? input : input?.url || String(input); outbound.push(u); throw new Error("eval T-197: mạng bị chặn (" + u + ")"); };
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
export const { default: worker } = await imp("worker.js");
export const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
export const { REVIEWS_KEY } = await imp("lib/vendorEnrichReviews.js");

// ---- dữ liệu thật của báo cáo nhúng ở back ----
const t = fs.readFileSync(path.join(BACK, "lib", "vendorEnrichReport.generated.js"), "utf8");
const m = t.match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/);
export const REPORT = JSON.parse(m[1]);
export const ROWS = REPORT.vendors;
export const GROUPS = ["full", "matched_no_photo", "addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar", "not_found", "temp_closed", "not_enriched"];
export const LABEL = { full: "Enrich 100%", matched_no_photo: "Khớp, chưa có ảnh Google", addr_diff_accepted: "Địa chỉ khác marry", unverified: "Có ảnh Google, chưa kiểm khớp",
  name_same_addr_diff: "Tên trùng, địa chỉ lệch", name_similar: "Tên hơi giống", not_found: "Không thấy trên Maps", temp_closed: "Tạm đóng cửa", not_enriched: "Chưa enrich" };
// 12 giá trị Status, theo thứ tự spec; key = giá trị tham số `status` của API.
export const STATUS = [...GROUPS.map((g) => [g, LABEL[g]]), ["pending_capu", "Chờ Capu"], ["pending_apply", "Chờ áp dụng"], ["override", "Đã duyệt tay"]];
export const CHIP = { all: () => true, full: (r) => r.group === "full", name_similar: (r) => r.group === "name_similar",
  addr_diff: (r) => r.group === "addr_diff_accepted" || r.group === "name_same_addr_diff", no_google_photo: (r) => !r.google || !r.google.photo_count };
export const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

// ---- môi trường + gọi API ----
export const ADMIN = "admin", CAPU = "user_capu", OTHER = "user_other";
export const makeEnv = (bucket, extra = {}) => ({ CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: `${ADMIN},${CAPU}`, CAPU_USER_IDS: CAPU, ...extra });
export async function call(env, method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request(`http://localhost${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text();
  await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, json, text, headers: res.headers };
}
export const as = (who) => (env, method, p, body) => call(env, method, p, { token: `dev:${who}`, body });

// ---- gieo review qua API thật (đúng đường Approve / Sửa thủ công) ----
// Hồ sơ "nhỏ": 3 'Chờ Capu' (admin) + 2 'Chờ áp dụng' (Capu) trên name_similar approvable; 1 hàng nhóm full 'Chờ Capu' (vừa thuộc nhóm vừa chờ); 1 hàng not_found 'Chờ áp dụng'.
// Hồ sơ "lớn": 51 'Chờ Capu' trên 51 hàng not_found đầu (để trang cuối còn đúng 1 hàng).
export function pickSeeds(profile) {
  const free = (g) => ROWS.filter((r) => r.group === g && !r.override);
  if (profile === "big3") return free("not_found").slice(0, 101).map((r) => ({ id: r.id, who: ADMIN, kind: "manual" }));
  if (profile === "big") return free("not_found").slice(0, 51).map((r) => ({ id: r.id, who: ADMIN, kind: "manual" }));
  const ns = ROWS.filter((r) => r.group === "name_similar" && r.approvable && !r.override);
  return [
    ...ns.slice(0, 3).map((r) => ({ id: r.id, who: ADMIN, kind: "approve" })),
    ...ns.slice(3, 5).map((r) => ({ id: r.id, who: CAPU, kind: "approve" })),
    { id: free("full")[0].id, who: ADMIN, kind: "manual" },
    { id: free("not_found")[0].id, who: CAPU, kind: "manual" },
  ];
}
export async function seed(env, seeds) {
  const state = new Map(); // id -> { byCapu }
  for (const s of seeds) {
    const body = s.kind === "approve" ? { decision: "approve" } : { decision: "manual", action: "remove", note: "eval T-197" };
    const r = await call(env, "PUT", `/api/admin/vendor-enrich/${s.id}/review`, { token: `dev:${s.who}`, body });
    if (r.status !== 200) throw new Error(`gieo review ${s.id} lỗi ${r.status} ${r.text.slice(0, 80)}`);
    state.set(s.id, { byCapu: s.who === CAPU });
  }
  return state;
}

// ---- nhà tiên tri ----
// Chữ cột Status của một hàng, đúng như người dùng thấy: nhóm | "Chờ Capu" | "Chờ áp dụng" | "<nhóm> Đã duyệt tay" (dấu cách đơn).
export function shown(r, st) {
  if (r.override) return `${LABEL[r.group]} Đã duyệt tay`;
  const p = st.get(r.id);
  if (p) return p.byCapu ? "Chờ áp dụng" : "Chờ Capu";
  return LABEL[r.group];
}
// Hàng có "mang" giá trị Status `key` không (một hàng override mang cả nhãn nhóm lẫn "Đã duyệt tay"; hàng có review chỉ mang nhãn chờ).
export function carries(r, st, key) {
  const p = r.override ? null : st.get(r.id);
  if (key === "override") return !!r.override;
  if (key === "pending_capu") return !!p && !p.byCapu;
  if (key === "pending_apply") return !!p && p.byCapu;
  return !p && r.group === key;
}
export const expected = (st, { chip = "all", status = "all", category = "", q = "" } = {}) =>
  ROWS.filter((r) => CHIP[chip](r) && (status === "all" || carries(r, st, status)) && (!category || r.category === category) && (!q || fold(r.name).includes(fold(q))));

export function reporter() {
  const fails = [];
  return {
    check(name, ok, extra) { console.log(`${ok ? "  ok " : "  XX "} ${name}${!ok && extra !== undefined ? "  :: " + String(JSON.stringify(extra) ?? extra).slice(0, 200) : ""}`); if (!ok) fails.push(name + (extra !== undefined ? " [" + String(JSON.stringify(extra) ?? extra).slice(0, 140) + "]" : "")); },
    done() {
      if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ""}`); process.exit(1); }
      console.log("PASS"); process.exit(0);
    },
  };
}
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hành vi chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
