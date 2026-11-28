"""Khung chung cho eval T-234 (không phải eval). Dùng lại eval/T-232/lib232.py (-> T-230/lib230.py -> eval/lib/regen_fixture.py): bản sao tạm, chặn mạng.
Repo: TOHONG_REPO (clone git của nhánh; check_2 cần các ref origin/feat/enrich-hcm-*-batch-01), TOHONG_BACK_REPO (back đã cài dependencies)."""
import os, sys
sys.dont_write_bytecode = True
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(_here), "T-232"))
from lib232 import (build, counts, report, Fail, run, R, single_ids, multi_ids, edit, rec, ai_log, flag, tool, violations, files_by_cat)  # noqa: E402,F401

VALID5 = ["found", "not_found", "closed", "address_mismatch", "wrong_category"]
# Dòng khai báo của 6 nhánh PR dữ liệu (#120, #121, #123, #125, #126, #127), chép nguyên văn (bỏ thụt đầu dòng).
BRANCH_LINE = 'ai_mode_result: Optional[Literal["found", "not_found", "closed", "address_mismatch", "wrong_category"]] = None'
BRANCHES = {120: "feat/enrich-hcm-invitation-batch-01", 121: "feat/enrich-hcm-wedding-gift-batch-01", 123: "feat/enrich-hcm-makeup-batch-01",
            125: "feat/enrich-hcm-photography-batch-01", 126: "feat/enrich-hcm-wedding-attire-batch-01", 127: "feat/enrich-hcm-wedding-ring-batch-01"}


def set_val(fx, vid, cat, val):
    edit(fx, cat, lambda vs: rec(vs, vid).__setitem__("ai_mode_result", val))
