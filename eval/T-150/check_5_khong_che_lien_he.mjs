#!/usr/bin/env node
// T-150 tiêu chí 5 (repo tohong-back; ADR-083 mục 1): KHÔNG che số điện thoại, URL, zalo trong dữ liệu vendor; inv-007 giữ nguyên.
// Đo: (a) trong báo cáo nhúng, mô tả nguồn (pool_input.record.description) của một số vendor còn nguyên số điện thoại và URL (không bị thay bằng ký hiệu che) và marry.address của dòng báo cáo còn số điện thoại;
//     (b) GET detail của các vendor đó trả mô tả NGUYÊN VĂN y như báo cáo (không che, không đổi);
//     (c) bất biến inv-007 (báo cáo không mang KHOÁ liên hệ/địa chỉ trong pool_input) vẫn PASS và file của nó không đổi (sha256 ghim bên dưới);
//     (d) pool_input vẫn không có khoá phone/email/website/facebook/contact/address: che chữ không được đánh đổi bằng thêm khoá.
// Chạy: cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-150/check_5_khong_che_lien_he.mjs  (hoặc bash eval/T-150/check_5_khong_che_lien_he.sh)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BACK, load, embedded, reporter } from "../T-147/lib/back147.mjs";

const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const PHONE = /(?:\+84|(?<![\d])0)\d(?:[\s.\-]?\d){7,9}/;
const URLRE = /https?:\/\/\S+|\bwww\.\S+|zalo\.me\/\S+/i;
const MASK = /\d{2,4}[\s.]?[x*●]{3,}|[x*●]{3,}[\s.]?\d{2,4}|\[(?:đã )?(?:ẩn|che)[^\]]*\]/i; // dạng che số/URL; "***" đứng một mình là chữ in đậm của vendor, không tính

const withPhone = report.vendors.filter((r) => r.pool_input && PHONE.test(String(r.pool_input.record?.description || "")));
const withUrl = report.vendors.filter((r) => r.pool_input && URLRE.test(String(r.pool_input.record?.description || "")));
R.check("báo cáo có mô tả nguồn còn nguyên số điện thoại (>= 5 vendor)", withPhone.length >= 5, withPhone.length);
R.check("báo cáo có mô tả nguồn còn nguyên URL/zalo (>= 3 vendor)", withUrl.length >= 3, withUrl.length);
R.check("không mô tả nào trong báo cáo mang ký hiệu che", !report.vendors.some((r) => MASK.test(String(r.pool_input?.record?.description || ""))), report.vendors.filter((r) => MASK.test(String(r.pool_input?.record?.description || ""))).length);
R.check("marry.address của dòng báo cáo còn nguyên số điện thoại ở ít nhất một vendor", report.vendors.some((r) => PHONE.test(String(r.marry?.address || ""))), 0);

const B = await load(BACK);
const env = B.makeEnv(new B.MemoryBucket());
for (const r of [...withPhone.slice(0, 3), ...withUrl.slice(0, 2)]) {
  const d = await B.asCapu(env, "GET", `/api/admin/vendor-enrich/${r.id}/detail`);
  R.check(`detail của ${r.id}: mô tả nguồn nguyên văn như báo cáo`, d.status === 200 && d.json?.source?.record?.description === r.pool_input.record.description, [d.status, String(d.json?.source?.record?.description).slice(0, 60)]);
}
const FORBID = ["contact", "phone", "email", "website", "facebook", "address", "address_source"];
R.check("pool_input không có khoá liên hệ/địa chỉ ở dòng nào", !report.vendors.some((r) => r.pool_input && FORBID.some((k) => k in (r.pool_input.record || {}) || k in (r.pool_input.audit || {}))), 0);

const inv = path.join(HQ, "eval/invariants/planner/admin/vendor-enrich/inv-007-bao-cao-khong-mang-lien-he-dia-chi.py");
const sha = crypto.createHash("sha256").update(fs.readFileSync(inv)).digest("hex");
R.check("file inv-007 không bị sửa (sha256 ghim lúc viết T-150)", sha === "6826de5de8b1d8d98923c0780961e33640295f1884c57e0271c705814fd82c15", sha);
const p = spawnSync("python3", ["-I", inv], { encoding: "utf8", env: { ...process.env, TOHONG_BACK_REPO: BACK } });
R.check("inv-007 PASS", p.status === 0 && /PASS/.test(p.stdout), (p.stdout + p.stderr).slice(-150));
R.done();
