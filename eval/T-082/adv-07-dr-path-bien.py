#!/usr/bin/env python3
"""T-082 adv-07 (tầng 3, spec C1 + ranh giới cứng 'không đưa bí mật ra ngoài'; soi bản vá adv-02 của mirror_issue.dr_path).
Input biên cho `link` của sự kiện escalated:
 PHẢI KHÔNG đăng (dấu hiệu bí mật giả nằm trong .git của kho con / ngoài kho):
  - 'sub/.git/config'            (kho con lồng trong kho, .git không ở cấp đầu)
  - 'lnk/config', lnk -> sub/.git (symlink gián tiếp tới .git của kho con: .git chỉ hiện ra SAU khi resolve)
  - 'g/config', g -> .git        (symlink tới .git của chính kho)
  - 'handoffs/ra-ngoai.md' là symlink ra file ngoài kho
  - ký tự null 'handoffs/x.md\\x00', thư mục 'handoffs', '.'
 PHẢI ĐĂNG nguyên thân DR (link hợp lệ không bị fallback oan):
  - 'handoffs/T-002-dr.md', './handoffs/../handoffs/T-002-dr.md', 'handoffs//T-002-dr.md'
  - 'inbox/capu/moi-nhat.md' là symlink TRONG kho tới handoffs/T-002-dr.md
 Mọi trường hợp: mirror thoát 0 và có đúng 1 bình luận leo thang. GitHub giả, không mạng."""
import sys, pathlib, os
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "T-063"))
def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _hook
from _advlib import Ledger, posted
SECRET = "BI-MAT-GIA-ghp_adv07xxxxxxxxxxxxxxxx"
GOOD = "DR-HOP-LE-adv07-phuong-an-A"
fails = []
outside = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / f"adv07-{os.getpid()}.md"
outside.write_text(f"Cần quyết: x\n{SECRET}\n", encoding="utf-8")
BAD = ["sub/.git/config", "lnk/config", "g/config", "handoffs/ra-ngoai.md", "handoffs/T-002-dr.md\x00", "handoffs", "."]
OK = ["handoffs/T-002-dr.md", "./handoffs/../handoffs/T-002-dr.md", "handoffs//T-002-dr.md", "inbox/capu/moi-nhat.md"]
try:
    for link in BAD + OK:
        L = Ledger()
        try:
            T = L.tmp
            (T / ".git").mkdir(); (T / ".git" / "config").write_text(f"[http]\n\textraheader = AUTHORIZATION: basic {SECRET}\n")
            (T / "sub" / ".git").mkdir(parents=True); (T / "sub" / ".git" / "config").write_text(f"token = {SECRET}\n")
            os.symlink("sub/.git", T / "lnk"); os.symlink(".git", T / "g")
            os.symlink(str(outside), T / "handoffs" / "ra-ngoai.md")
            (T / "handoffs" / "T-002-dr.md").write_text(f"---\ntype: decision-request\n---\nCần quyết: {GOOD}\n", encoding="utf-8")
            os.symlink("../../handoffs/T-002-dr.md", T / "inbox" / "capu" / "moi-nhat.md")
            L.task("new", "--title", "mồi", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
            rc, out, _ = L.mirror(); assert rc == 0, out
            L.task("new", "--title", "có issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")
            r = L.task("escalate", "T-002", "--by", "chief-of-staff", "--note", "A hay B?", "--link", link.replace("\x00", "NULLPH"), ok=False)
            if "\x00" in link:   # argv không chở được \0: đưa vào sổ cái giả dạng JSON \u0000 (như sổ cái bị sửa tay/đồng bộ)
                ev = T / "ledger" / "events.jsonl"; ev.write_text(ev.read_text(encoding="utf-8").replace("NULLPH", "\\u0000"), encoding="utf-8")
            if r.returncode != 0:
                if link in OK: fails.append(f"link={link!r}: task.py escalate từ chối link hợp lệ")
                continue   # task.py không cho ghi link đó vào sổ cái: an toàn
            rc, out, calls = L.mirror()
            bs = [b for b in posted(calls, "7") if "tohong-mirror:T-002-esc-" in b]
            if rc != 0: fails.append(f"link={link!r}: mirror thoát {rc}: {out[-200:]}"); continue
            if len(bs) != 1: fails.append(f"link={link!r}: phải đúng 1 bình luận leo thang, có {len(bs)}"); continue
            if SECRET in bs[0]: fails.append(f"link={link!r}: nội dung .git/ngoài kho bị đăng lên issue")
            if link in OK and GOOD not in bs[0]: fails.append(f"link={link!r}: link hợp lệ trong kho nhưng thân DR không được đăng")
        finally:
            L.close()
finally:
    outside.unlink(missing_ok=True)
assert not fails, "\n".join(fails)
print("PASS dr_path: .git (cả kho con, cả qua symlink), symlink ra ngoài, null, thư mục bị chặn; link hợp lệ (kể cả ./, //, symlink trong kho) vẫn đăng")
