'use strict';
/* T-194: trợ giúp chung cho eval màn Ngân sách khi allocated_tr rỗng/không phải số. Dùng khung eval/T-187/_lib.cjs (trang __t187b.html = màn Ngân sách thật, __t187c.html = thẻ ngân sách chat).
 * Chỉ đo chữ nhìn thấy, thanh trượt (aria) và thân PUT ra mạng; không đọc mã nguồn.
 * Số của một hạng mục = Number(x) || 0, đúng cách đọc của thẻ ngân sách chat (ADR-120): chuỗi số ("20", "3.4", " 7 ") là số; rỗng, null, bỏ khuyết, "abc", "20,5", "20tr" = 0. */
const path = require('path');
const E = require('../T-187/_lib.cjs');
const { rows, waitCard } = require('../T-192/_mini.cjs');
/* "tr" đứng riêng (không đi sau số, không dính chữ cái): "ĐÃ PHÂN BỔ tr", "Còn tr", "abc tr". "trước", "triệu" không tính. */
const BARE_TR = /(?<![\p{L}\p{N}])tr(?![\p{L}\p{N}])/u;
const BAD_WORD = /undefined|NaN|Infinity|\bnull\b|abc/;
const waitText = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re, { timeout: 15000 });
/* Số hạng mục theo quy tắc trên */
const val = (x) => Number(x) || 0; /* y hệt thẻ chat (cards.jsx: Number(x) || 0): "20,5" -> 0, " 7 " -> 7, "20tr" -> 0. Infinity ngoài phạm vi, không đo. */
/* Chữ của hàng hạng mục ở tổng quan Ngân sách: nút chứa tên; trả { text, amt } với amt = chữ ngay sau tên và kết thúc bằng "tr". */
const listRow = (pg, name) => pg.evaluate((name) => {
  const b = [...document.querySelectorAll('button')].filter((e) => (e.innerText || '').split('\n')[0].trim() === name)[0];
  if (!b) return null;
  const t = b.innerText.replace(/\s+/g, ' ').trim();
  const m = t.slice(name.length).trim().match(/^(\S*?)tr(?![\p{L}\p{N}])/u);
  return { text: t, amt: m ? m[1] + 'tr' : null };
}, name);
/* Ba ca dữ liệu dùng chung. Dự toán cố ý trộn: rỗng, null, "abc", chuỗi số, số. */
const MIX = [['photography', 'Chụp ảnh', ''], ['venue', 'Tiệc & nhà hàng', 'abc'], ['jewelry', 'Nhẫn cưới & trang sức', 30], ['attire', 'Trang phục', '20'], ['reserve', 'Dự phòng', null]];
const MIX2 = [['photography', 'Chụp ảnh', '20,5'], ['venue', 'Tiệc & nhà hàng', ' 7 '], ['jewelry', 'Nhẫn cưới & trang sức', '20tr'], ['attire', 'Trang phục', '3.4'], ['reserve', 'Dự phòng', '']]; /* ca cách đọc số: hai nơi phải cùng số (0, 7, 0, 3,4, 0) */
module.exports = { MIX2, E, rows, waitCard, BARE_TR, BAD_WORD, waitText, val, listRow, MIX };
