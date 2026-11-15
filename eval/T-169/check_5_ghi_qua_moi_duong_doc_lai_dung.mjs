// T-169 tiêu chí 5. GHI QUA TỪNG ĐƯỜNG GHI, ĐỌC LẠI Ở MỌI BỀ MẶT ĐÚNG GIÁ TRỊ VỪA GHI. Các đường ghi hồ sơ hôm nay:
//   (1) onboarding: PATCH /api/couples/:id với đúng khối payload màn onboarding gửi (couple.*, families, preferences.style_tags + preferences.guest_count, guest_count, budget);
//   (2) màn hồ sơ/Dashboard sửa ngày cưới: PATCH {couple:{wedding_date}};
//   (3) chat: hành động update_profile (wedding_date, guest_count, budget, city, style_preferences);
//   (4) tab Ngân sách: PUT /api/couples/:id/budget (guests, total_tr);
//   (5) tạo cặp đôi: POST /api/couples (ngày cưới).
// Luật ghi: ghi vào trường chuẩn; mọi trường cũ CÙNG thông tin đang có (kể cả `guests`/`total_tr` của bảng ngân sách) được đặt bằng đúng giá trị mới, không xoá khoá, không tạo khoá cũ mới;
// payload mang nhiều trường cùng thông tin lệch nhau thì trường chuẩn thắng; null/rỗng tường minh = xoá giá trị (trường cũ không hồi sinh); PUT /budget không đổi tổng khi hồ sơ đã có `budget`.
// Chạy từ gốc tohong-hq: node eval/T-169/check_5_ghi_qua_moi_duong_doc_lai_dung.mjs
import { setup, bucket, readAll, api, chatAction, checker, dateAll, guestsAll, budgetAll, storedProfile, storedBudget, LECH, BANG, ids, done, KEY, AUTH } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const fresh = (profile = LECH(), budget = BANG({ guests: 237, total_tr: 500 })) => bucket(M, { profile, budget: budget === null ? undefined : budget, overlay: ov }); // budget null = chưa có bảng
const ok = (name, r) => { if (!r || r.status >= 400 || r.success === false) fails.push(`${name}: ghi lỗi ${r?.status ?? ""} ${r?.error ?? r?.err?.message ?? ""}`); };
const cityAll = (tag, r, shown, want) => { eq(`${tag} tab Vendor`, r.tabIds.filter((x) => x === ids.R1 || x === ids.HN), [want]); eq(`${tag} chat`, r.chatIds.filter((x) => x === ids.R1 || x === ids.HN), [want]); eq(`${tag} summary.city`, r.summary?.profile?.city ?? null, shown); };
const stylesAll = (tag, r, want) => { eq(`${tag} profileSnapshot.styles`, r.snap?.styles ?? [], want); eq(`${tag} chat preferences.style_tags`, r.chatBlock?.preferences?.style_tags ?? [], want); if (r.chatBlock && "style_tags" in r.chatBlock) eq(`${tag} chat style_tags top-level`, r.chatBlock.style_tags ?? [], want); };
const fail0 = (r, name) => { for (const e of r.err) fails.push(`${name}: ${e}`); };

// (1) onboarding, đúng payload của tohong-front App.jsx (đã ghi lại ở đây như một fixture hành vi), lên hồ sơ lệch + bảng lệch
{ const name = "onboarding"; const b = fresh();
  ok(name, await api(M, b, "PATCH", "", { couple: { bride_name: "Cô Dâu Mới", groom_name: "Chú Rể Mới", wedding_date: "2028-02-10", city: "Hà Nội" }, families: { bride_region: "Bac", groom_region: "Bac" }, preferences: { style_tags: ["modern"], guest_count: 180 }, guest_count: 180, budget: 400 }));
  const r = await readAll(M, b); fail0(r, name);
  dateAll(eq, name, r, "2028-02-10"); guestsAll(eq, name, r, 180); budgetAll(eq, name, r, 400); cityAll(name, r, "Hà Nội", ids.HN); stylesAll(name, r, ["modern"]);
  const s = await storedProfile(M, b); eq(`${name}: tên mới được lưu`, [s?.couple?.bride_name, s?.couple?.groom_name], ["Cô Dâu Mới", "Chú Rể Mới"]); }

// (2) Dashboard sửa ngày cưới
{ const name = "dashboard-ngày"; const b = fresh();
  ok(name, await api(M, b, "PATCH", "", { couple: { wedding_date: "2028-01-05" } }));
  const r = await readAll(M, b); fail0(r, name); dateAll(eq, name, r, "2028-01-05"); guestsAll(eq, name, r, 237); budgetAll(eq, name, r, 300);
  const s = await storedProfile(M, b); eq(`${name}: trường cũ wedding_date (đang có) được đặt bằng ngày mới`, s?.wedding_date, "2028-01-05"); }

