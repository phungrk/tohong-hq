#!/usr/bin/env bash
# T-131 (sự cố 2026-11-12): tạo lại pool sau khi vendor bị hạ (few_reviews / low_confidence) thì vendor đó KHÔNG được giữ ảnh Google cũ trong pool.
# Chạy: bash check.sh   (TOHONG_REPO, TOHONG_BACK_REPO trỏ worktree; mặc định /home/user/tohong, /home/user/tohong-back)
# Cách đo: chép hai repo vào thư mục tạm, chạy NGUYÊN VĂN `bash tools/regen-pool-styles.sh --back <bản chép back> --photos-for all`,
# rồi chạy INV-014 (ảnh Google ⇒ có place_id nguồn), INV-013, INV-022, INV-021 trên kết quả. Không gọi mạng.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"
T="${TOHONG_REPO:-/home/user/tohong}"; B="${TOHONG_BACK_REPO:-/home/user/tohong-back}"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mkdir -p "$W/t" "$W/b"; (cd "$T" && tar --exclude=./node_modules --exclude=./.git -cf - .) | (cd "$W/t" && tar xf -); (cd "$B" && tar --exclude=./.git -cf - .) | (cd "$W/b" && tar xf -)
[ -e "$W/t/node_modules" ] || { [ -d "$T/node_modules" ] && ln -s "$T/node_modules" "$W/t/node_modules"; }
( cd "$W/t" && bash tools/regen-pool-styles.sh --back "$W/b" --photos-for all ) >"$W/regen.log" 2>&1 || { echo "FAIL regen-pool-styles.sh lỗi"; tail -5 "$W/regen.log"; exit 1; }
rc=0
for inv in inv-013 inv-014 inv-021 inv-022; do
  p=$(ls "$HQ"/eval/invariants/planner/vendor/images/$inv-* | head -1)
  out=$(cd "$W/t" && TOHONG_REPO="$W/t" TOHONG_BACK_REPO="$W/b" python3 "$p" 2>&1 | tail -1)
  echo "$inv: $out"; case "$out" in PASS*) ;; *) rc=1 ;; esac
done
[ $rc = 0 ] && echo PASS || echo FAIL; exit $rc
