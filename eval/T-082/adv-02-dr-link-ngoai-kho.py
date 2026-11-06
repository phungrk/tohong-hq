#!/usr/bin/env python3
"""T-082 adv-02 (tầng 3, spec C1 'thân file Decision Request' + ranh giới cứng 'không đưa khoá/bí mật ra ngoài').
Input phá: sự kiện escalated có `link` trỏ ra ngoài vùng tài liệu của kho: đường dẫn tuyệt đối (/proc/self/environ chứa
GH_TOKEN của bước phản chiếu), `.git/config` (actions/checkout lưu token trong extraheader), `../` thoát khỏi kho.
mirror_issue.py ghép `ROOT / link` rồi đăng nguyên văn lên issue (công khai) -> lộ token/bí mật.
Mong đợi: bình luận leo thang KHÔNG chứa nội dung các file đó (dấu hiệu bí mật giả); link hợp lệ trong kho
(inbox/capu/..., handoffs/...) vẫn chạy như check_1. GitHub giả, không mạng."""
import sys, pathlib, os
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "T-063"))
def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _hook
from _advlib import Ledger, posted
SECRET = "BI-MAT-GIA-ghp_adv02xxxxxxxxxxxxxxxx"
fails = []
outside = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / f"adv02-{os.getpid()}.md"
outside.write_text(f"Cần quyết: x\n{SECRET}\n", encoding="utf-8")
try:
    for name in ("abs", "dotdot", "gitconfig", "environ"):
        L = Ledger()
        try:
            L.env["ADV02_SECRET"] = SECRET          # có trong /proc/self/environ của tiến trình phản chiếu
            (L.tmp / ".git").mkdir()
            (L.tmp / ".git" / "config").write_text(f"[http]\n\textraheader = AUTHORIZATION: basic {SECRET}\n")
            link = {"abs": str(outside), "dotdot": os.path.relpath(outside, L.tmp), "gitconfig": ".git/config",
                    "environ": "/proc/self/environ"}[name]
            L.task("new", "--title", "mồi", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
            rc, out, _ = L.mirror(); assert rc == 0, out
            L.task("new", "--title", "có issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")
            L.task("escalate", "T-002", "--by", "chief-of-staff", "--note", "A hay B?", "--link", link)
            rc, out, calls = L.mirror()
            bs = [b for b in posted(calls, "7") if "tohong-mirror:T-002-esc-" in b]
            if any(SECRET in b for b in bs):
                fails.append(f"link={link!r}: nội dung file ngoài kho/bí mật bị đăng lên issue")
            if rc == 0 and len(bs) != 1:
                fails.append(f"link={link!r}: phải vẫn có đúng 1 bình luận leo thang (câu hỏi + /ok), có {len(bs)}")
        finally:
            L.close()
finally:
    outside.unlink(missing_ok=True)
assert not fails, "\n".join(fails)
print("PASS link DR ngoài kho (tuyệt đối, ../, .git/config, /proc) không bị đăng lên issue")
