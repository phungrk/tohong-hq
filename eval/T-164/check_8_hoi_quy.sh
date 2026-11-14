#!/usr/bin/env bash
# T-164 tiêu chí 8 (hồi quy, nói rõ ở spec mục H5/"Hồi quy"): thay đổi giá + nhãn không làm hỏng ghép vendor và pool.
#  - T-159 (phân bổ dự toán) check 2 và 8 luôn, check 1..10 khi T-159 đã vào back; T-140 check 7 / T-143 adv-01 (qua T-159 check 8), inv-037..041 (inv-038 (v): price_range == giá pool x 1e6 và min_vnd <= ngân sách vẫn đúng cho vendor ước tính;
#    inv-041: chấm điểm bằng ngân sách gốc, công thức budgetScore không đổi) — dùng pool đông cứng KHÔNG có priceSource, nên đo "pool cũ chạy y như cũ";
#  - bất biến pool planner/vendor/pool inv-001..004 và planner/vendor/images inv-012/013/014/021/022 (trường mới không phá hợp đồng pool); inv-007 (bundle <= 1MB) chạy ở check 7; inv-037..041 còn chạy lần hai trên pool đã đóng dấu giá (venue theo bàn và ước tính đi qua chúng).
# Chạy từ gốc tohong-hq: bash eval/T-164/check_8_hoi_quy.sh   · Biến: TOHONG_BACK_REPO, TOHONG_REPO, TOHONG_FRONT_REPO.
set -u
HQ="$(cd "$(dirname "$0")/../.." && pwd)"; IMG="$HQ/eval/invariants/planner/vendor/images"; POOL="$HQ/eval/invariants/planner/vendor/pool"
fails=()
run() { out="$("$@" 2>&1 | tail -1)"; case "$out" in PASS*) ;; *) fails+=("$(basename "${*: -1}"): ${out:0:140}");; esac; }
# T-159 check 2 và 8 xanh trước và sau T-159. Khi T-159 đã vào back (check 1 xanh) thì cả bộ 1..10 phải xanh; chưa vào thì 1,3,4,5,6,7,9,10 đỏ vì chưa cài, không tính cho việc này.
run bash "$HQ/eval/T-159/check_2_chua_phan_bo_nhu_cu.sh"; run bash "$HQ/eval/T-159/check_8_inv_con_xanh_va_khong_bang_nhu_cu.sh"
if [ "$(bash "$HQ/eval/T-159/check_1_chat_dung_allocated.sh" 2>&1 | tail -1 | cut -c1-4)" = "PASS" ]; then
  for n in 1 3 4 5 6 7 9 10; do for f in "$HQ"/eval/T-159/check_${n}_*.sh; do run bash "$f"; done; done
fi
for n in 037 038 039 040 041 012 013 014 021 022; do for f in "$IMG"/inv-$n-*.py; do [ -f "$f" ] && run python3 -I "$f"; done; done
for f in "$POOL"/inv-00[1-4]-*.py; do run python3 -I "$f"; done
# inv-037..041 và inv-038 trên pool ĐÃ đóng dấu giá (đúng như sau PR 3): venue theo bàn, ước tính, nhãn không làm đỏ chúng. Đỏ ở đây = dừng, báo Chief, KHÔNG sửa bất biến.
STAMP="$(T164_KEEP=1 node "$HQ/eval/T-164/lib/stamp_dir.mjs" 2>/dev/null | tail -1)"
if [ -d "$STAMP" ]; then
  for n in 037 038 039 040 041; do for f in "$IMG"/inv-$n-*.py; do out="$(TOHONG_BACK_REPO="$STAMP" python3 -I "$f" 2>&1 | tail -1)"; case "$out" in PASS*) ;; *) fails+=("[pool đã dấu giá] $(basename "$f"): ${out:0:140}");; esac; done; done
  rm -rf "$STAMP"
else fails+=("không dựng được pool đã đóng dấu giá"); fi
if [ ${#fails[@]} -gt 0 ]; then echo "FAIL ${fails[*]}"; exit 1; fi
echo PASS