// (3) chat update_profile, từng trường, lên hồ sơ lệch + bảng lệch (guests 237, total 500)
const chatCases = [
  ["chat-ngày", { wedding_date: "2028-03-03" }, (n, r) => dateAll(eq, n, r, "2028-03-03")],
  ["chat-số khách", { guest_count: 120 }, (n, r) => guestsAll(eq, n, r, 120)],
  ["chat-ngân sách", { budget: 350 }, (n, r) => budgetAll(eq, n, r, 350)],
  ["chat-thành phố", { city: "HN" }, (n, r) => cityAll(n, r, "HN", ids.HN)],
  ["chat-gu", { style_preferences: ["luxury", "modern"] }, (n, r) => stylesAll(n, r, ["luxury", "modern"])],
  ["chat-xoá gu", { style_preferences: [] }, (n, r) => stylesAll(n, r, [])],
];
for (const [name, action, assert] of chatCases) { const b = fresh(); ok(name, await chatAction(M, b, action)); const r = await readAll(M, b); fail0(r, name); assert(name, r); }
// không khoá cũ mới: hồ sơ chỉ có trường chuẩn, ghi qua chat/PUT không đẻ thêm khoá cũ
{ const name = "không-đẻ-khoá-cũ"; const clean = { couple: { city: "HCMC", wedding_date: "2027-06-06" }, guest_count: 200, budget: 300, preferences: { style_tags: ["korean"] } };
  const b = bucket(M, { profile: clean, overlay: ov });
  ok(name, await chatAction(M, b, { guest_count: 120, wedding_date: "2027-07-07", style_preferences: ["rustic"], budget: 310 }));
  ok(name, await api(M, b, "PUT", "budget", { categories: [], total_tr: 310, guests: 130, mung_tr: 0 }));
  const s = await storedProfile(M, b);
  eq(`${name}: không có preferences.guest_count / couple.guest_count / wedding_date top-level / style_tags top-level`, [s?.preferences?.guest_count, s?.couple?.guest_count, s?.wedding_date, s?.style_tags], [undefined, undefined, undefined, undefined]);
  eq(`${name}: giá trị chuẩn là giá trị mới nhất (PUT 130 sau chat 120)`, [s?.guest_count, s?.couple?.wedding_date, s?.preferences?.style_tags, s?.budget], [130, "2027-07-07", ["rustic"], 310]); }

// (4) tab Ngân sách PUT
{ const name = "PUT-ngân-sách"; const b = fresh(); const cats = BANG().categories;
  ok(name, await api(M, b, "PUT", "budget", { categories: cats, total_tr: 999, guests: 150, mung_tr: 7 }));
  const r = await readAll(M, b); fail0(r, name); guestsAll(eq, name, r, 150); budgetAll(eq, name, r, 300); // 999 không đổi tổng: hồ sơ đã có budget
  const d = await storedBudget(M, b); eq(`${name}: bảng giữ hạng mục + mừng`, [d?.categories?.[0]?.id, d?.categories?.[0]?.items?.[0]?.amt, d?.mung_tr], ["venue", 5, 7]); }
{ const name = "PUT-ngân-sách-hồ-sơ-chưa-có-tổng"; const p = LECH(); delete p.budget; const b = fresh(p, null);
  ok(name, await api(M, b, "PUT", "budget", { categories: BANG().categories, total_tr: 450, guests: 0, mung_tr: 0 }));
  const r = await readAll(M, b); fail0(r, name); budgetAll(eq, name, r, 450); guestsAll(eq, name, r, 200); } // guests 0 trong PUT = "chưa đặt", không xoá số khách hồ sơ

// (5) nhiều đường nối tiếp: giá trị cuối cùng thắng ở MỌI bề mặt, bất kể ghi từ đâu
{ const name = "nối-tiếp"; const b = fresh();
  ok(name, await chatAction(M, b, { guest_count: 120 })); let r = await readAll(M, b); guestsAll(eq, name + " chat→", r, 120);
  ok(name, await api(M, b, "PUT", "budget", { categories: BANG().categories, total_tr: 300, guests: 150, mung_tr: 0 })); r = await readAll(M, b); guestsAll(eq, name + " →PUT", r, 150);
  ok(name, await api(M, b, "PATCH", "", { preferences: { guest_count: 90 } })); r = await readAll(M, b); guestsAll(eq, name + " →PATCH trường cũ", r, 90);
  ok(name, await api(M, b, "PATCH", "", { guest_count: 111, preferences: { guest_count: 222 } })); r = await readAll(M, b); guestsAll(eq, name + " →PATCH lệch trong cùng payload (chuẩn thắng)", r, 111); }
// xoá tường minh không hồi sinh trường cũ
{ const name = "xoá-ngày"; const b = fresh(); ok(name, await api(M, b, "PATCH", "", { couple: { wedding_date: null } })); const r = await readAll(M, b); fail0(r, name); dateAll(eq, name, r, null); }

// (6) tạo cặp đôi: ngày cưới đọc lại được ở màn hồ sơ
{ const name = "tạo-cặp-đôi"; const b = new M.MemoryBucket(); M.resetOverlayCache(); const res = await M.routeCouples(new Request("http://localhost/api/couples", { method: "POST", body: JSON.stringify({ bride_name: "A Thử", groom_name: "B Thử", wedding_date: "2028-05-05" }), headers: { "content-type": "application/json" } }), { CHAT_DATA: b }, { ...AUTH, email: "a@example.invalid" }, {}, []);
  const cid = (await res.json())?.couple?.couple_id; const s = cid ? (await M.makeStore({ CHAT_DATA: b }).getYaml(`data/couples/${cid}/profile.yaml`))?.value : null;
  eq(`${name}: couple.wedding_date`, s?.couple?.wedding_date ?? null, "2028-05-05");
  const sm = cid ? await M.routeCouples(new Request(`http://localhost/api/couples/${cid}/summary`), { CHAT_DATA: b }, AUTH, {}, [cid, "summary"]) : null; eq(`${name}: summary wedding_date`, (await sm?.json())?.profile?.wedding_date ?? null, "2028-05-05"); }
done(fails);
