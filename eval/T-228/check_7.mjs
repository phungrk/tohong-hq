// TC7: bất biến vùng planner/back/chat inv-004..007 (không rò dữ liệu, kênh hỏng không đổi SSE, không tiêu hạn mức KV, kênh treo không chậm SSE) vẫn xanh trên bản code này.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BACK, check, done } from "./lib.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let HQ = HERE; while (!fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const dir = path.join(HQ, "eval", "invariants", "planner", "back", "chat");
const fails = [];
for (const f of fs.readdirSync(dir).filter((x) => /^inv-00[4-7]-.*\.mjs$/.test(x)).sort()) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: "utf8", env: { ...process.env, TOHONG_BACK_REPO: BACK }, timeout: 280_000 });
  check(fails, r.status === 0, `${f}: ${r.status === 0 ? "xanh" : "ĐỎ " + String(r.stdout).split("\n").filter((l) => /XX|FAIL/.test(l)).slice(0, 2).join(" | ")}`);
}
done(fails);
