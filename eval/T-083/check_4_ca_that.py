#!/usr/bin/env python3
"""T-083 ca thật 2026-11-06 trên sổ cái thật (xuất --public ra thư mục tạm): T-082 (merged qua tohong-hq#26) và T-070 (DR đã quyết) không còn chờ Capu. Không phụ thuộc thời điểm.
Chạy: cd /home/user/tohong-hq && python3 eval/T-083/check_4_ca_that.py"""
import tempfile, json
from pathlib import Path
from lib import *
c = Checker()
evs = events(ROOT)
c.chk(any(e["event"] == "merged" and e["task"] == "T-082" and e["link"] == PR_A for e in evs), "sổ cái có merged T-082 tohong-hq#26")
d70 = [e for e in evs if e["event"] == "decided" and e["task"] == "T-070"]
import unicodedata
NOTE = "Capu chọn A: chạy mirror với wayback trước, đọc SUMMARY rồi quyết tiếp"
c.chk(len(d70) == 1 and d70[0]["from"] == "capu" and unicodedata.normalize("NFC", d70[0]["detail"]).strip() == unicodedata.normalize("NFC", NOTE),
      f"sổ cái có đúng một decided của capu cho T-070 với note nguyên văn; thấy {[(e['from'], e['detail']) for e in d70]}")
with tempfile.TemporaryDirectory() as tmp:
    env = dict(os.environ); env.pop("TOHONG_ROOT", None); env.pop("TOHONG_NOW", None)
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--public", "--out", tmp], capture_output=True, text=True, env=env)
    c.chk(r.returncode == 0, "export thật lỗi")
    if r.returncode == 0:
        q = {e["task"] for e in json.loads((Path(tmp) / "dashboard.json").read_text(encoding="utf-8"))["capu_queue"]}
        c.chk("T-082" not in q, "T-082 (đã có merged) không vào capu_queue")
        c.chk("T-070" not in q, "T-070 (DR đã quyết) không vào capu_queue")
c.done()
