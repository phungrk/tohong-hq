#!/usr/bin/env node
// T-197 (repo tohong-front, chạy cùng worker thật của tohong-back): bộ lọc Status của bảng "Bảng enrich vendor" trong admin.
// Chạy: cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-197/check_ui.mjs --repo . --case 1|2|3|4 [--dist DIR]
// Đo CHỮ người dùng thấy (ô chọn tên "Status", chữ ở cột "Status", chữ "Hiển thị a–b / N", nút) ; không đọc mã nguồn, không bám class.
// Dữ liệu: báo cáo nhúng thật của tohong-back + review gieo qua API thật (lib/common.mjs). Trang gọi API thật qua worker, nên front và back phải cùng đúng.
//  case 1: ô chọn có đúng 13 lựa chọn, mặc định "Tất cả" như hôm nay (tiêu chí 1)
//  case 2: mỗi giá trị Status: mọi hàng ở mọi trang có đúng Status đó, số tổng khớp, đúng thứ tự (tiêu chí 2)
//  case 3: kết hợp AND với chip / Hạng mục / ô tìm; về trang 1 khi đổi; số đếm chip và dòng đầu không đổi (tiêu chí 3)
//  case 4: sau Approve / Rút lại / Sửa thủ công khi đang lọc: bảng khớp lại; không trang trống (tiêu chí 6)
import { REPO, CASE, scenario, readRows, pagerText, hien, settle, pickStatus, readAllPages, chipNames, act, closeAll, PAGE, CHIPS, STATUS, LABEL, shown } from "./lib/ui.mjs";
import { ROWS, expected, reporter, outbound, fold } from "./lib/common.mjs";

const R = reporter();
const GROUP_KEYS = new Set(STATUS.slice(0, 9).map(([k]) => k));
const OPTIONS = ["Tất cả", ...STATUS.map(([, l]) => l)];
const exactRows = (want, st, off = 0) => want.slice(off, off + PAGE).map((r, i) => ({ n: off + i + 1, name: r.name, status: shown(r, st) }));
const sameRows = (got, want) => got.length === want.length && got.every((g, i) => g.n === want[i].n && g.name === want[i].name && g.status === want[i].status);
const brief = (rows) => JSON.stringify(rows.slice(0, 2));
const bodyHas = async (S, s) => (await S.page.locator("body").innerText()).includes(s);
try {
  if (CASE === "1") {
    const S = await scenario();
    R.check('có đúng một ô chọn (combobox) tên "Status"', (await S.select.count()) === 1, await S.select.count());
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
    // f. số đếm chip và dòng đầu bảng không đổi theo Status
    R.check("số trên 5 chip không đổi theo Status", JSON.stringify(await chipNames(S)) === JSON.stringify(chips0), [await chipNames(S), chips0]);
    R.check('dòng "<N> vendor · enrich lần cuối …" không đổi theo Status', (await S.page.locator("body").innerText()).includes(summary0), summary0);
    R.check("không request ra ngoài", S.external.length === 0 && outbound.length === 0, S.external);
  }

  if (CASE === "4") {
    const S = await scenario();
    await settle(S, hien(0, ROWS.length));
    const rowBy = (name) => S.table.locator("tbody tr").filter({ hasText: name }).first();
    const total = async () => Number((await pagerText(S)).match(/\/ (\d+)$/)[1]);
    // a. đang lọc "Tên hơi giống": Approve -> hàng biến mất, tổng -1; sang "Chờ Capu" thì thấy nó
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    const w0 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(0, w0.length));
    const first = (await readRows(S))[0];
    await act(S, () => S.table.locator("tbody tr").first().getByRole("button", { name: "Approve", exact: true }).click());
    S.st.set(w0[0].id, { byCapu: false });
    const w1 = expected(S.st, { status: "name_similar" });
    await settle(S, hien(0, w1.length));
    const got1 = await readRows(S);
    R.check(`đang lọc "Tên hơi giống": Approve xong hàng "${first.name}" biến khỏi bảng và tổng giảm 1 (${w0.length} -> ${w1.length})`, sameRows(got1, exactRows(w1, S.st)) && !got1.some((g) => g.name === first.name && g.n === 1 && g.status !== "Tên hơi giống"), brief(got1));
    R.check('mọi hàng còn hiện vẫn có chữ Status "Tên hơi giống" (không hàng "Chờ Capu" nằm lại)', got1.every((g) => g.status === "Tên hơi giống"), got1.find((g) => g.status !== "Tên hơi giống"));
    await act(S, () => pickStatus(S, "Chờ Capu"));
    const w2 = expected(S.st, { status: "pending_capu" });
    await settle(S, hien(0, w2.length));
    const got2 = await readAllPages(S, w2.length);
    R.check(`"Chờ Capu": có hàng vừa Approve, tổng ${w2.length}, mọi hàng "Chờ Capu"`, sameRows(got2, exactRows(w2, S.st)) && got2.some((g) => g.name === first.name), brief(got2));
    // b. đang lọc "Chờ Capu": Rút lại -> hàng biến mất
    await act(S, () => rowBy(first.name).getByRole("button", { name: "Rút lại" }).click());
    S.st.delete(w0[0].id);
    const w3 = expected(S.st, { status: "pending_capu" });
    await settle(S, hien(0, w3.length));
    const got3 = await readRows(S);
    R.check(`đang lọc "Chờ Capu": Rút lại xong hàng biến khỏi bảng, tổng ${w2.length} -> ${w3.length}`, sameRows(got3, exactRows(w3, S.st)) && !got3.some((g) => g.name === first.name), brief(got3));
    await act(S, () => pickStatus(S, "Tên hơi giống"));
    await settle(S, hien(0, w0.length));
    R.check('quay lại "Tên hơi giống": hàng đó về chỗ cũ (STT 1), tổng như ban đầu', sameRows(await readRows(S), exactRows(w0, S.st)));
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
    R.check(`đang lọc "Enrich 100%": Sửa thủ công xong hàng "${f0[fi].name}" biến khỏi bảng, tổng ${f0.length} -> ${f1.length}`, sameRows(gotF, exactRows(f1, S.st)) && !gotF.some((g) => g.name === f0[fi].name), brief(gotF));
    // d. Status "Tất cả": như hôm nay, hàng ở lại và đổi chữ tại chỗ
    await act(S, () => pickStatus(S, "Tất cả"));
    await settle(S, hien(0, ROWS.length));
    const all0 = await readRows(S);
    const i = all0.findIndex((g) => g.status === "Tên hơi giống");
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
  }
} catch (e) {
  R.check("thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu, hoặc bảng không đổi như spec)", false, String(e.message).split("\n")[0]);
}
await closeAll();
R.done();
