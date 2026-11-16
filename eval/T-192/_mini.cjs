'use strict';
/* T-192: trợ giúp chung cho eval thẻ ngân sách trong chat (ChatBudgetMini). Dùng khung eval/T-187/_lib.cjs (trang __t187c.html).
 * Chỉ đo chữ nhìn thấy và hình nhìn thấy; không đọc mã nguồn. Hàng hạng mục = phần tử nhỏ nhất chứa tên hạng mục và có nút số tiền. */
const E = require('../T-187/_lib.cjs');
const rows = (pg, names) => pg.evaluate((names) => {
  const out = {};
  for (const n of names) {
    const leaf = [...document.querySelectorAll('span,div')].filter((e) => e.children.length <= 2 && (e.innerText || '').trim() === n || ((e.innerText || '').includes(n) && !e.querySelector('div') && e.tagName === 'SPAN')).sort((a, b) => a.innerText.length - b.innerText.length)[0];
    let el = leaf; while (el && !el.querySelector('button') && el.parentElement) el = el.parentElement;
    out[n] = el && el.querySelector('button') ? { text: el.innerText.replace(/\s+/g, ' ').trim(), btn: el.querySelector('button').innerText.replace(/\s+/g, ' ').trim() } : null;
  }
  return out;
}, names);
/* "tr" đứng riêng (không đi sau số): "tr", "tr–5tr", " tr". Chữ cái có dấu như "trước" không tính. */
const BARE_TR = /(?<![\p{L}\p{N}])tr(?![\p{L}\p{N}])/u;
const waitCard = (pg) => pg.waitForFunction(() => /Phân bổ/.test(document.body.innerText) && document.querySelectorAll('button').length > 0, null, { timeout: 15000 });
module.exports = { E, rows, BARE_TR, waitCard };
