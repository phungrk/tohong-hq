#!/usr/bin/env python3
"""T-053 tiêu chí 4 (kiểm tĩnh, vì chờ cố định/cổng bốc ngẫu nhiên chỉ đỏ khi máy chậm hoặc trùng cổng, không dựng ổn định được trong một lần chạy).
Đây là kiểm HÌNH THỨC, không phải quy ước đặt tên: mọi cách viết đúng đều phải xanh (v3, sửa D2). Việc đo chạy trên mã đã bỏ comment bằng một bộ quét biết chuỗi '…' "…" `…` (kể cả ${…} lồng),
literal regex, comment dòng và comment khối (hàm code()), nên `/api/*` trong comment dòng hay '…/**' trong chuỗi không nuốt mã.
SÁU file tiêu thụ (C9, C10, T-066 check_ui, T-068 _advlib, hai lib bất biến vendor-images) đều phải:
  (1) có require/import tới module vite_dev (đường dẫn literal hoặc hằng trong cùng file; tên biến, destructure đổi tên, `vd.startViteDev(` đều được) và có nhắc tới startViteDev;
  (2) không spawn npx / npm exec / `.bin/vite` trực tiếp;
  (3) không bốc cổng bằng Math.random gần chữ 'port' và không có dải cổng cố định + ngẫu nhiên. C9, C10 thêm: không còn waitForTimeout.
Helper phải có và, đo sau khi bỏ comment: chạy node_modules/.bin/vite, cổng từ listen(0), detached + kill nhóm, bắt SIGINT/SIGTERM/SIGHUP, ghi và XOÁ file __nonce-*, truyền toàn bộ env của tiến trình cha xuống vite con.
Phần "nonce có kiểm thật", "env thật sự tới vite" KHÔNG kiểm bằng chữ mà bằng hành vi: check_6.
ĐỐI CHỨNG DƯƠNG: trước khi đo file thật, chạy selftest (hàm selftest()): các bản viết đúng theo nhiều dạng phải PASS, các bản sai phải FAIL; selftest hỏng = FAIL (bộ kiểm hỏng, không đổ cho file).
Chạy: python3 check_4_cho_theo_dieu_kien.py [--selftest]. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h

def _scan(s, i, in_tpl_expr):
    """Quét mã JS từ vị trí i; trả (mã đã bỏ comment, vị trí kết thúc). Chuỗi giữ nguyên, comment thành khoảng trắng (giữ xuống dòng).
    in_tpl_expr: đang trong ${ … } của template, dừng ở dấu } khớp."""
    out = []; n = len(s); prev = ""; depth = 0
    while i < n:
        c = s[i]; d = s[i + 1] if i + 1 < n else ""
        if c == "/" and d == "/":
            j = s.find("\n", i); i = n if j < 0 else j; continue
        if c == "/" and d == "*":
            j = s.find("*/", i + 2); j = n if j < 0 else j + 2
            out.append(" " + "\n" * s.count("\n", i, j)); i = j; continue
        if c in "'\"":
            j = i + 1
            while j < n and s[j] != c and s[j] != "\n":
                j += 2 if s[j] == "\\" else 1
            out.append(s[i:j + 1]); i = j + 1; prev = c; continue
        if c == "`":
            out.append("`"); i += 1
            while i < n and s[i] != "`":
                if s[i] == "\\": out.append(s[i:i + 2]); i += 2; continue
                if s[i] == "$" and i + 1 < n and s[i + 1] == "{":
                    sub, i = _scan(s, i + 2, True); out.append("${" + sub + "}"); i += 1; continue
                out.append(s[i]); i += 1
            out.append("`"); i += 1; prev = "`"; continue
        if c == "/" and (prev == "" or prev in "(,=:[!&|?{};+-*%<>~^"):      # literal regex
            j = i + 1; cls = False
            while j < n and s[j] != "\n":
                if s[j] == "\\": j += 2; continue
                if s[j] == "[": cls = True
                elif s[j] == "]": cls = False
                elif s[j] == "/" and not cls: break
                j += 1
            if j < n and s[j] == "/": out.append(s[i:j + 1]); i = j + 1; prev = "/"; continue
        if in_tpl_expr:
            if c == "{": depth += 1
            elif c == "}":
                if depth == 0: return "".join(out), i
                depth -= 1
        out.append(c)
        if not c.isspace(): prev = c
        i += 1
    return "".join(out), i

def strip(s): return _scan(s, 0, False)[0]
def code(path): return strip(open(path, encoding="utf-8").read())

def consumer_problems(s, strict_wait):
    """s = mã đã bỏ comment. Trả danh sách lỗi."""
    bad = []
    has_path = re.search(r"""(['"`])[^'"`\n]*vite_dev[^'"`\n]*\1""", s) and re.search(r"\brequire\b|\bimport\b", s)
    if not has_path or not re.search(r"\bstartViteDev\b", s): bad.append("chưa require/import module vite_dev (đường dẫn literal hoặc hằng) và dùng startViteDev")
    if re.search(r"""(['"`])npx\1|\bnpx\s+vite|npm\s+exec|(?:spawn|spawnSync|execFile|execFileSync|fork)\s*\([^;\n]{0,160}?(?:\.bin/vite|['"`]vite['"`])""", s, re.I): bad.append("còn spawn npx / npm exec / vite trực tiếp")
    if re.search(r"(?:\bport\b|\w*Port\b|\bport[A-Z_]\w*|\w+_port\b)[^;\n]{0,80}Math\.random|Math\.random[^;\n]{0,80}(?:\bport\b|\w*Port\b|\bport[A-Z_]\w*|\w+_port\b)|\b[5-9]\d{3}\s*\+\s*Math\.|Math\.random\(\)[^;\n]{0,40}\+\s*[5-9]\d{3}\b", s): bad.append("còn bốc cổng bằng Math.random / dải cổng cố định")
    if strict_wait and (n := len(re.findall(r"waitForTimeout\s*\(", s))): bad.append(f"còn {n} chỗ waitForTimeout")
    return bad

def helper_problems(s):
    bad = []
    for pat, why in ((r"\.bin/vite|\.bin['\"`]\s*,\s*['\"`]vite", "chạy node_modules/.bin/vite"), (r"listen\(\s*0", "lấy cổng bằng listen(0)"), (r"detached\s*:\s*true", "detached: true"),
                     (r"kill\(\s*-", "kill cả nhóm process.kill(-pid"), (r"SIGINT", "bắt SIGINT"), (r"SIGTERM", "bắt SIGTERM"), (r"SIGHUP", "bắt SIGHUP"),
                     (r"__nonce", "ghi file __nonce-*"), (r"unlink|rmSync|\.rm\(", "xoá file nonce/file thử khi dừng"), (r"startViteDev", "xuất startViteDev")):
        if not re.search(pat, s): bad.append(f"helper thiếu: {why}")
    if re.search(r"""['"`]npx['"`]|math\.random.*port|port.*math\.random""", s, re.I): bad.append("helper còn npx / bốc cổng Math.random")
    if re.search(r"\benv\s*:", s) and not re.search(r"process\.env(?![\w.\[])", s): bad.append("helper đặt env: cho vite con mà không truyền toàn bộ process.env (làm mất dấu T053_RUN)")
    return bad

# ---- đối chứng dương / âm cho chính bộ kiểm ----
_TOP = "const fs = require('fs'), path = require('path'), http = require('http');\nconst { chromium } = require('playwright');\n"
_NOISE = """// chặn /api/*, ảnh ngoài (comment dòng có dấu sao)
const REPO = path.resolve(process.argv[2]);
async function newPage(b, port) {
  const pg = await b.newPage();
  await pg.route('http://localhost:8787/**', r => r.fulfill({ status: 200, body: '{}' }));   // chuỗi chứa /**
  if (/['"]x/.test(pg.url())) {}
  const tag = Math.random().toString(36).slice(2), t = `a ${ `b${tag}` } c`;
  return pg;
}
/* comment khối: cp.spawn('npx', ['vite']) và port = 5100 + Math.random() chỉ là lời văn */
"""
_RUN = "(async () => {\n  %s\n  const b = await chromium.launch(); await newPage(b, port);\n})();\n"
_GOOD_CALL = "const dev = await startViteDev({ repo: REPO, files: {} }); const port = dev.port;"
GOOD = {
 "require ở đầu file cạnh require cũ": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % _GOOD_CALL,
 "đường dẫn qua hằng": _TOP + "const VD = path.join(__dirname, '..', '_lib', 'vite_dev.cjs');\nconst { startViteDev } = require(VD);\n" + _NOISE + _RUN % _GOOD_CALL,
 "destructure đổi tên": _TOP + "const { startViteDev: svd } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % "const dev = await svd({ repo: REPO, files: {} }); const port = dev.port;",
 "gán module rồi gọi vd.startViteDev": _TOP + "const vd = require(path.resolve(__dirname, '../_lib/vite_dev.cjs'));\n" + _NOISE + _RUN % "const dev = await vd.startViteDev({ repo: REPO, files: {} }); const port = dev.port;",
 "require nằm trong hàm main (sau comment /api/*)": _TOP + _NOISE + _RUN % ("const { startViteDev } = require('../_lib/vite_dev.cjs');\n  " + _GOOD_CALL),
 "import ESM": "import fs from 'fs';\nimport { startViteDev } from '../_lib/vite_dev.mjs';\n" + _NOISE + _RUN % _GOOD_CALL,
 "waitForTimeout chỉ trong comment": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n// bỏ pg.waitForTimeout(2500) cũ\n" + _NOISE + _RUN % _GOOD_CALL,
}
BAD = {
 "còn spawn npx sau một chuỗi '…/**' (vùng mà regex cũ nuốt)": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\nconst P = async pg => { await pg.route('http://localhost:8787/**', r => r.abort()); };\nasync function g() { const v = cp.spawn('npx', ['vite', '--port', '5300']); }\n/* c */\n" + _RUN % _GOOD_CALL,
 "còn spawn npx sau comment dòng /api/*": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n// chặn /api/*\nasync function g() { vite = cp.spawn(\"npx\", ['vite']); }\n/* c */\n" + _RUN % _GOOD_CALL,
 "bốc cổng Math.random": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % "const port = 5200 + Math.floor(Math.random() * 500); await startViteDev({ repo: REPO, files: {} });",
 "bốc cổng Math.random trước, +dải sau": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % "let vitePort = Math.floor(Math.random() * 500) + 5200; await startViteDev({ repo: REPO, files: {} });",
 "không dùng helper": _TOP + _NOISE + _RUN % "const port = 1; /* không có gì */",
 "chỉ nhắc vite_dev trong comment": _TOP + "// const { startViteDev } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % "const port = 1;",
 "spawn thẳng .bin/vite": _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % "vite = cp.spawn(path.join(REPO, 'node_modules/.bin/vite'), ['--port', '1']); " + _GOOD_CALL,
 "require đúng nhưng không dùng startViteDev": _TOP + "const vd = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % "const port = 1;",
}
BAD_WAIT = _TOP + "const { startViteDev } = require('../_lib/vite_dev.cjs');\n" + _NOISE + _RUN % (_GOOD_CALL + " await pg.waitForTimeout(2500);")
_HGOOD = """const cp = require('child_process'), net = require('net'), fs = require('fs');
function startViteDev(o) { const s = net.createServer(); s.listen(0); const c = cp.spawn(o.repo + '/node_modules/.bin/vite', [], { detached: true, env: { ...process.env } });
  fs.writeFileSync('__nonce-1.txt', 'x'); for (const g of ['SIGINT','SIGTERM','SIGHUP']) process.on(g, () => { process.kill(-c.pid, 'SIGKILL'); fs.unlinkSync('__nonce-1.txt'); }); }
module.exports = { startViteDev };
// env: { PATH: process.env.PATH } trong comment không tính
"""
HELPER_GOOD = {"env spread": _HGOOD, "không đặt env": _HGOOD.replace("env: { ...process.env }", "stdio: 'ignore'")}
HELPER_BAD = {"env chỉ PATH": _HGOOD.replace("env: { ...process.env }", "env: { PATH: process.env.PATH }"), "thiếu SIGHUP": _HGOOD.replace("'SIGHUP'", "'SIGUSR2'"),
              "còn npx": _HGOOD + "cp.spawn('npx', ['vite']);\n"}

def selftest():
    errs = []
    for name, src in GOOD.items():
        for strict in (False, True):
            p = consumer_problems(strip(src), strict)
            if p: errs.append(f"bản đúng '{name}' (strict_wait={strict}) bị báo đỏ oan: {p}")
    for name, src in BAD.items():
        if not consumer_problems(strip(src), False): errs.append(f"bản sai '{name}' lọt qua (đáng ra FAIL)")
    if not consumer_problems(strip(BAD_WAIT), True): errs.append("bản còn waitForTimeout lọt qua với C9/C10")
    for name, src in HELPER_GOOD.items():
        p = helper_problems(strip(src))
        if p: errs.append(f"helper đúng '{name}' bị báo đỏ oan: {p}")
    for name, src in HELPER_BAD.items():
        if not helper_problems(strip(src)): errs.append(f"helper sai '{name}' lọt qua")
    # bộ bỏ comment không nuốt mã
    t = strip("// chặn /api/*\nconst a = require('x'); const u = 'h/**'; /* k */ const z = 1;\nconst r = /['\"]\\/\\*/; const q = 2;")
    for want in ("const a = require('x')", "'h/**'", "const z = 1", "const q = 2"):
        if want not in t: errs.append(f"strip() nuốt mất: {want!r}")
    for gone in ("chặn", "/* k */"):
        if gone in t: errs.append(f"strip() giữ lại comment: {gone!r}")
    return errs

errs = selftest()
if errs: print("FAIL selftest check_4 (bộ kiểm hỏng, chưa đo file thật): " + " | ".join(errs)); sys.exit(1)
if "--selftest" in sys.argv: print("PASS selftest check_4"); sys.exit(0)

bad = []
CONSUMERS = [("C9", h.C9), ("C10", h.C10)] + [(f, os.path.join(h.HQ, f)) for f in (
    "eval/T-066/check_ui.cjs", "eval/T-068/_advlib.cjs",
    "eval/invariants/planner/front/vendor-images/lib/vendor_img_inv.cjs",
    "eval/invariants/planner/front/vendor-images/lib/small_tile_tooltip.cjs")]
for name, f in CONSUMERS:
    for why in consumer_problems(code(f), name in ("C9", "C10")): bad.append(f"{name} {why}")
H = os.path.join(h.HQ, "eval/_lib/vite_dev.cjs")
if not os.path.isfile(H): bad.append("chưa có eval/_lib/vite_dev.cjs")
else: bad += helper_problems(code(H))
if bad: print("FAIL " + "; ".join(bad)); sys.exit(1)
print("PASS sáu file tiêu thụ dùng helper, không npx/Math.random/waitForTimeout; helper đủ tính chất tĩnh")
