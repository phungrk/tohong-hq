#!/usr/bin/env bash
# Eval đối kháng T-044 (adversary, 2026-11-02), phần front: tên/email chỉ vẽ dạng text (React tự escape).
# Đỏ nếu màn danh sách thành viên dùng dangerouslySetInnerHTML/innerHTML/outerHTML/insertAdjacentHTML.
set -u
FRONT="${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
F="$FRONT/src/admin/MemberList.jsx"
[ -f "$F" ] || { echo "không có $F"; exit 1; }
if grep -nE 'dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML' "$F"; then
  echo "FAIL: màn danh sách vẽ HTML thô"; exit 1
fi
echo "PASS: không vẽ HTML thô"
