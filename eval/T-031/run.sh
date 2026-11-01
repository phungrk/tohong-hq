#!/usr/bin/env bash
# Eval tầng 1 của T-031 (nhân vật bot/người trong khối của bảng Mô hình). Một lệnh, in PASS/FAIL, mã thoát 0/1.
#   cd /home/user/tohong-hq && bash eval/T-031/run.sh <thư-mục-repo-dashboard> --task T-031 [--criterion N] [--shots [thư-mục-ảnh]]
# --task: bắt buộc cho tiêu chí 12 và --shots (thư mục ảnh docs/screenshots/<task>/ không có mặc định).
# Cần Playwright (NODE_PATH mặc định lấy từ `npm root -g`) và d3.min.js cục bộ (biến D3, nếu không có thì tìm vài chỗ quen).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -f "$REPO/index.html" ]; then echo "FAIL cần đường dẫn repo dashboard (có index.html) làm tham số đầu tiên"; exit 1; fi
shift
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node "$HERE/model-characters.cjs" "$REPO" "$@"
