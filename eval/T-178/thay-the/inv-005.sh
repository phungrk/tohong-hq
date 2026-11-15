#!/usr/bin/env bash
# T-178 BẢN THAY THẾ ĐỀ NGHỊ cho eval/invariants/planner/vendor/inv-005-*.sh: chạy hai bản thay thế (chip theo bàn bỏ phần " = {tổng}tr" trước khi so). Biến: TOHONG_BACK_REPO.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
node "$H/inv-005a.mjs" "$@" || exit 1
exec node "$H/inv-005b.mjs" "$@"
