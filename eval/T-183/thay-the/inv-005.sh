#!/usr/bin/env bash
# T-183 BẢN THAY ĐỀ NGHỊ cho eval/T-178/thay-the/inv-005.sh (planner/vendor/inv-005): chạy inv-005a mới (chip dấu phẩy) rồi inv-005b của T-178 (không phụ thuộc dấu: chip bỏ " = {tổng}tr" bằng \S+, đọc số bàn). Biến: TOHONG_BACK_REPO.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
node "$H/inv-005a.mjs" "$@" || exit 1
exec node "$H/../../T-178/thay-the/inv-005b.mjs" "$@"
