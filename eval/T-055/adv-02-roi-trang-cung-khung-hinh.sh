#!/usr/bin/env bash
# adv-02 (T-055): rời trang (chạm tab, Back) trong cùng khung hình với lần cuộn cuối thì vị trí lúc rời vẫn được nhớ. Spec T-054 mục 4.1, 4.2.
exec bash "$(cd "$(dirname "$0")" && pwd)/lib/run.sh" 02-roi-trang-cung-khung-hinh.cjs "${1:-}"
