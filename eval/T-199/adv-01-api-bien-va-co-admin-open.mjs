#!/usr/bin/env node
// T-199 adv-01 (tầng 3, adversary): ca biên API `status` mà check_4/check_5 của T-197 chưa chạm. Spec: products/T-197-loc-status-bang-enrich.md mục 9, 10.
// Chạy từ gốc tohong-hq: node eval/T-199/adv-01-api-bien-va-co-admin-open.mjs  (TOHONG_BACK_REPO). Worker thật + R2 giả; mạng bị chặn; chỉ local.
//  a. filter = khoá nhóm TRÙNG status cho cả 9 nhóm, có hàng của nhóm đang chờ: = nhóm AND không chờ
//  b. status + q có dấu tiếng Việt (NFC, NFD, HOA, "Đ"/"đ"): = (kết quả q không status) ∩ hàng mang status (q giữ nguyên như hôm nay)
//  c. offset quá cuối / âm / rác, limit 0 / 1000 khi lọc: cùng cách hiểu như không lọc, total đúng
//  d. status đầu rỗng / all + status sau có giá trị: lấy cái đầu => không lọc, giống từng byte; " ", "ALL", "all ", "%0A", zero-width -> 400 invalid_status
//  e. cờ ADMIN_OPEN khác đúng "1": người ngoài 403 giống từng byte với mọi status; cờ "1": danh tính mở thấy đúng tập lọc như admin, Approve của nó là "Chờ Capu" (không bao giờ "Chờ áp dụng"), GET không ghi R2
import { ROWS, STATUS, GROUPS, MemoryBucket, makeEnv, call, as, seed, reporter, outbound, ADMIN, CAPU, fold, carries } from "../T-197/lib/common.mjs";

const R = reporter();
const LIST = "/api/admin/vendor-enrich";
const admin = as(ADMIN);
const bucket = new MemoryBucket();
const env = makeEnv(bucket);
// gieo: một hàng chờ ở MỌI nhóm có hàng chưa override (Chờ Capu lẻ, Chờ áp dụng chẵn)
const seeds = [];
GROUPS.forEach((g, i) => { const r = ROWS.find((x) => x.group === g && !x.override); if (r) seeds.push({ id: r.id, who: i % 2 ? CAPU : ADMIN, kind: "manual" }); });
const st = await seed(env, seeds);
const all = async (qs, e = env, who = admin) => {
  const rows = []; let total = null, first = null;
  for (let off = 0; ; off += 100) {
    const r = await who(e, "GET", `${LIST}?${qs}${qs ? "&" : ""}limit=100&offset=${off}`);
    if (r.status !== 200) return { status: r.status, text: r.text, rows };
    first ??= r.json; total = r.json.total; rows.push(...r.json.rows);
    if (r.json.rows.length === 0 || rows.length >= total) break;
  }
  return { status: 200, total, rows, first };
};
const ids = (a) => a.rows.map((x) => x.id).join(",");
const byId = new Map(ROWS.map((r) => [r.id, r]));

// a
for (const g of GROUPS) {
  const want = ROWS.filter((r) => r.group === g && carries(r, st, g));
  const a = await all(`filter=${g}&status=${g}`);
  R.check(`a. filter=${g}&status=${g}: ${want.length} hàng (hàng nhóm đang chờ bị loại)`, a.status === 200 && a.total === want.length && ids(a) === want.map((r) => r.id).join(","), [a.status, a.total, want.length]);
  const pc = await all(`filter=${g}&status=pending_capu`), pa = await all(`filter=${g}&status=pending_apply`);
  const wpc = ROWS.filter((r) => r.group === g && carries(r, st, "pending_capu")), wpa = ROWS.filter((r) => r.group === g && carries(r, st, "pending_apply"));
  R.check(`a. filter=${g} + pending_capu/pending_apply: ${wpc.length}/${wpa.length}`, pc.total === wpc.length && pa.total === wpa.length, [pc.total, pa.total]);
}

