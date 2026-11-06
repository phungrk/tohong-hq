#!/usr/bin/env python3
"""T-087 tiêu chí 2: giá trị hợp lệ đọc như cũ, không cảnh báo. Chạy: python3 eval/T-087/check_2_hop_le_nhu_cu.py"""
import tempfile
import _lib as L
good = {"title": '"Có: hai chấm # và \\"nháy\\" trong"', "budget": '""', "issue": '"12"', "deadline": "2026-11-10",
        "eval": '["python3 x.py", "echo \\"hi\\""]', "area": '" hq/ledger"'}
exp = {"title": 'Có: hai chấm # và "nháy" trong', "budget": "", "issue": "12", "deadline": "2026-11-10",
       "eval": ["python3 x.py", 'echo "hi"'], "area": " hq/ledger"}
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-903": good})
    m, err = L.read(fake, "T-903")
    L.chk(m is not None, "read_task ném lỗi: " + err[-200:])
    if m:
        for k, v in exp.items(): L.chk(m.get(k) == v, f"{k}: phải {v!r}, thấy {m.get(k)!r}")
    L.chk("Cảnh báo" not in err, "giá trị hợp lệ mà có cảnh báo: " + err[:200])
    s = L.run(fake, L.ROOT / "scripts/task.py", "summary")
    L.chk(s.returncode == 0 and "Cảnh báo" not in s.stderr and "Board hỏng" not in s.stdout, "summary board lành: không được báo hỏng")
    L.chk(L.read(fake, "T-903")[0] == m, "đọc hai lần cho kết quả khác nhau")
L.done()
