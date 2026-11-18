#!/usr/bin/env bash
# THAY THẾ planner/admin inv-002 (ADR-126; inv-002 cũ bị gỡ lúc PR T-204 merge). Nguồn: T-204 (products/T-204-co-mo-admin-tinh-la-capu.md), spec-critic xác nhận khi spec qua Spec Gate.
# Bất biến: danh tính cố định "admin-khong-dang-nhap" là Capu khi và chỉ khi ADMIN_OPEN đúng "1", tính lúc ĐỌC từ cờ hiện tại (không từ cờ lưu trên bản ghi):
#   bật -> mọi bản ghi của nó (cũ lẫn mới) ở "Chờ áp dụng" và có trong export ký; tắt / khác đúng "1" -> không bao giờ là Capu, không vào export, dù ADMIN_USER_IDS/CAPU_USER_IDS liệt kê nó
#   và dù bản ghi mang by_capu=true; Capu thật vẫn ký khi cờ tắt; đảo cờ không ghi R2.
# Tự chứa: worker thật + R2 giả của tohong-back (TOHONG_BACK_REPO, mặc định ../tohong-back cạnh gốc HQ). Mạng bị chặn. Không ghi vào repo.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/lib/admin_open_capu.mjs"
