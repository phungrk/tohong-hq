#!/usr/bin/env node
// Bất biến đề xuất (vùng planner/admin/vendor-enrich) · nguồn: T-197 (spec products/T-197-loc-status-bang-enrich.md, Hành vi 2 và "Bất biến đề xuất"); chờ Spec Gate (spec-critic) rồi Chief of Staff đặt số.
// Nằm ở eval/T-197/bat-bien-cho-merge/ cho tới khi PR T-197 merge (ADR-028). Bất biến chỉ thăng vào bể SAU khi PR T-197 merge, nên không có lối "chưa áp dụng": trên main script này ĐỎ.
// INV-??? · Bộ lọc Status của bảng enrich luôn KHỚP chữ cột Status: với mọi khoá status hợp lệ, hàng trả về là đúng các hàng mà chữ cột Status mang giá trị đó
//   (nhóm | "Chờ Capu" | "Chờ áp dụng" | nhãn nhóm + "Đã duyệt tay"), tính từ chính các trường của bản không lọc (group, override, review.by_capu);
//   9 nhóm + "Chờ Capu" + "Chờ áp dụng" chia toàn bộ danh sách (mỗi hàng đúng một ô). Ai đổi cách hiện cột Status (thêm trạng thái, đổi luật "chờ") mà không đổi bộ lọc thì bất biến đỏ.
// Tự chứa: worker thật + R2 giả của tohong-back, review gieo qua API; không ghi gì vào repo. Repo back: TOHONG_BACK_REPO hoặc ../tohong-back cạnh gốc HQ. Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), rồi dùng khung chung của việc nguồn ở eval/T-197/lib (không đếm cấp thư mục).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const { ROWS, STATUS, MemoryBucket, makeEnv, as, seed, pickSeeds, reporter, ADMIN } = await import(pathToFileURL(path.join(HQ, "eval", "T-197", "lib", "common.mjs")).href);
const R = reporter();
const admin = as(ADMIN);
const env = makeEnv(new MemoryBucket());
await seed(env, pickSeeds("small"));
const LIST = "/api/admin/vendor-enrich";
const page = async (qs) => { const out = []; let total = 0; for (let off = 0; ; off += 100) { const r = await admin(env, "GET", `${LIST}?${qs}${qs ? "&" : ""}limit=100&offset=${off}`); if (r.status !== 200) return { status: r.status, rows: out, total }; total = r.json.total; out.push(...r.json.rows); if (!r.json.rows.length || out.length >= total) break; } return { status: 200, rows: out, total }; };
const unfiltered = await page("");
const carried = (x, key) => (key === "override" ? !!x.override : key === "pending_capu" ? !x.override && !!x.review && x.review.by_capu !== true : key === "pending_apply" ? !x.override && !!x.review && x.review.by_capu === true : !(x.review && !x.override) && x.group === key);
let sum = 0;
for (const [key] of STATUS) {
  const want = unfiltered.rows.filter((x) => carried(x, key)).map((x) => x.id);
  const got = await page(`status=${key}`);
  R.check(`status=${key}: đúng các hàng mà chữ cột Status mang giá trị đó (${want.length})`, got.status === 200 && got.total === want.length && got.rows.map((x) => x.id).join() === want.join(), [got.status, got.total, want.length]);
  if (key !== "override") sum += want.length;
}
R.check("9 nhóm + Chờ Capu + Chờ áp dụng chia toàn bộ danh sách", sum === unfiltered.total && sum === ROWS.length, [sum, unfiltered.total]);
R.done();
