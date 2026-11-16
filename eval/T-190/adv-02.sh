#!/usr/bin/env bash
# T-190 adv-02 (tầng 3, front): build production khi cờ build VẮNG phải giống HỆT TỪNG BYTE build trước thay đổi
# (nhánh mở bị loại hoàn toàn, không còn dấu vết trong bundle). Đo hai lượt: có và không có khoá Clerk giả.
# Repo: TOHONG_FRONT_REPO (git worktree của nhánh). Mốc so sánh: AdminApp.jsx ở merge-base với main. Build vào thư mục tạm; không ghi vào repo.
set -u
FRONT="${TOHONG_FRONT_REPO:-/home/user/tohong-front}"
[ -f "$FRONT/src/admin/AdminApp.jsx" ] || { echo "FAIL thiếu TOHONG_FRONT_REPO"; exit 2; }
BASE=$(git -C "$FRONT" merge-base HEAD main 2>/dev/null || git -C "$FRONT" merge-base HEAD origin/main) || { echo "FAIL không tìm được merge-base"; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/src"; git -C "$FRONT" archive HEAD | tar -x -C "$T/src"; ln -s "$FRONT/node_modules" "$T/src/node_modules"
fail=0
for KEY in "" "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"; do
  tag=$([ -z "$KEY" ] && echo "không khoá Clerk" || echo "có khoá Clerk giả")
  git -C "$FRONT" show HEAD:src/admin/AdminApp.jsx > "$T/src/src/admin/AdminApp.jsx"
  (cd "$T/src" && env -u VITE_ADMIN_OPEN -u VITE_ADMIN_DEV_TOKEN VITE_CLERK_PUBLISHABLE_KEY="$KEY" npx vite build --outDir "$T/new" --emptyOutDir >/dev/null 2>&1) || { echo "FAIL build nhánh lỗi ($tag)"; exit 2; }
  git -C "$FRONT" show "$BASE":src/admin/AdminApp.jsx > "$T/src/src/admin/AdminApp.jsx"
  (cd "$T/src" && env -u VITE_ADMIN_OPEN -u VITE_ADMIN_DEV_TOKEN VITE_CLERK_PUBLISHABLE_KEY="$KEY" npx vite build --outDir "$T/old" --emptyOutDir >/dev/null 2>&1) || { echo "FAIL build mốc lỗi ($tag)"; exit 2; }
  if diff <(cd "$T/new" && find . -type f | sort | xargs md5sum) <(cd "$T/old" && find . -type f | sort | xargs md5sum) >/dev/null; then
    echo "  ok  cờ build vắng ($tag): bundle giống hệt từng byte bản trước thay đổi"
  else
    echo "  XX  cờ build vắng ($tag): bundle khác bản trước thay đổi (nhánh mở còn trong bundle?)"; fail=1
  fi
  if grep -rqa "admin-khong-dang-nhap\|VITE_ADMIN_OPEN" "$T/new"; then echo "  XX  bundle ($tag) chứa dấu vết cờ"; fail=1; fi
done
[ $fail -eq 0 ] && echo PASS || { echo "FAIL bundle cờ vắng không trùng bản cũ"; exit 1; }
