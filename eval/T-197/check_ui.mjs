#!/usr/bin/env node
// T-197 (repo tohong-front, chạy cùng worker thật của tohong-back): bộ lọc Status của bảng "Bảng enrich vendor" trong admin.
// Chạy: cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-197/check_ui.mjs --repo . --case 1|2|3|4 [--dist DIR]
// Đo CHỮ người dùng thấy (ô chọn tên "Status", chữ ở cột "Status", chữ "Hiển thị a–b / N", nút) ; không đọc mã nguồn, không bám class.
// Dữ liệu: báo cáo nhúng thật của tohong-back + review gieo qua API thật (lib/common.mjs). Trang gọi API thật qua worker, nên front và back phải cùng đúng.
//  case 1: ô chọn có đúng 13 lựa chọn, mặc định "Tất cả" như hôm nay (tiêu chí 1)
//  case 2: mỗi giá trị Status: mọi hàng ở mọi trang có đúng Status đó, số tổng khớp, đúng thứ tự (tiêu chí 2)
//  case 3: kết hợp AND với chip / Hạng mục / ô tìm; về trang 1 khi đổi; số đếm chip và dòng đầu không đổi (tiêu chí 3)
//  (case 3 gồm cả: đổi Status giữ Hạng mục + từ khoá đã áp, chữ gõ dở không được áp; case 1 gồm: nhãn "Status" nhìn thấy, tải lại trang -> "Tất cả"; case 4 gồm: ghi ở trang 3 -> về trang 2)
//  case 4: sau Approve / Rút lại / Sửa thủ công khi đang lọc: bảng khớp lại; không trang trống (tiêu chí 6)
import { REPO, CASE, scenario, readRows, pagerText, hien, settle, pickStatus, readAllPages, chipNames, act, closeAll, PAGE, CHIPS, STATUS, LABEL, shown } from "./lib/ui.mjs";
import { ROWS, expected, reporter, outbound, fold } from "./lib/common.mjs";

