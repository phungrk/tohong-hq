#!/usr/bin/env bash
# Eval tầng 1 cho T-023: bảng Mô hình Eval-Gated 2029 trên dashboard. Chạy trong repo tohong-hq-dashboard.
# PASS khi tests/model.js (Playwright) báo "Tất cả PASS".
set -e
: "${D3:=/opt/npm-tools/node_modules/d3/dist/d3.min.js}"
D3="$D3" OUT="${OUT:-/tmp/t020}" node tests/model.js 2>/dev/null | tail -1 | grep -q "Tất cả PASS"