// b
const accented = ROWS.filter((r) => /[À-ỹđĐ]/.test(r.name));
const pickWord = (re) => { for (const r of accented) { const w = r.name.split(/\s+/).find((x) => re.test(x) && x.length >= 3); if (w) return w; } return null; };
const words = [pickWord(/[đĐ]/), pickWord(/[ạảãàáâậầấẩẫăặằắẳẵ]/i), pickWord(/[ơớờởỡợưứừửữự]/i)].filter(Boolean);
R.check("b. dữ liệu thật có tên có dấu để đo", words.length >= 2, words);
for (const w of words) {
  for (const qv of [w.normalize("NFC"), w.normalize("NFD"), w.toUpperCase(), w.toLowerCase()]) {
    const base = await all(`q=${encodeURIComponent(qv)}`);
    for (const [key] of [["pending_capu"], ["pending_apply"], ["name_similar"], ["not_found"], ["override"], ["full"]]) {
      const want = base.rows.filter((x) => carries(byId.get(x.id), st, key)).map((x) => x.id).join(",");
      const a = await all(`status=${key}&q=${encodeURIComponent(qv)}`);
      if (a.status !== 200 || ids(a) !== want) R.check(`b. status=${key}&q=${JSON.stringify(qv)} = (q không status) ∩ status`, false, [a.status, a.total, want.split(",").filter(Boolean).length]);
    }
  }
  R.check(`b. status x q=${JSON.stringify(w)} (NFC/NFD/HOA/thường): giao đúng`, true);
}
{ const nf = await all("status=not_found&q=" + encodeURIComponent("  ")); const b0 = await all("status=not_found");
  R.check('b. q chỉ có dấu cách + status: như không có q', nf.total === b0.total, [nf.total, b0.total]); }

// c
{ const w = ROWS.filter((r) => carries(r, st, "not_found"));
  for (const [qs, n0, len] of [["offset=99999", null, 0], ["offset=-5", 1, Math.min(50, w.length)], ["offset=abc", 1, Math.min(50, w.length)], ["offset=50.9", 51, Math.min(50, w.length - 50)]]) {
    const r = await admin(env, "GET", `${LIST}?status=not_found&${qs}`);
    const u = await admin(env, "GET", `${LIST}?${qs}`);
    R.check(`c. status=not_found&${qs}: 200, total ${w.length}, ${len} hàng${n0 ? `, n bắt đầu ${n0}` : ""}; mã trả giống bản không lọc (${u.status})`,
      r.status === 200 && u.status === 200 && r.json.total === w.length && r.json.rows.length === len && (!n0 || r.json.rows[0]?.n === n0) && r.json.offset === u.json.offset, [r.status, r.json?.total, r.json?.rows?.length, r.json?.offset, u.json?.offset]);
  }
  for (const lim of ["0", "1000", "-1", "x"]) {
    const r = await admin(env, "GET", `${LIST}?status=not_found&limit=${lim}`), u = await admin(env, "GET", `${LIST}?limit=${lim}`);
    R.check(`c. status=not_found&limit=${lim}: limit giống bản không lọc (${u.json?.limit}), số hàng = min(limit, total)`, r.status === 200 && r.json.limit === u.json.limit && r.json.rows.length === Math.min(u.json.limit, w.length), [r.status, r.json?.limit, r.json?.rows?.length]);
  }
  const far = await admin(env, "GET", `${LIST}?status=override&filter=name_similar&offset=10`);
  R.check("c. giao rỗng (override + chip Tên hơi giống) với offset: 200, total đúng, rows rỗng", far.status === 200 && far.json.total === ROWS.filter((r) => r.override && r.group === "name_similar").length && far.json.rows.length === 0, [far.status, far.json?.total]); }

