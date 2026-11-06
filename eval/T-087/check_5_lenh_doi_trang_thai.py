#!/usr/bin/env python3
"""T-087 tiêu chí 5: lệnh đổi trạng thái chạy được trên việc có trường hỏng, và ghi lại không đổi giá trị trường hỏng
(đọc lại vẫn đúng chuỗi thô) hay trường nào khác ngoài các trường lệnh phải đổi. Chạy: python3 eval/T-087/check_5_lenh_doi_trang_thai.py"""
import tempfile
import _lib as L
T = L.ROOT / "scripts/task.py"
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": dict(L.CORRUPT, state="doing", holder="product", owner="product", reviewer="spec-critic", tier='"A"',
                                    area="hq/ledger", eval="[]", rounds="0", version="0")})
    (fake / "handoffs" / "T-901-v1.md").write_text("x\n", encoding="utf-8")
    before, _ = L.read(fake, "T-901")
    L.chk(before is not None, "đọc trước lệnh thất bại")
    r = L.run(fake, T, "handoff", "T-901", "--by", "product", "--note", "n", "--link", "handoffs/T-901-v1.md", "--eval", "echo ok")
    L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"handoff trên việc có trường hỏng: thoát {r.returncode}: {r.stderr[-200:]}")
    after, err = L.read(fake, "T-901")
    L.chk(after is not None, "đọc sau lệnh thất bại: " + err[-200:])
    if before and after:
        for k in L.CORRUPT: L.chk(after[k] == before[k] == L.CORRUPT[k], f"{k}: ghi lại làm đổi giá trị: {before[k]!r} -> {after[k]!r}")
        changed = {k for k in before if before[k] != after.get(k)}
        L.chk(changed <= {"state", "holder", "updated", "eval", "prev_state", "version"}, "lệnh đổi trường ngoài dự kiến: " + str(sorted(changed)))
        L.chk(after["state"] != "doing", "handoff không đổi trạng thái")
    r2 = L.run(fake, T, "cost", "T-901", "--by", "product", "--cost", "0.5", "--note", "dịch vụ ngoài")
    L.chk("Traceback" not in r2.stderr, "cost trên việc có trường hỏng: sập")
L.done()
