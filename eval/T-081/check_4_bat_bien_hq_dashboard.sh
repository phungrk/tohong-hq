#!/usr/bin/env bash
# T-081 tiêu chí 2 (brief: INV-006..009 hq/dashboard vẫn xanh), chạy trên sổ cái và trang thật. Lưu ý: INV-009 hiện từ chối URL .../issues/<n>; nó chỉ xanh khi bất biến đã được Chief of Staff đổi
# theo bản đề xuất eval/T-081/inv-draft-009/ (xem spec mục Bất biến) -> đỏ ở đây trước khi sửa là đúng chủ ý, không sửa eval cho khớp.
# Chạy: cd /home/user/tohong-hq && bash eval/T-081/check_4_bat_bien_hq_dashboard.sh   (PASS / FAIL <lý do>)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"; D="$ROOT/eval/invariants/hq/dashboard"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; fail=0
for f in "$D"/inv-006-*.sh "$D"/inv-007-*.sh "$D"/inv-008-*.py "$D"/inv-009-*.sh; do
  case "$f" in *.py) out="$(python3 "$f" 2>&1)";; *) out="$(bash "$f" 2>&1)";; esac; rc=$?
  last="$(printf '%s\n' "$out" | tail -1)"
  if [ $rc -ne 0 ] || ! printf '%s' "$last" | grep -q '^PASS'; then echo "FAIL $(basename "$f"): $(printf '%s\n' "$out" | grep -m1 '^FAIL' | cut -c1-200)"; fail=1; fi
done
# INV-009 phải chấp nhận URL issue của chính repo sổ cái (cả bản kiểm export lẫn bản kiểm trang), và vẫn từ chối URL lạ
python3 - "$D/inv-009-link-capu-an-toan-cong-khai-khong-ro.sh" "$D/lib/link_capu_inv.cjs" <<'PY' || fail=1
import re, sys
sh = open(sys.argv[1], encoding="utf-8").read(); js = open(sys.argv[2], encoding="utf-8").read()
py_re = re.compile(re.search(r'OK = re\.compile\(r"(.+?)"\)', sh).group(1))
js_src = re.search(r"const OK = /(.+)/;", js).group(1)
js_re = re.compile(js_src.replace("\\/", "/"))
good = ["https://github.com/phungrk/tohong-hq/issues/16", "https://github.com/phungrk/tohong-hq/issues/1234"]
bad = ["https://github.com/phungrk/tohong-hq/issues/16#issuecomment-1", "https://github.com/phungrk/tohong-hq/issues/0x", "https://github.com/phungrk/tohong-hq/issues/", "https://github.com/phungrk/tohong-hq/issues/16/x", "https://github.com.evil.io/phungrk/tohong-hq/issues/16", "http://github.com/phungrk/tohong-hq/issues/16"]
err = [f"INV-009 ({n}) chưa chấp nhận {u}" for n, r in (("export", py_re), ("trang", js_re)) for u in good if not r.match(u)]
err += [f"INV-009 ({n}) lại chấp nhận {u}" for n, r in (("export", py_re), ("trang", js_re)) for u in bad if r.match(u)]
for e in err: print("FAIL " + e)
sys.exit(1 if err else 0)
PY
[ $fail -eq 0 ] && echo PASS; exit $fail