const R = reporter();
const GROUP_KEYS = new Set(STATUS.slice(0, 9).map(([k]) => k));
const OPTIONS = ["Tất cả", ...STATUS.map(([, l]) => l)];
const sp = (x) => String(x).replace(/\s+/g, " ").trim(); // người dùng thấy khoảng trắng đã gộp
const exactRows = (want, st, off = 0) => want.slice(off, off + PAGE).map((r, i) => ({ n: off + i + 1, name: sp(r.name), status: shown(r, st) }));
const sameRows = (got, want) => got.length === want.length && got.every((g, i) => g.n === want[i].n && g.name === want[i].name && g.status === want[i].status);
const brief = (rows) => JSON.stringify(rows.slice(0, 2));
const bodyHas = async (S, s) => (await S.page.locator("body").innerText()).includes(s);
try {
  if (CASE === "1") {
    const S = await scenario();
    R.check('có đúng một ô chọn (combobox) tên "Status"', (await S.select.count()) === 1, await S.select.count());
    // Nhãn "Status" phải NHÌN THẤY được: đo hình học của đúng chữ "Status" trong <label> gắn với ô (không tin DOM/offsetParent).
    const g = await S.select.evaluate((el) => {
      const sel = el.getBoundingClientRect();
      for (const l of el.labels) {
        const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const k = n.data.indexOf("Status"); if (k < 0) continue;
          const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 6);
          const b = r.getBoundingClientRect(); const pe = n.parentElement; const cs = getComputedStyle(pe);
          let op = 1; for (let e = pe; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
          const m = /rgba?\(([^)]*)\)/.exec(cs.color); const alpha = m && m[1].split(",").length === 4 ? Number(m[1].split(",")[3]) : 1;
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { w: b.width, h: b.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom, op, alpha, vis: cs.visibility, inView: b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight,
            hitOk: !!hit && (pe.contains(hit) || hit.contains(pe)) && hit !== document.body && hit !== document.documentElement, sel: { left: sel.left, top: sel.top, bottom: sel.bottom } };
        }
      }
      return null;
    });
    R.check('có nhãn "Status" (chữ nằm trong <label> gắn với ô, không chỉ aria-label)', !!g, g);
    if (g) {
      R.check(`nhãn "Status" đủ lớn để thấy: hộp chữ rộng >= 20px, cao >= 8px (đo được ${Math.round(g.w)}x${Math.round(g.h)})`, g.w >= 20 && g.h >= 8, [g.w, g.h]);
      R.check("nhãn không trong suốt: opacity > 0, màu chữ không trong suốt, không visibility:hidden", g.op > 0 && g.alpha > 0 && g.vis === "visible", [g.op, g.alpha, g.vis]);
      R.check("nhãn không bị che hay cắt: nằm trong khung nhìn và phần tử tại tâm hộp chữ chính là nhãn", g.inView && g.hitOk, [g.inView, g.hitOk]);
      R.check("nhãn đặt NGAY TRƯỚC ô: cùng hàng (chồng dọc với ô) và mép phải chữ <= mép trái ô", g.right <= g.sel.left + 1 && g.top < g.sel.bottom && g.bottom > g.sel.top, [g.right, g.sel.left, g.top, g.bottom, g.sel.top, g.sel.bottom]);
    }
    const opts = (await S.select.locator("option").allInnerTexts()).map((x) => x.trim());
    R.check("13 lựa chọn đúng chữ, đúng thứ tự: Tất cả, 9 nhóm, Chờ Capu, Chờ áp dụng, Đã duyệt tay", JSON.stringify(opts) === JSON.stringify(OPTIONS), opts);
    R.check("lựa chọn nhóm khớp từng chữ với chữ cột Status (bao gồm dấu phẩy)", STATUS.slice(0, 9).every(([g, l], i) => opts[1 + i] === l && LABEL[g] === l));
    R.check('mặc định đang chọn "Tất cả"', (await S.select.locator("option:checked").innerText()).trim() === "Tất cả");
    const total = ROWS.length;
    await settle(S, hien(0, total));
    R.check(`mặc định: "${hien(0, total)}", 50 hàng, từng hàng đúng như danh sách đầy đủ (như hôm nay)`, sameRows(await readRows(S), exactRows(ROWS, S.st)), brief(await readRows(S)));
    R.check("mặc định: lần gọi danh sách đầu không lọc Status (không có 'status=' khác all)", !S.lists.some((q) => /[?&]status=(?!all\b)[^&]/.test(q)) || S.lists.length === 0, S.lists);
    const names0 = await chipNames(S);
    R.check("5 chip và số đếm như hôm nay (Tất cả · N, Enrich 100% · …)", names0.length === 5 && names0[0] === `Tất cả · ${ROWS.length}`, names0);
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    await act(S, () => pickStatus(S, "Tất cả"));
    await settle(S, hien(0, total));
    R.check('chọn rồi quay lại "Tất cả": bảng giống hệt mặc định (từng hàng, từng chữ Status, tổng)', sameRows(await readRows(S), exactRows(ROWS, S.st)));
    await act(S, () => pickStatus(S, "Chờ Capu"));
    await settle(S, hien(0, expected(S.st, { status: "pending_capu" }).length));
    await S.open(false);
    await settle(S, hien(0, total));
    R.check('chọn "Chờ Capu" rồi TẢI LẠI trang (cùng phiên): ô Status về "Tất cả", bảng "Hiển thị 1–50 / 870" như mặc định', (await S.select.locator("option:checked").innerText()).trim() === "Tất cả" && sameRows(await readRows(S), exactRows(ROWS, S.st)));
    R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, S.external);
  }

  if (CASE === "2") {
    const S = await scenario();
    await settle(S, hien(0, ROWS.length));
    let sum = 0;
    for (const [key, label] of STATUS) {
      const want = expected(S.st, { status: key });
      await act(S, () => pickStatus(S, label));
      if (want.length === 0) {
        await settle(S, hien(0, 0));
        R.check(`${label}: không hàng nào -> "Không có vendor nào khớp bộ lọc." và "${hien(0, 0)}", hai nút trang bị khoá`, (await bodyHas(S, "Không có vendor nào khớp bộ lọc.")) && (await S.page.getByRole("button", { name: "Trang sau" }).isDisabled()) && (await S.page.getByRole("button", { name: "Trang trước" }).isDisabled()));
        continue;
      }
      const got = await readAllPages(S, want.length);
      const exp = exactRows(want, S.st, 0).concat(want.length > PAGE ? Array.from({ length: Math.ceil(want.length / PAGE) - 1 }, (_, k) => exactRows(want, S.st, (k + 1) * PAGE)).flat() : []);
      R.check(`${label}: ${want.length} hàng qua ${Math.ceil(want.length / PAGE)} trang, mọi hàng có đúng chữ Status "${label}"${key === "override" ? " (kèm nhãn nhóm)" : ""}, đúng hàng, đúng thứ tự`, sameRows(got, exp), got.find((g, i) => !exp[i] || g.status !== exp[i].status || g.name !== exp[i].name));
      R.check(`${label}: chữ cột Status của mọi hàng hiện ra là ${key === "override" ? '"<nhãn nhóm> Đã duyệt tay"' : `"${label}"`}${key !== "override" && GROUP_KEYS.has(key) ? ", không hàng nào ở trạng thái chờ" : ""}`, key === "override" ? got.every((g) => / Đã duyệt tay$/.test(g.status)) : got.every((g) => g.status === label || (GROUP_KEYS.has(key) && g.status === `${label} Đã duyệt tay`)), got.find((g) => g.status !== label)?.status);
      if (key !== "override") sum += want.length;
    }
    R.check("tổng số của 9 nhóm + Chờ Capu + Chờ áp dụng = toàn bộ danh sách (một hàng đúng một ô)", sum === ROWS.length, [sum, ROWS.length]);
    R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, S.external);
  }

  if (CASE === "3") {
    const S = await scenario();
    await settle(S, hien(0, ROWS.length));
    const chips0 = await chipNames(S);
    const summary0 = (await S.page.locator("body").innerText()).match(/\d+ vendor · enrich lần cuối [^\n]+/)?.[0];
    const view = async (want, label) => { // trang 1 đang hiện đúng `want`
      await settle(S, hien(0, want.length));
      if (want.length === 0) return R.check(`${label}: không hàng -> thông báo rỗng`, await bodyHas(S, "Không có vendor nào khớp bộ lọc."));
      const got = await readRows(S);
      R.check(label, sameRows(got, exactRows(want, S.st)), brief(got));
    };
    const click = (name) => act(S, () => S.page.getByRole("button", { name: new RegExp("^" + name.replace(/%/g, "\\%") + " · \\d+$") }).click());
    // a. chip + Status trùng chữ
    await click(CHIPS.name_similar);
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    await view(expected(S.st, { chip: "name_similar", status: "name_similar" }), 'chip "Tên hơi giống" + Status "Tên hơi giống": giao hai điều kiện (hàng đã Chờ Capu/Chờ áp dụng không có mặt)');
    // b. chip + Status không giao nhau
    await click(CHIPS.addr_diff);
    await view(expected(S.st, { chip: "addr_diff", status: "name_similar" }), 'chip "Địa chỉ khác marry" + Status "Tên hơi giống": không hàng nào');
    // c. hàng vừa thuộc nhóm Enrich 100% vừa Chờ Capu: lọc theo chữ đang hiện ở cột
    await click(CHIPS.full);
    await act(S, () => pickStatus(S, "Chờ Capu"));
    await view(expected(S.st, { chip: "full", status: "pending_capu" }), 'chip "Enrich 100%" + Status "Chờ Capu": đúng hàng nhóm Enrich 100% đang Chờ Capu (chữ cột là "Chờ Capu", không phải "Enrich 100%")');
    await act(S, () => pickStatus(S, "Enrich 100%"));
    await view(expected(S.st, { chip: "full", status: "full" }), 'chip "Enrich 100%" + Status "Enrich 100%": không có hàng đang Chờ Capu (ít hơn chip một mình)');
    // d. Hạng mục + ô tìm
    await click(CHIPS.all);
    R.check('bấm chip "Tất cả": ô Status KHÔNG bị đặt lại (vẫn "Enrich 100%")', (await S.select.locator("option:checked").innerText()).trim() === "Enrich 100%");
    await view(expected(S.st, { status: "full" }), 'chip "Tất cả" + Status "Enrich 100%"');
    await act(S, () => pickStatus(S, "Không thấy trên Maps"));
    const nf = expected(S.st, { status: "not_found" });
    const cnt = {}; for (const r of nf) cnt[r.category] = (cnt[r.category] || 0) + 1;
    const cat = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    await act(S, () => S.page.getByRole("combobox", { name: "Hạng mục" }).selectOption(cat));
    await view(expected(S.st, { status: "not_found", category: cat }), `Status "Không thấy trên Maps" + Hạng mục ${cat}`);
    const word = fold(expected(S.st, { status: "not_found", category: cat })[0].name).split(/\s+/).find((w) => w.length >= 4) || "a";
    await act(S, async () => { const sb = S.page.getByRole("searchbox", { name: "Tìm vendor" }); await sb.fill(word); await sb.press("Enter"); });
    await view(expected(S.st, { status: "not_found", category: cat, q: word }), `+ ô tìm "${word}"`);
    // e. về trang 1 khi đổi; Status được giữ khi đổi thứ khác
    await act(S, async () => { const sb = S.page.getByRole("searchbox", { name: "Tìm vendor" }); await sb.fill(""); await sb.press("Enter"); });
    await act(S, () => S.page.getByRole("combobox", { name: "Hạng mục" }).selectOption(""));
    await settle(S, hien(0, nf.length));
    await act(S, () => S.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(S, hien(PAGE, nf.length));
    R.check(`"Không thấy trên Maps": trang 2 hiện hàng STT ${PAGE + 1}`, (await readRows(S))[0]?.n === PAGE + 1, brief(await readRows(S)));
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    await settle(S, hien(0, expected(S.st, { status: "name_similar" }).length));
    R.check('đang ở trang 2, đổi Status: về trang 1 (hàng đầu STT 1, "Hiển thị 1–50 / …")', (await readRows(S))[0]?.n === 1);
    await act(S, () => S.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(S, hien(PAGE, expected(S.st, { status: "name_similar" }).length));
    await click(CHIPS.no_google_photo);
    const w2 = expected(S.st, { chip: "no_google_photo", status: "name_similar" });
    await settle(S, hien(0, w2.length));
    R.check('đang ở trang 2, đổi chip: về trang 1 và ô Status vẫn "Tên hơi giống"', (await S.select.locator("option:checked").innerText()).trim() === "Tên hơi giống" && (w2.length === 0 || (await readRows(S))[0]?.n === 1));
    await view(w2, 'chip "Chưa có ảnh Google" + Status "Tên hơi giống"');
    // e2. đổi Status giữ Hạng mục và từ khoá ĐÃ ÁP; chữ gõ dở (chưa Enter) không được áp, vẫn hiện nguyên trong ô
    await click(CHIPS.all);
    await act(S, () => pickStatus(S, "Không thấy trên Maps"));
    const cnt2 = {}; for (const r of expected(S.st, { status: "name_similar", q: "a" })) cnt2[r.category] = (cnt2[r.category] || 0) + 1;
    const cat2 = Object.entries(cnt2).sort((a, b) => b[1] - a[1])[0][0];
    await act(S, () => S.page.getByRole("combobox", { name: "Hạng mục" }).selectOption(cat2));
    const sb2 = S.page.getByRole("searchbox", { name: "Tìm vendor" });
    await act(S, async () => { await sb2.fill("a"); await sb2.press("Enter"); });
    await sb2.fill("zzqx");
    const n2 = S.lists.length;
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    const w3 = expected(S.st, { status: "name_similar", category: cat2, q: "a" });
    await view(w3, `Hạng mục ${cat2} + tìm đã áp "a" + gõ dở "zzqx", đổi Status sang "Tên hơi giống": bảng = Status AND Hạng mục AND "a" (chữ gõ dở không được áp)`);
    R.check('... ô Hạng mục vẫn giữ giá trị, ô tìm vẫn hiện chữ gõ dở "zzqx"', (await S.page.getByRole("combobox", { name: "Hạng mục" }).inputValue()) === cat2 && (await sb2.inputValue()) === "zzqx" && w3.length > 0, [await sb2.inputValue(), w3.length]);
    R.check("... và lần gọi API đó không mang chữ gõ dở", !S.lists.slice(n2).some((q) => /zzqx/.test(q)), S.lists.slice(n2));
    // f. số đếm chip và dòng đầu bảng không đổi theo Status
    R.check("số trên 5 chip không đổi theo Status", JSON.stringify(await chipNames(S)) === JSON.stringify(chips0), [await chipNames(S), chips0]);
    R.check('dòng "<N> vendor · enrich lần cuối …" không đổi theo Status', (await S.page.locator("body").innerText()).includes(summary0), summary0);
    R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, S.external);
  }

  if (CASE === "4") {
    const S = await scenario();
    await settle(S, hien(0, ROWS.length));
    const rowBy = async (name) => S.table.locator("tbody tr").nth((await readRows(S)).findIndex((g) => g.name === name));
    const total = async () => Number((await pagerText(S)).match(/\/ (\d+)$/)[1]);
    // a. đang lọc "Tên hơi giống": Approve -> hàng biến mất, tổng -1; sang "Chờ Capu" thì thấy nó
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    const w0 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(0, w0.length));
    const ai = w0.findIndex((r) => r.approvable && !r.override); // hàng đầu có nút Approve
    const first = (await readRows(S))[ai];
    await act(S, () => S.table.locator("tbody tr").nth(ai).getByRole("button", { name: "Approve", exact: true }).click());
    S.st.set(w0[ai].id, { byCapu: false });
    const w1 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(0, w1.length));
    const got1 = await readRows(S);
    R.check(`đang lọc "Tên hơi giống": Approve xong hàng "${first.name}" biến khỏi bảng và tổng giảm 1 (${w0.length} -> ${w1.length})`, sameRows(got1, exactRows(w1, S.st)) && !got1.some((g) => g.name === first.name), brief(got1));
    R.check('mọi hàng còn hiện vẫn có chữ Status "Tên hơi giống" (không hàng "Chờ Capu" nằm lại)', got1.every((g) => g.status === "Tên hơi giống"), got1.find((g) => g.status !== "Tên hơi giống"));
    await act(S, () => pickStatus(S, "Chờ Capu"));
    const w2 = expected(S.st, { status: "pending_capu" });
    await settle(S, hien(0, w2.length));
    const got2 = await readAllPages(S, w2.length);
    R.check(`"Chờ Capu": có hàng vừa Approve, tổng ${w2.length}, mọi hàng "Chờ Capu"`, sameRows(got2, exactRows(w2, S.st)) && got2.some((g) => g.name === first.name), brief(got2));
    // b. đang lọc "Chờ Capu": Rút lại -> hàng biến mất
    const rb = await rowBy(first.name);
    await act(S, () => rb.getByRole("button", { name: "Rút lại" }).click());
    S.st.delete(w0[ai].id);
    const w3 = expected(S.st, { status: "pending_capu" });
    await settle(S, hien(0, w3.length));
    const got3 = await readRows(S);
    R.check(`đang lọc "Chờ Capu": Rút lại xong hàng biến khỏi bảng, tổng ${w2.length} -> ${w3.length}`, sameRows(got3, exactRows(w3, S.st)) && !got3.some((g) => g.name === first.name), brief(got3));
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    await settle(S, hien(0, w0.length));
    R.check('quay lại "Tên hơi giống": hàng đó về chỗ cũ, tổng như ban đầu', sameRows(await readRows(S), exactRows(w0, S.st)));
    // c. Sửa thủ công khi đang lọc "Enrich 100%": hàng thành Chờ Capu nên rời bảng
    await act(S, () => pickStatus(S, "Enrich 100%"));
    const f0 = expected(S.st, { status: "full" });
    await settle(S, hien(0, f0.length));
    const fi = f0.findIndex((r) => !r.override); // hàng đầu CHƯA override (hàng override không có nút)
    await S.table.locator("tbody tr").nth(fi).getByRole("button", { name: "Sửa thủ công", exact: true }).click();
    const dlg = S.page.getByRole("dialog", { name: /^Sửa thủ công/ }); await dlg.waitFor();
    await dlg.getByText("Không có trên Maps → gỡ vendor").click();
    await dlg.getByLabel("Ghi chú").fill("eval T-197");
    await act(S, () => dlg.getByRole("button", { name: "Lưu", exact: true }).click());
    S.st.set(f0[fi].id, { byCapu: false });
    const f1 = expected(S.st, { status: "full" });
    await settle(S, hien(0, f1.length));
    const gotF = await readRows(S);
    R.check(`đang lọc "Enrich 100%": Sửa thủ công xong hàng "${sp(f0[fi].name)}" biến khỏi bảng, tổng ${f0.length} -> ${f1.length}`, sameRows(gotF, exactRows(f1, S.st)) && !gotF.some((g) => g.name === sp(f0[fi].name)), brief(gotF));
    // c2. đang ở trang 2 của "Tên hơi giống": Approve một hàng -> vẫn ở trang 2 (giữ trang), tổng giảm 1
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    const n0 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(0, n0.length));
    await act(S, () => S.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(S, hien(PAGE, n0.length));
    const pi = n0.findIndex((r, k) => k >= PAGE && k < 2 * PAGE && r.approvable && !r.override);
    await act(S, () => S.table.locator("tbody tr").nth(pi - PAGE).getByRole("button", { name: "Approve", exact: true }).click());
    S.st.set(n0[pi].id, { byCapu: false });
    const n1 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(PAGE, n1.length));
    R.check(`đang ở trang 2 của "Tên hơi giống": Approve một hàng -> vẫn ở trang 2 ("${hien(PAGE, n1.length)}"), đúng hàng, hàng vừa Approve đã rời`, sameRows(await readRows(S), exactRows(n1, S.st, PAGE)));
    // d. Status "Tất cả": như hôm nay, hàng ở lại và đổi chữ tại chỗ
    await act(S, () => pickStatus(S, "Tất cả"));
    await settle(S, hien(0, ROWS.length));
    const all0 = await readRows(S);
    const i = all0.findIndex((g) => ROWS[g.n - 1].approvable && !ROWS[g.n - 1].override && g.status === LABEL[ROWS[g.n - 1].group]); // hàng đầu có nút Approve, chưa chờ
    const nm = all0[i].name;
    await S.table.locator("tbody tr").nth(i).getByRole("button", { name: "Approve", exact: true }).click();
    await S.page.waitForFunction(([k, n]) => document.querySelectorAll("tbody tr")[k].innerText.includes("Chờ Capu") && document.querySelectorAll("tbody tr")[k].innerText.includes(n), [i, nm]);
    const all1 = await readRows(S);
    R.check('Status "Tất cả": Approve xong hàng ở nguyên chỗ, chữ Status đổi thành "Chờ Capu", tổng không đổi', all1[i].name === nm && all1[i].status === "Chờ Capu" && (await total()) === ROWS.length && all1.length === all0.length, brief([all1[i]]));
    R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, S.external);
    await S.ctx.close();

    // e. trang cuối chỉ còn một hàng: Rút lại hàng đó -> không rơi vào trang trống
    const B = await scenario("big");
    await settle(B, hien(0, ROWS.length));
    await act(B, () => pickStatus(B, "Chờ Capu"));
    await settle(B, hien(0, 51));
    await act(B, () => B.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(B, hien(PAGE, 51));
    const lastRow = (await readRows(B))[0];
    R.check('trang 2 của "Chờ Capu": đúng 1 hàng, STT 51, "Hiển thị 51–51 / 51"', lastRow?.n === 51 && (await B.table.locator("tbody tr").count()) === 1, lastRow);
    await act(B, () => B.table.locator("tbody tr").first().getByRole("button", { name: "Rút lại" }).click());
    await settle(B, hien(0, 50));
    const gotB = await readRows(B);
    R.check('Rút lại hàng cuối: về trang còn hàng, "Hiển thị 1–50 / 50", 50 hàng đều "Chờ Capu", không có bảng trống', gotB.length === 50 && gotB.every((g) => g.status === "Chờ Capu") && !(await bodyHas(B, "Không có vendor nào khớp bộ lọc.")), [gotB.length, await pagerText(B)]);
    await B.ctx.close();

    // f. từ 3 trang trở lên: đang ở trang cuối (1 hàng), Rút lại -> về trang cuối còn hàng (trang 2), KHÔNG về trang 1
    const C = await scenario("big3");
    await settle(C, hien(0, ROWS.length));
    await act(C, () => pickStatus(C, "Chờ Capu"));
    await settle(C, hien(0, 101));
    await act(C, () => C.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(C, hien(PAGE, 101));
    await act(C, () => C.page.getByRole("button", { name: "Trang sau" }).click());
    await settle(C, hien(2 * PAGE, 101));
    const r101 = await readRows(C);
    R.check('trang 3 của "Chờ Capu": đúng 1 hàng, STT 101', r101.length === 1 && r101[0].n === 101, r101);
    await act(C, () => C.table.locator("tbody tr").first().getByRole("button", { name: "Rút lại" }).click());
    await settle(C, hien(PAGE, 100));
    const g100 = await readRows(C);
    R.check('Rút lại hàng 101: về trang 2 ("Hiển thị 51–100 / 100", STT 51..100), không về trang 1, không bảng trống', g100.length === 50 && g100[0].n === 51 && g100[49].n === 100 && g100.every((g) => g.status === "Chờ Capu"), [g100.length, g100[0]?.n, await pagerText(C)]);
    await C.ctx.close();
  }
} catch (e) {
  R.check("thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu, hoặc bảng không đổi như spec)", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
