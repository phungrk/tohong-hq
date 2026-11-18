#!/usr/bin/env node
// Bất biến đề xuất · ĐÍCH: eval/invariants/planner/admin/ · nguồn: T-211 (spec products/T-211-sua-tay-dia-chi-sdt-vendor.md v1, Hành vi 8 "Pool sinh lại"; bất biến đề xuất 3 của spec,
// viết tổng quát cho mọi trường sửa tay). Rút khi qua Spec Gate 2026-11-18 (spec-critic). Chief of Staff đặt số khi đưa vào bể; nhớ giữ eval/T-203/lib/common.mjs.
// Nằm ở eval/T-211/bat-bien-cho-merge/ cho tới khi PR back của T-211 merge (ADR-028). Trên main hiện tại (chưa sửa được địa chỉ) script này ĐỎ ở tiền điều kiện; đó là đúng.
// INV-??? · Bản sửa tay của admin cho một vendor (tên, mô tả, giá, liên hệ, địa chỉ, Ẩn) là dữ liệu riêng, pool sinh lại không ghi đè được:
//   sau (a) isolate mới đọc lại từ lưu trữ, (b) pool đổi tên / mô tả / ảnh của vendor ở nguồn, (c) vendor rời pool, (d) vendor quay lại pool,
//   bản sửa admin đọc được Y HỆT bản vừa lưu (bỏ qua trường meta), phiên bản không đổi, không có dòng Lịch sử sửa / Nhật ký mới; khi rời pool chi tiết admin vẫn 200.
// Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), không đếm cấp thư mục (ADR-057/070, _shared/inv-004).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
const { fresh, pickTarget, asAdmin, loadOverlay, resetOverlayCache, VENDOR_POOL, meta, reporter, outbound } = L;
const R = reporter();
const ov = (id) => `/api/admin/vendors/${id}/override`;

const { env } = fresh();
const A = asAdmin(env);
const T = await pickTarget(env, "photography");
const detail = async () => { const r = await A("GET", `/api/admin/vendors/${T.id}`); return { status: r.status, ...(r.json || {}) }; };
const audit = async () => ((await A("GET", "/api/admin/audit?limit=200")).json?.entries || []).length;
const EDIT = {
  name: "Tên sửa tay bất biến", description: "Mô tả sửa tay của admin cho bất biến pool sinh lại.",
  priceMin: 7, priceMax: 19, price_verified: true,
  contact: { phone: "0912 345 678", zalo: "0912345678", website: "https://vendor-bat-bien.example" },
  address: "12 Nguyễn Huệ, Quận 1, TP.HCM", hidden: true, hidden_reason: "bất biến pool sinh lại",
};
const r = await A("PUT", ov(T.id), { expected_version: 0, ...EDIT });
const d0 = await detail();
R.check("tiền điều kiện: lưu bản sửa nhiều trường (gồm địa chỉ + SĐT) 200", r.status === 200 && d0.override?.address === EDIT.address && d0.override?.name === EDIT.name, [r.status, r.json?.error]);
const want = JSON.stringify(meta(d0.override)), v0 = d0.version, h0 = JSON.stringify(d0.history || []), a0 = await audit();
const same = async (label, { inPool = true } = {}) => {
  resetOverlayCache(); await loadOverlay(env, { force: true });
  const d = await detail();
  R.check(`${label}: chi tiết admin 200, in_pool ${inPool}, bản sửa y hệt, phiên bản giữ, Lịch sử sửa giữ`,
    d.status === 200 && d.in_pool === inPool && JSON.stringify(meta(d.override)) === want && d.version === v0 && JSON.stringify(d.history || []) === h0,
    [d.status, d.in_pool, d.version, String(JSON.stringify(meta(d.override))).slice(0, 160)]);
};
await same("(a) isolate mới đọc lại từ lưu trữ");
const pv = VENDOR_POOL.find((x) => x.id === T.id);
const keep = { name: pv.name, description: pv.description, photos: pv.photos };
pv.name = pv.name + " (đổi ở nguồn)"; pv.description = "Mô tả nguồn mới sau lần sinh lại pool"; pv.photos = [...(pv.photos || [])].reverse();
await same("(b) pool đổi tên / mô tả / ảnh ở nguồn");
const idx = VENDOR_POOL.findIndex((x) => x.id === T.id);
const removed = VENDOR_POOL.splice(idx, 1)[0];
await same("(c) vendor rời pool", { inPool: false });
VENDOR_POOL.splice(idx, 0, removed); Object.assign(pv, keep);
await same("(d) vendor quay lại pool");
R.check("pool sinh lại không ghi dòng Nhật ký nào", (await audit()) === a0, [a0, await audit()]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
