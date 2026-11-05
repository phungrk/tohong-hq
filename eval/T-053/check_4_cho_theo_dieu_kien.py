#!/usr/bin/env python3
"""T-053 tiêu chí 4 (kiểm tĩnh, vì chờ cố định/cổng bốc ngẫu nhiên chỉ đỏ khi máy chậm hoặc trùng cổng, không dựng ổn định được trong một lần chạy):
SÁU file tiêu thụ (C9, C10, T-066 check_ui, T-068 _advlib, hai lib bất biến vendor-images) đều phải: gọi helper eval/_lib/vite_dev.cjs (require + startViteDev(, đo sau khi bỏ comment, không phân biệt hoa thường);
không spawn npx / npm exec; không bốc cổng bằng Math.random gần chữ 'port' và không có dải cổng cố định + ngẫu nhiên. C9, C10 thêm: không còn waitForTimeout.
Helper phải có và, đo sau khi bỏ comment: chạy node_modules/.bin/vite, cổng từ listen(0), detached + kill nhóm, bắt SIGINT/SIGTERM/SIGHUP, ghi và XOÁ file __nonce-*, truyền env của tiến trình cha xuống vite con (không đặt env: mà thiếu process.env).
Phần "nonce có kiểm thật" KHÔNG kiểm bằng chữ 'nonce' mà bằng hành vi: check_6. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
bad = []

def code(path):
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.S)          # comment khối
    s = re.sub(r"(^|[^:\w'\"`])//[^\n]*", r"\1", s)        # comment dòng (không đụng http://)
    return s

CONSUMERS = [("C9", h.C9), ("C10", h.C10)] + [(f, os.path.join(h.HQ, f)) for f in (
    "eval/T-066/check_ui.cjs", "eval/T-068/_advlib.cjs",
    "eval/invariants/planner/front/vendor-images/lib/vendor_img_inv.cjs",
    "eval/invariants/planner/front/vendor-images/lib/small_tile_tooltip.cjs")]
for name, f in CONSUMERS:
    s = code(f)
    if not re.search(r"require\([^)]*vite_dev", s, re.I) or not re.search(r"startViteDev\s*\(", s, re.I): bad.append(f"{name} chưa require vite_dev và gọi startViteDev(")
    if re.search(r"['\"`]npx['\"`]|\bnpx\s+vite|npm\s+exec", s, re.I): bad.append(f"{name} còn gọi npx/npm exec")
    if re.search(r"port[^;\n]{0,80}Math\.random|Math\.random[^;\n]{0,80}port|\b[5-9]\d{3}\s*\+\s*Math\.", s, re.I): bad.append(f"{name} còn bốc cổng bằng Math.random / dải cổng cố định")
    if name in ("C9", "C10") and (n := len(re.findall(r"waitForTimeout\(", s))): bad.append(f"{name} còn {n} chỗ waitForTimeout")

H = os.path.join(h.HQ, "eval/_lib/vite_dev.cjs")
if not os.path.isfile(H): bad.append("chưa có eval/_lib/vite_dev.cjs")
else:
    s = code(H)
    for pat, why in ((r"\.bin/vite|\.bin['\"`]\s*,\s*['\"`]vite", "chạy node_modules/.bin/vite"), (r"listen\(\s*0", "lấy cổng bằng listen(0)"), (r"detached\s*:\s*true", "detached: true"),
                     (r"kill\(\s*-", "kill cả nhóm process.kill(-pid"), (r"SIGINT", "bắt SIGINT"), (r"SIGTERM", "bắt SIGTERM"), (r"SIGHUP", "bắt SIGHUP"),
                     (r"__nonce", "ghi file __nonce-*"), (r"unlink|rmSync|\.rm\(", "xoá file nonce/file thử khi dừng"), (r"startViteDev", "xuất startViteDev")):
        if not re.search(pat, s): bad.append(f"helper thiếu: {why}")
    if re.search(r"['\"`]npx['\"`]|math\.random.*port|port.*math\.random", s, re.I): bad.append("helper còn npx / bốc cổng Math.random")
    if re.search(r"\benv\s*:", s) and "process.env" not in s: bad.append("helper đặt env: cho vite con mà không truyền process.env (làm mất dấu T053_RUN)")
if bad: print("FAIL " + "; ".join(bad)); sys.exit(1)
print("PASS sáu file tiêu thụ dùng helper, không npx/Math.random/waitForTimeout; helper đủ tính chất tĩnh")
