#!/usr/bin/env python3
"""T-087 tiêu chí 5 (hỏng NHẸ): lệnh đổi trạng thái chạy được; ghi lại thành JSON hợp lệ với giá trị ĐÃ chuẩn hoá (bỏ nháy ngoài), nên sau lệnh
đầu tiên cảnh báo và mục Board hỏng của việc đó biến mất; không trường nào khác đổi ngoài ý lệnh. Chạy: python3 eval/T-087/check_5_lenh_doi_trang_thai.py"""
import json, tempfile
import _lib as L
T = L.ROOT / "scripts/task.py"
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": dict(title='"Xin "chao" ban"', issue='""12""', state='""doing""', holder="product", owner="product",
                                    reviewer="spec-critic", tier='"A"', area="hq/ledger", eval="[]", rounds="0", version="0")})
    (fake / "handoffs" / "T-901-v1.md").write_text("x\n", encoding="utf-8")
    before, _, _ = L.read(fake, "T-901")
    L.chk(before is not None and before["state"] == "doing" and before["title"] == 'Xin "chao" ban', "đọc trước lệnh sai: %r" % (before,))
    r = L.run(fake, T, "handoff", "T-901", "--by", "product", "--note", "n", "--link", "handoffs/T-901-v1.md", "--eval", "echo ok")
    L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"handoff trên việc hỏng nhẹ: thoát {r.returncode}: {r.stderr[-200:]}")
    after, err, _ = L.read(fake, "T-901")
    L.chk(after is not None, "đọc sau lệnh thất bại: " + err[-200:])
    if before and after:
        for k in ("title", "issue", "area", "tier"): L.chk(after[k] == before[k], f"{k}: đổi {before[k]!r} -> {after[k]!r}")
        changed = {k for k in before if before[k] != after.get(k)}
        L.chk(changed <= {"state", "holder", "updated", "eval", "prev_state", "version"}, "lệnh đổi trường ngoài dự kiến: " + str(sorted(changed)))
        L.chk(after["state"] == "review", "handoff phải đưa việc sang review")
        L.chk("trường" not in err, "sau lệnh, việc đã chuẩn hoá mà vẫn cảnh báo: " + err[:150])
    s = L.run(fake, T, "summary"); j = json.loads(L.run(fake, T, "summary", "--json").stdout or "{}")
    L.chk("Board hỏng" not in s.stdout and j.get("board_hong") == [], "sau lệnh, summary không còn báo T-901 hỏng")
    r2 = L.run(fake, T, "cost", "T-901", "--by", "product", "--cost", "0.5", "--note", "dịch vụ ngoài")
    L.chk(r2.returncode == 0 and "Traceback" not in r2.stderr, "cost sau đó lỗi")
L.done()
