#!/usr/bin/env bash
# T-117 adv-05 (adversary). Tai thỏ / status bar ở chế độ standalone (PWA, manifest display: standalone; index.html viewport-fit=cover).
# Chromium không mô phỏng env(safe-area-inset-top) (luôn 0), nên kiểm tĩnh điều kiện làm đỉnh 24px bị status bar che:
#   nếu apple-mobile-web-app-status-bar-style = black-translucent (nội dung vẽ dưới status bar) thì luật .ob-sheet phải cộng safe-area-inset-top.
#   Với "default" (hiện tại) iOS đặt nội dung dưới status bar, inset top = 0 ở dọc: 24px không bị che.
# Mong đợi: PASS khi status bar không trong suốt, hoặc .ob-sheet có env(safe-area-inset-top). Chạy với cwd = repo tohong-front (hoặc TOHONG_FRONT_REPO).
set -u
REPO="${TOHONG_FRONT_REPO:-$PWD}"
H="$REPO/index.html"; C="$REPO/src/index.css"
[ -f "$H" ] && [ -f "$C" ] || { echo "FAIL thiếu index.html hoặc src/index.css"; exit 2; }
if grep -qi 'apple-mobile-web-app-status-bar-style"[^>]*black-translucent' "$H"; then
  if grep -E '\.ob-sheet[^{]*\{[^}]*safe-area-inset-top' "$C" >/dev/null; then echo PASS; exit 0; fi
  echo "FAIL status bar black-translucent nhưng .ob-sheet không cộng env(safe-area-inset-top): đỉnh sheet 24px nằm dưới status bar/tai thỏ"; exit 1
fi
grep -qi 'viewport-fit=cover' "$H" && ! grep -qi 'apple-mobile-web-app-status-bar-style' "$H" && { echo "FAIL viewport-fit=cover mà không khai status-bar-style: không xác định được status bar có phủ đỉnh sheet"; exit 1; }
echo PASS
