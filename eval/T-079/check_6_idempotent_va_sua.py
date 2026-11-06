#!/usr/bin/env python3
"""T-079 tiêu chí 6: một bình luận chỉ quyết tối đa MỘT lần. Chạy lại cùng sự kiện, hoặc sửa bình luận sau khi đã quyết,
không thêm sự kiện nào và không đổi nội dung đã ghi. Sửa 'xin chào' thành '/ok …' thì tính như bình luận mới (1 lần)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _lib import Box, payload
fails = []
B = Box()
try:
    tid = B.new(issue=7)
    r1 = B.ok(payload("/ok phuongan-alpha", cid=1001))
    n1, snap = len(B.events()), B.snapshot()
    if r1["verdict"] != "decided": fails.append(f"lần đầu: {r1['verdict']}/{r1['reason']}")
    # 1) chạy lại đúng sự kiện cũ
    r = B.ok(payload("/ok phuongan-alpha", cid=1001))
    if B.snapshot() != snap or r["verdict"] != "duplicate": fails.append(f"chạy lại cùng sự kiện: verdict={r['verdict']}, sổ cái đổi={B.snapshot()!=snap}")
    elif not r["reply"].startswith("<!-- tohong-ok:1001:decided -->") or "phuongan-alpha" not in r["reply"]:
        fails.append("duplicate phải trả lại câu xác nhận (cùng marker) để bổ sung nếu lần trước đăng lỗi")
    # 2) sửa bình luận đã quyết thành nội dung khác
    r = B.ok(payload("/ok phuongan-beta", cid=1001, action="edited"))
    if B.snapshot() != snap or r["verdict"] != "duplicate": fails.append(f"sửa bình luận đã quyết: verdict={r['verdict']}, sổ cái đổi={B.snapshot()!=snap}")
    elif "phuongan-beta" in r["reply"] or "phuongan-alpha" not in r["reply"]:
        fails.append("sửa bình luận đã quyết: câu trả lời phải nêu nội dung ĐÃ GHI (alpha), không phải bản sửa (beta)")
    # 3) việc leo thang lại lần nữa, rồi sửa bình luận cũ: vẫn không quyết lại bằng bình luận cũ
    B.task("escalate", tid, "--by", "chief-of-staff", "--note", "câu hỏi mới")
    snap2 = B.snapshot()
    r = B.ok(payload("/ok phuongan-gamma", cid=1001, action="edited"))
    if B.snapshot() != snap2 or r["verdict"] != "duplicate": fails.append(f"bình luận cũ quyết lại câu hỏi mới: verdict={r['verdict']}")
    # 4) bình luận MỚI sau khi leo thang lại thì quyết được (1 lần)
    r = B.ok(payload("/ok phuongan-delta", cid=1002))
    ev = B.events()
    if r["verdict"] != "decided" or ev[-1]["detail"] != "phuongan-delta" or ev[-1]["link"].endswith("1002") is False:
        fails.append(f"bình luận mới sau leo thang lại: verdict={r['verdict']}")
    if sum(1 for e in ev if e["event"] == "decided") != 2: fails.append("tổng số sự kiện decided phải là 2")
finally:
    B.close()
# 5) sửa 'xin chào' -> '/ok …' khi đang chờ quyết: quyết đúng 1 lần, chạy lại không quyết thêm
B = Box()
try:
    B.new(issue=7)
    r = B.ok(payload("xin chào", cid=2001))
    if r["verdict"] == "decided": fails.append("'xin chào' không được quyết")
    r = B.ok(payload("/ok sau-khi-sua", cid=2001, action="edited"))
    n = sum(1 for e in B.events() if e["event"] == "decided")
    if r["verdict"] != "decided" or n != 1: fails.append(f"sửa thành /ok: verdict={r['verdict']} số decided={n}")
    r = B.ok(payload("/ok sau-khi-sua", cid=2001, action="edited"))
    if sum(1 for e in B.events() if e["event"] == "decided") != 1: fails.append("chạy lại sự kiện edited quyết thêm lần hai")
finally:
    B.close()
assert not fails, "\n".join(fails)
print("PASS mỗi bình luận quyết tối đa một lần; chạy lại/sửa không đổi sổ cái; bình luận mới quyết được")