// d
{ const base = await admin(env, "GET", LIST);
  for (const qs of ["status=&status=full", "status=all&status=override", "status=&status=khong_co"]) {
    const r = await admin(env, "GET", `${LIST}?${qs}`);
    R.check(`d. ${qs}: lấy tham số đầu (không lọc), giống từng byte bản không status`, r.status === 200 && r.text === base.text, [r.status, r.text.slice(0, 60)]);
  }
  for (const bad of [" ", "ALL", "All", "all ", "all\n", "full\n", "​full", "full​", "ｆｕｌｌ", "pending-capu", "Pending_Capu", "toString", "hasOwnProperty", "override ", "%"]) {
    const r = await admin(env, "GET", `${LIST}?status=${encodeURIComponent(bad)}`);
    R.check(`d. status=${JSON.stringify(bad)} -> 400 invalid_status`, r.status === 400 && r.text === '{"error":"invalid_status"}', [r.status, r.text.slice(0, 60)]);
  } }

// e
{ const b2 = new MemoryBucket(); const e0 = makeEnv(b2, { ADMIN_USER_IDS: ADMIN });
  await seed(makeEnv(b2), seeds);
  const p0 = b2.putLog.length;
  for (const flag of [undefined, "", "0", "true", " 1", "1 ", "01", "on"]) {
    const ef = flag === undefined ? e0 : { ...e0, ADMIN_OPEN: flag };
    const base = await call(ef, "GET", LIST);
    let ok = base.status === 403 && base.text === '{"error":"forbidden"}';
    for (const s of ["", "all", "full", "pending_capu", "pending_apply", "override", "FULL", "x".repeat(300)]) {
      for (const token of [undefined, "dev:user_thuong", "dev:" + CAPU]) {
        const r = await call(ef, "GET", `${LIST}?status=${encodeURIComponent(s)}`, { token });
        ok = ok && r.status === 403 && r.text === base.text;
      }
    }
    R.check(`e. ADMIN_OPEN=${JSON.stringify(flag)}: người ngoài 403 {"error":"forbidden"} giống từng byte với mọi status`, ok);
  }
  R.check("e. các lời gọi bị chặn không ghi R2", b2.putLog.length === p0, b2.putLog.length - p0);
  const eo = { ...makeEnv(b2), ADMIN_OPEN: "1" }; // cùng ADMIN_USER_IDS/CAPU_USER_IDS với admin thật để so
  let same = true;
  for (const [key] of STATUS) {
    const o = await all(`status=${key}`, eo, (e, m, p) => call(e, m, p)); const a = await all(`status=${key}`, makeEnv(b2), admin);
    same = same && o.status === 200 && ids(o) === ids(a);
  }
  R.check("e. ADMIN_OPEN=1, không token: mọi status ra đúng tập hàng như admin thật", same);
  const bad = await call(eo, "GET", `${LIST}?status=Full`);
  R.check("e. ADMIN_OPEN=1: status lạ vẫn 400 invalid_status", bad.status === 400 && bad.text === '{"error":"invalid_status"}', [bad.status, bad.text]);
  R.check("e. ADMIN_OPEN=1: GET lọc không ghi R2", b2.putLog.length === p0, b2.putLog.length - p0);
  const tgt = ROWS.find((r) => r.group === "name_similar" && r.approvable && !r.override && !st.has(r.id));
  const w = await call(eo, "PUT", `${LIST}/${tgt.id}/review`, { body: { decision: "approve" } });
  const pc = await all("status=pending_capu", eo, (e, m, p) => call(e, m, p)), pa = await all("status=pending_apply", eo, (e, m, p) => call(e, m, p));
  R.check("e. ADMIN_OPEN=1: Approve của danh tính mở nằm ở 'Chờ Capu', không ở 'Chờ áp dụng' (inv-002 planner/admin)", w.status === 200 && pc.rows.some((x) => x.id === tgt.id) && !pa.rows.some((x) => x.id === tgt.id), [w.status]);
  const capuEnv = { ...eo, ADMIN_USER_IDS: `${ADMIN},admin-khong-dang-nhap`, CAPU_USER_IDS: `${CAPU},admin-khong-dang-nhap` };
  const pa2 = await all("status=pending_apply", capuEnv, (e, m, p) => call(e, m, p));
  R.check("e. dù danh tính mở bị liệt kê trong CAPU_USER_IDS: review của nó KHÔNG thành 'Chờ áp dụng'", pa2.status === 200 && !pa2.rows.some((x) => x.id === tgt.id), [pa2.status]);
}
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
