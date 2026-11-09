#!/usr/bin/env python3
"""Eval đối kháng tầng 3 T-116 (adversary). Bảo vệ khi gộp với nhánh khác còn dùng API cũ (vd PR tohong-front #64 còn
`<VendorIllustration catId={catId} chip chipBottom={...} />`): sau T-114, component bỏ qua `chip`, nên ô lớn nào còn
truyền `chip` mà không có `large` sẽ lặng lẽ thành ô nhỏ: có title và bắt chuột (vi phạm spec T-114 mục 3).
Đạt khi: (1) không nơi nào trong src gọi VendorIllustration với prop `chip` hay `chipBottom`; (2) VendorIllustration không còn
nhận `chip`; (3) hai ô lớn của VendorChatCards.jsx (VMatchChatCard, VDetailChatCard) truyền `large`.
Repo front: tham số 1, rồi TOHONG_FRONT_REPO, rồi cwd nếu là tohong-front (gate.py --cwd), rồi /home/user/tohong-front. Mã thoát 0 = đạt."""
import os, re, sys

_cwd = os.getcwd()
repo = ((sys.argv[1] if len(sys.argv) > 1 else None) or os.environ.get("TOHONG_FRONT_REPO")
        or (_cwd if os.path.isfile(os.path.join(_cwd, "src", "vendorIllustrations.jsx")) else "/home/user/tohong-front"))
src = os.path.join(repo, "src")
if not os.path.isdir(src):
    print("FAIL không thấy %s" % src); sys.exit(1)
fails = []
call = re.compile(r"<VendorIllustration\b([^>]*)/?>", re.S)
for d, _, fs in os.walk(src):
    for f in fs:
        if not f.endswith((".jsx", ".js", ".tsx", ".ts")): continue
        p = os.path.join(d, f); t = open(p, encoding="utf-8").read()
        for m in call.finditer(t):
            props = m.group(1)
            if re.search(r"\bchip(Bottom)?\b", props):
                fails.append("%s:%d gọi VendorIllustration với prop cũ: %s" % (os.path.relpath(p, repo), t[:m.start()].count("\n") + 1, " ".join(props.split())))
vi = open(os.path.join(src, "vendorIllustrations.jsx"), encoding="utf-8").read()
sig = re.search(r"export function VendorIllustration\s*\(\s*\{([^}]*)\}", vi)
if not sig: fails.append("không thấy chữ ký VendorIllustration")
elif re.search(r"\bchip", sig.group(1)): fails.append("VendorIllustration vẫn nhận prop chip: {%s}" % sig.group(1).strip())
vc = open(os.path.join(src, "screens", "chat", "VendorChatCards.jsx"), encoding="utf-8").read()
for fn in ("VMatchChatCard", "VDetailChatCard"):
    m = re.search(r"export function %s\b" % fn, vc)
    if not m: fails.append("không thấy %s" % fn); continue
    nxt = re.search(r"\nexport function ", vc[m.end():])
    body = vc[m.end(): m.end() + nxt.start()] if nxt else vc[m.end():]
    calls = [c.group(1) for c in call.finditer(body)]
    if not calls: fails.append("%s không còn gọi VendorIllustration" % fn)
    for c in calls:
        if not re.search(r"\blarge\b", c): fails.append("%s gọi VendorIllustration không có large: %s" % (fn, " ".join(c.split())))
if fails:
    print("FAIL"); [print("  " + x) for x in fails]; sys.exit(1)
print("PASS không còn prop chip/chipBottom; ô lớn VMatchChatCard và VDetailChatCard truyền large")
