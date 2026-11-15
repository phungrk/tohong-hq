#!/usr/bin/env node
/* T-174 adversary 02 (tohong-front, spec T-171 H5): lưu dự toán LỖI rồi chốt vendor (VendorCtx.syncBudgetItem ghi xen, thành công) KHÔNG được làm mất im lặng số cặp đôi vừa chỉnh.
 * Input: kéo Dự toán Tiệc cưới 90 -> 40, lần tự lưu lỗi 500 (màn báo "Chưa lưu được dự toán"); mạng tốt lại; bấm "Chốt" Alpha Hall ở danh sách vendor đã lưu của hạng mục
 * (cùng màn). syncBudgetItem GET bản server (90) + thêm khoản vendor rồi PUT, onBudgetSync làm màn tải lại bản server.
 * Mong đợi (H5: "Số cặp đôi vừa chỉnh KHÔNG bị tự trả về số cũ (không làm mất việc vừa làm)"; câu báo là dấu số chưa lưu): sau đó HOẶC server đã có 40,
 * HOẶC màn còn hiện 40 kèm "Chưa lưu được dự toán". Đỏ khi: màn hiện 90, server 90, không còn câu báo (số 40 mất mà không ai biết).
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-02-luu-loi-roi-chot-vendor-khong-mat-so.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
runAdv(async ({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep }) => {
  D.putFail = '500';
  await dragTo(pg, 40);
  if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('khung: lưu lỗi phải hiện "Chưa lưu được dự toán"'); return; }
  D.putFail = null; const p0 = D.puts.length;
  await pg.getByRole('button', { name: 'Chốt', exact: true }).first().click();
  await waitFor(async () => D.puts.length > p0 && (venue().items || []).some((it) => it.id === 'vendor_t171_a'));
  await sleep(1500); // màn tải lại sau onBudgetSync
  const items = (venue().items || []).map((it) => it.id);
  if (!items.includes('vendor_t171_a')) bad('khung: chốt vendor phải ghi khoản vendor_t171_a lên server, thấy ' + JSON.stringify(items));
  const sv = venue().allocated_tr, sl = await slider(), banner = /Chưa lưu được dự toán/.test(await body());
  if (sv !== 40 && !(sl === 40 && banner)) bad(`số 40 vừa chỉnh bị mất im lặng: server ${sv}, thanh Dự toán ${sl}, câu báo "Chưa lưu được dự toán" ${banner ? 'còn' : 'KHÔNG còn'} (H5: không tự trả về số cũ)`);
});
