#!/usr/bin/env node
// T-212 tiêu chí 3: hàng "Đã duyệt tay" mà group vẫn là name_similar (override ghi nhận nhưng áp dụng lỗi, vd place_closed_permanently)
// hiện nhãn "Tên hơi giống" + "Đã duyệt tay" (UI EnrichTable) nên PHẢI xuất hiện ở CẢ status=name_similar VÀ status=override.
// Trên dữ liệu 9c341703: marry_71ab04906a99 và marry_ed3c040233be. Hiện GREEN (hành vi đúng); chặn ai "sửa" API cho khớp test cũ.
// Chạy: node eval/T-212/check_3_*.mjs  (tự sinh lại dữ liệu vào bản sao tạm)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url"; import { execFileSync } from "node:child_process";
const H = path.dirname(fileURLToPath(import.meta.url));
let S; try { S = execFileSync("bash", [path.join(H, "lib", "regen.sh")], { encoding: "utf8" }).match(/^SCRATCH=(.*)$/m)[1]; } catch (e) { console.log((e.stdout || String(e)).trim()); process.exit(2); }
let HQ = H; while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
process.env.TOHONG_BACK_REPO = S;
const { ROWS, MemoryBucket, makeEnv, as, ADMIN } = await import(pathToFileURL(path.join(HQ, "eval", "T-197", "lib", "common.mjs")).href);
const admin = as(ADMIN), env = makeEnv(new MemoryBucket());
const ids = async (qs) => { const out = []; for (let off = 0; ; off += 100) { const r = await admin(env, "GET", `/api/admin/vendor-enrich?${qs}&limit=100&offset=${off}`); if (r.status !== 200) return null; out.push(...r.json.rows.map((x) => x.id)); if (out.length >= r.json.total || !r.json.rows.length) return out; } };
const odd = ROWS.filter((r) => r.override && r.group === "name_similar").map((r) => r.id);
const fails = [];
if (!odd.length) fails.push("dữ liệu không có hàng override nằm nhóm name_similar (không tái hiện được)");
const sim = await ids("status=name_similar"), ov = await ids("status=override");
for (const id of odd) { if (!sim?.includes(id)) fails.push(`${id} thiếu ở status=name_similar`); if (!ov?.includes(id)) fails.push(`${id} thiếu ở status=override`); }
const want = ROWS.filter((r) => r.group === "name_similar").length;
if (sim?.length !== want) fails.push(`status=name_similar trả ${sim?.length}, chữ cột Status cho ${want}`);
console.log(fails.length ? "FAIL " + fails.join("; ") : "PASS"); process.exit(fails.length ? 1 : 0);
