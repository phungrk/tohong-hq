// Nhập khung T-164 theo đường đi lên tới scripts/gate.py (ADR-070), để eval chạy được từ mọi thư mục.
import { existsSync as ex } from "fs"; import { fileURLToPath as f, pathToFileURL as u } from "url"; import p from "path";
let hq = p.dirname(f(import.meta.url)); while (!ex(p.join(hq, "scripts", "gate.py")) && p.dirname(hq) !== hq) hq = p.dirname(hq);
const T164 = await import(u(p.join(hq, "eval", "T-164", "_lib.mjs")).href);
export const { setNow, restoreNow, stampedBack, loadModules, imp } = T164; export const NOW = null;
