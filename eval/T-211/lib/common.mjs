// T-211: khung chung cho eval. Dùng lại khung T-203 (Worker thật của tohong-back + R2 giả; mạng ngoài bị chặn). Giữ eval/T-203/lib/ (ADR-129).
// Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ (dò ngược tới scripts/gate.py, ADR-070).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let HQ = HERE; while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
export * from "../../T-203/lib/common.mjs";
export const PUT = (id) => `/api/admin/vendors/${id}/override`;
export const nowrite = (a, b) => a.added.length + a.removed.length + a.changed.length === 0;
const { fresh, asAdmin, pickTarget, snapshot, diff } = L;

// Môi trường + vendor mục tiêu + hàm tiện ích. Mỗi lần gọi là một môi trường mới.
export async function setup(category = "photography") {
  const { env, bucket, guard } = fresh();
  const A = asAdmin(env);
  const T = await pickTarget(env, category);
  const detail = async (id = T.id) => (await A("GET", `/api/admin/vendors/${id}`)).json || {};
  const ver = async (id = T.id) => (await detail(id)).version || 0;
  // PUT với expected_version = phiên bản hiện tại (trừ khi chỉ định)
  const put = async (body, id = T.id, expected) => A("PUT", PUT(id), { expected_version: expected ?? (await ver(id)), ...body });
  const del = async (id = T.id) => A("DELETE", PUT(id) + `?expected_version=${await ver(id)}`);
  const audit = async (qs = "") => (await A("GET", `/api/admin/audit?limit=50${qs}`)).json?.entries || [];
  return { env, bucket, guard, A, T, detail, ver, put, del, audit, snapshot, diff };
}
export const phoneOf = (d) => d.override?.contact?.phone ?? null;
export const addrOf = (d) => d.override?.address ?? null;
