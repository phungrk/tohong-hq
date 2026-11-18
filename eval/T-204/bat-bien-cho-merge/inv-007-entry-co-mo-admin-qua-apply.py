#!/usr/bin/env python3
"""Bất biến đề xuất (planner/admin/vendor-enrich) · nguồn T-204 (ADR-126). Mục export do danh tính cố định tạo khi cờ ADMIN_OPEN="1" luôn được tools/scraper/apply_admin_reviews.py (tohong) nhận đầu-cuối:
APPLY_OK, mục sinh ra qua eval/lib/capu_decision.py, nhãn đúng admin:2ddfc6ef. Ai đổi dạng nhãn (khác /^admin:[0-9a-f]{8}$/), thêm trường bị apply từ chối, hay đổi phần được ký mà không đổi apply thì bất biến đỏ.
Tự chứa như eval/T-204/check_5 (copy). Repo: TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back. Chạy: python3 -I <file>."""
import os, runpy, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
# Khi thăng vào bể, Chief of Staff dán nội dung eval/T-204/check_5_apply_nhan_entry_co_mo.py vào đây và đổi đường tới lib/open_admin_export.mjs; file này chỉ khung tạm.
src = open(os.path.join(HERE, "..", "check_5_apply_nhan_entry_co_mo.py"), encoding="utf-8").read().replace('os.path.join(HERE, "lib", "export_under_flag.mjs")', 'os.path.join(HERE, "lib", "open_admin_export.mjs")')
exec(compile(src, __file__, "exec"), {"__file__": __file__, "__name__": "__main__"})
