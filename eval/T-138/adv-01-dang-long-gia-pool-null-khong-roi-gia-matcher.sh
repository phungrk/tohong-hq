#!/usr/bin/env bash
# T-138 adv-01 (tầng 3): dạng lồng, vendor pool không có giá, matcher kèm price_range cấp item -> prompt không được in giá matcher. Chi tiết trong _adv01_dang_long_gia.mjs.
set -euo pipefail
node "$(cd "$(dirname "$0")" && pwd)/_adv01_dang_long_gia.mjs" 2> >(grep -v '^contextBuilder: bỏ' >&2)
