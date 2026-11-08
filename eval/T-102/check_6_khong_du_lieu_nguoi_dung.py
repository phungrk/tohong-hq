#!/usr/bin/env python3
"""Tiêu chí 6: không dữ liệu người dùng thật bị gửi qua Graphify, kiểm bằng BẰNG CHỨNG THẬT chứ không chỉ lời tự khai.
(a) quét lại transcript của mọi lượt bản B: không gọi skill Graphify, không lệnh Graphify ngoài danh sách con lệnh chỉ-đọc, không cờ chế độ đầy đủ, không đổi biến GRAPHIFY_*,
    không viết script gọi Graphify, không sửa .graphifyignore; số lượt vi phạm trong báo cáo ('LƯỢT VI PHẠM: n') bằng số quét được;
(b) mỗi lần dựng/làm mới đồ thị của lượt B chạy trong không gian mạng rỗng, thoát 0, cờ chỉ-mã, backend none, không kết nối ra ngoài; net-trace.json không có kết nối;
(c) manifest khai chế độ chỉ-mã/backend none/tắt nhật ký (chỉ là lời khai, (a)+(b) mới là bằng chứng);
(d) quét cây git ở mọi commit cơ sở (trừ media/tài liệu) tìm email thật, số điện thoại VN, khoá bí mật, .env*."""
import json, os, re, subprocess, sys, tarfile, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
import json
def base_shas():
    out = set()
    for t in json.load(open(os.path.join(HERE, "tasks.json")))["tasks"]:
        r = subprocess.run(["git", "-C", FRONT, "rev-parse", t["base_sha"]], capture_output=True, text=True)
        if r.returncode: fail(f"không phân giải được {t['base_sha']} trong tohong-front")
        out.add(r.stdout.strip())
    return out
shas = sorted(base_shas())
SKIP_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf", ".md", ".woff", ".woff2")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
OKMAIL = ("example.", "@types/", "@vitejs", "@eslint", "@clerk", "@anthropic", "@babel", "@rollup", "@esbuild", "@react", "@ant", "@tohong.", "noreply@", "a@b.vn", "b@c.vn", "ten@email.com", "@test.", "@local")
PHONE = re.compile(r"(?<!\d)(0|\+84)[ .]?\d{2,3}[ .]?\d{3}[ .]?\d{3,4}(?!\d)")
SECRET = re.compile(r"(sk-[A-Za-z0-9]{20,}|pk_(live|test)_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16})")
for sha in shas:
    tar = subprocess.run(["git", "-C", FRONT, "archive", sha], capture_output=True)
    if tar.returncode: fail(f"không đọc được cây {sha} của tohong-front")
    for ti in tarfile.open(fileobj=io.BytesIO(tar.stdout)):
        if not ti.isfile(): continue
        n = ti.name
        if n.startswith(("docs/", "public/")) or n.lower().endswith(SKIP_EXT) or n in ("package-lock.json",): continue
        if re.search(r"(^|/)\.env", n): fail(f"{sha[:7]}: có file env {n}")
        body = tarfile.open(fileobj=io.BytesIO(tar.stdout)).extractfile(ti).read().decode("utf-8", "ignore")
        if SECRET.search(body): fail(f"{sha[:7]}: {n} có chuỗi giống khoá bí mật")
        for e in EMAIL.findall(body):
            if not any(o in e for o in OKMAIL): fail(f"{sha[:7]}: {n} có email {e}")
        if PHONE.search(body): fail(f"{sha[:7]}: {n} có chuỗi giống số điện thoại: {PHONE.search(body).group(0)}")
# (a) quét transcript
rs = runs()
nviol = 0
for r in rs:
    peek, gv = scan_run(r)
    if gv:
        nviol += 1
        if not is_excl(r): fail(f"{tag(r)}: lượt hợp lệ có vi phạm Graphify {gv[:3]} (chế độ đầy đủ/skill/lệnh ngoài danh sách)")
txt = report_text()
mv = re.search(r"^LƯỢT VI PHẠM:\s*(\d+)", txt, re.M)
if not mv or int(mv.group(1)) != nviol: fail(f"báo cáo thiếu dòng 'LƯỢT VI PHẠM: n' hoặc n khác số quét được ({nviol})")
# (b) dựng/làm mới trong không gian mạng rỗng
for r in rs:
    if r["arm"] != "B": continue
    g = r.get("graph") or {}
    bl = g.get("builds")
    if not isinstance(bl, list) or not bl: fail(f"{tag(r)}: graph.builds trống (mỗi lần dựng/làm mới phải ghi lại)")
    if sum(1 for b in bl if b.get("kind") == "build") != 1 or sum(1 for b in bl if b.get("kind") == "refresh") != g.get("refresh_count"):
        fail(f"{tag(r)}: graph.builds phải có đúng 1 build và refresh_count lần refresh")
    for b in bl:
        if b.get("netns") != "none": fail(f"{tag(r)}: {b.get('kind')} chạy không trong không gian mạng rỗng (netns={b.get('netns')})")
        if b.get("exit") != 0: fail(f"{tag(r)}: {b.get('kind')} không thoát 0 trong không gian mạng rỗng (đồ thị chỉ-mã phải dựng được không cần mạng)")
        if b.get("backend_env") != "none": fail(f"{tag(r)}: {b.get('kind')} backend_env={b.get('backend_env')}, cần none")
        if "--code-only" not in b.get("argv", []): fail(f"{tag(r)}: {b.get('kind')} thiếu --code-only")
        if b.get("connect_attempts"): fail(f"{tag(r)}: {b.get('kind')} có cố kết nối ra ngoài {b['connect_attempts'][:2]}: dừng thí nghiệm, task.py block")
    if g.get("skill_removed") is not True: fail(f"{tag(r)}: graph.skill_removed phải true (skill là đường chế độ đầy đủ, bị gỡ khỏi worktree sau khi cài)")
np = os.path.join(RUNS, "net-trace.json")
if not os.path.isfile(np): fail("chưa có insights/T-102-runs/net-trace.json (hiện vật theo dõi mạng)")
nt = json.load(open(np, encoding="utf-8"))
nb = sum(len(r["graph"]["builds"]) for r in rs if r["arm"] == "B")
if not str(nt.get("method", "")).strip() or nt.get("processes_traced", 0) < nb: fail(f"net-trace.json: thiếu method hoặc processes_traced < {nb} lần dựng/làm mới")
if [c for c in nt.get("outbound_connections", ["?"]) if not str(c).startswith(("127.", "::1", "unix:"))]: fail("net-trace.json có kết nối ra ngoài loopback")
mc = re.search(r"^KẾT NỐI RA NGOÀI:\s*(\d+)", txt, re.M)
if not mc or int(mc.group(1)) != 0: fail("báo cáo thiếu dòng 'KẾT NỐI RA NGOÀI: 0'")
# (c) lời khai
m = manifest()
if m.get("mode") != "code-only": fail("manifest.mode phải là code-only")
if str(m.get("backend", "")).lower() != "none": fail("manifest.backend phải là none (GRAPHIFY_BACKEND=none)")
if m.get("query_log_disabled") is not True: fail("manifest.query_log_disabled phải là true")
ok(f"quét transcript {len(rs)} lượt ({nviol} vi phạm, đều bị loại), {nb} lần dựng/làm mới không mạng, quét {len(shas)} cây sạch")
