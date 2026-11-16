#!/usr/bin/env bash
# T-183 tiêu chí 5 (tohong-front). Bỏ mã chết scoreEpoch KHÔNG đổi hành vi: các eval hành vi của T-179 và T-182 vẫn xanh trên App thật (vite dev + Playwright + API giả có trạng thái).
# Gồm: hai bất biến matching/inv-006 (T-179 check_1,2,3,5,7,10 + T-182 adv-02) và inv-008 (T-179 check_11 + T-182 adv-01), cộng T-179 check_4,6,8,9 và T-182 adv-03,04,05,06.
# Chạy từ gốc tohong-hq: bash eval/T-183/check_5_hanh_vi_front_khong_doi.sh [--repo <tohong-front>]   (biến TOHONG_FRONT_REPO, PLAYWRIGHT_PATH). In PASS hoặc FAIL <eval>.
set -u
D="$(cd "$(dirname "$0")" && pwd)"; R="$D"; while [ "$R" != "/" ] && [ ! -f "$R/scripts/gate.py" ]; do R="$(dirname "$R")"; done
M="$R/eval/invariants/planner/vendor/matching"
fail=0
for b in inv-006-danh-sach-moi-nhat-theo-du-toan-da-luu inv-008-doc-du-toan-loi-khong-in-danh-sach-theo-so-doan; do
  out="$(bash "$M/$b.sh" "$@" 2>&1 | tail -3 | tr '\n' ' ')"; case "$out" in "PASS "*) ;; *) echo "FAIL $b: $out"; fail=1;; esac
done
for f in T-179/check_4_doi_so_khach T-179/check_6_luu_loi_khong_in_theo_so_chua_luu T-179/check_8_xem_them_danh_sach_cu T-179/check_9_chi_tiet_khong_co_diem \
         T-182/adv-03-bam-khi-luu-cham-roi-loi T-182/adv-04-bam-hai-lan-lien-tiep-khi-doc-cham T-182/adv-05-bang-so-sanh-tu-danh-sach-moi-loi-ids-thu-lai T-182/adv-06-doc-du-toan-200-than-hong; do
  out="$(node "$R/eval/$f.cjs" "$@" 2>&1 | tail -1)"; case "$out" in PASS) ;; *) echo "FAIL $f: $out"; fail=1;; esac
done
[ "$fail" = 0 ] && echo PASS; exit "$fail"
