#!/usr/bin/env bash
# Eval đối kháng T-143 (adversary, tầng 3): test T037 (test/test_admin.js) bị viết lại ở T-143 vẫn đo đúng ý cũ (FR-034: vendor admin ẩn không vào chat;
# overlay chưa từng nạp → không lọc, không ném; không số điện thoại). Cách đo: chạy T037 trên bản chép repo back
#   (0) nguyên bản → phải PASS;
#   (1) đột biến: isHidden luôn false (vendor ẩn lọt chat) → T037 phải FAIL;
#   (2) đột biến: đường chat bỏ qua overlay đã nạp (contextBuilder không gọi loadOverlay) → T037 phải FAIL;
#   (3) đột biến: chat quay lại gọi mạng (fetch MATCHER_URL trước khi ghép) → T037 phải FAIL.
# Không sửa repo back (chép vào thư mục tạm). Chạy từ gốc tohong-hq: bash eval/T-143/adv-04-test-t037-con-bat-loi.sh · Biến: TOHONG_BACK_REPO.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; HQ="$(cd "$HERE/../.." && pwd)"
BACK="${TOHONG_BACK_REPO:-$HQ/../tohong-back}"
[ -f "$BACK/lib/contextBuilder.js" ] || { echo "PASS chưa áp dụng (thiếu tohong-back)"; exit 0; }
grep -q "chatMatch" "$BACK/lib/contextBuilder.js" || { echo "PASS chưa áp dụng (chưa có đường chat JS)"; exit 0; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mk() { rm -rf "$T/r"; mkdir -p "$T/r"; for d in lib api providers test; do [ -d "$BACK/$d" ] && cp -r "$BACK/$d" "$T/r/$d"; done
       cp "$BACK/package.json" "$BACK/worker.js" "$T/r/" 2>/dev/null; ln -s "$(readlink -f "$BACK/node_modules")" "$T/r/node_modules"; }
runT037() { (cd "$T/r" && node --test --test-name-pattern="T037 buildChatContext" test/test_admin.js >"$T/out" 2>&1); }
fails=()
mk; runT037 || fails+=("(0) T037 đỏ trên nguyên bản: $(grep -m1 -E 'not ok|Error' "$T/out")")
grep -qE "^# pass [1-9]" "$T/out" || fails+=("(0) T037 không chạy ca nào (tên test đổi?)")
mk; python3 - "$T/r/lib/vendorOverlay.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read(); a="return state.data.vendors[id]?.hidden === true;"; assert a in s; open(p,"w").write(s.replace(a,"return false;"))
PY
runT037 && fails+=("(1) vendor ẩn lọt chat mà T037 vẫn xanh")
mk; python3 - "$T/r/lib/contextBuilder.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read(); a="await loadOverlay(env);"; assert a in s; open(p,"w").write(s.replace(a,"/* bỏ overlay */", 1))
PY
runT037 && fails+=("(2) chat bỏ qua overlay mà T037 vẫn xanh")
mk; python3 - "$T/r/lib/contextBuilder.js" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read(); a="matchMetadata = chatMatch(matchProfile);"; assert a in s
open(p,"w").write(s.replace(a,"const _r = await fetch(String(env.MATCHER_URL) + '/match'); matchMetadata = chatMatch(matchProfile);"))
PY
runT037 && fails+=("(3) chat gọi mạng mà T037 vẫn xanh")
if [ ${#fails[@]} -gt 0 ]; then printf 'FAIL %s\n' "${fails[*]}"; exit 1; fi
echo "PASS T037 xanh trên nguyên bản, đỏ với 3 đột biến (vendor ẩn lọt, bỏ overlay, gọi mạng)"
