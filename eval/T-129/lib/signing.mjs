// T-129: định nghĩa chuẩn (độc lập với code sản phẩm) của chữ ký Ed25519 trên entry export. Cùng định dạng với eval/T-129/capu_decision.py.
import crypto from "node:crypto";

export function makeKey(id = "k1") {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    id,
    privateB64: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), // giá trị ENRICH_SIGNING_KEY
    publicRawB64: publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64"),
    publicKey,
  };
}
export const signingEnv = (k) => ({ ENRICH_SIGNING_KEY: k.privateB64, ENRICH_SIGNING_KEY_ID: k.id });

export function signedBytes(fields) {
  const parts = [Buffer.from("tohong-enrich-review-v1|")];
  for (const f of fields) { const b = Buffer.from(String(f), "utf8"); parts.push(Buffer.from(`${b.length}:`), b, Buffer.from(",")); }
  return Buffer.concat(parts);
}
const unb64u = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
/** true nếu entry export có chữ ký đúng bằng khoá công khai `publicKey`. */
export function verifyEntry(e, publicKey) {
  if (typeof e.sig !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(e.sig)) return false;
  const data = signedBytes([e.key_id, e.vendor_id, e.action, e.place_id || "", e.maps_link || "", e.reason, e.reviewer_label, e.reviewed_at]);
  return crypto.verify(null, data, publicKey, unb64u(e.sig));
}
