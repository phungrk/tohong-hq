#!/usr/bin/env python3
"""Tiêu chí 8: đồ thị không cũ. Mỗi lượt arm B ghi graph.tree_sha = cây git lúc bắt đầu lượt (kiểm lại bằng git); graph.refresh_count >= 1 + số lần trả việc;
build_tokens là số (0 nếu chỉ-mã); lượt arm A không có đồ thị."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
rs = runs()
nb = 0
for r in rs:
    tag = f"{r['task']}-{r['arm']}-r{r['rep']}"
    tree = subprocess.run(["git", "-C", FRONT, "rev-parse", r["base_sha"] + "^{tree}"], capture_output=True, text=True).stdout.strip()
    if not tree or tree != r["start_tree_sha"]: fail(f"{tag}: start_tree_sha không khớp cây của base_sha")
    g = r.get("graph")
    if r["arm"] == "A":
        if g: fail(f"{tag}: arm A không được có đồ thị")
        continue
    nb += 1
    if not g: fail(f"{tag}: arm B thiếu khối graph")
    if g.get("tree_sha") != tree: fail(f"{tag}: đồ thị dựng cho cây khác cây bắt đầu lượt")
    if not isinstance(g.get("build_tokens"), int): fail(f"{tag}: graph.build_tokens phải là số nguyên")
    if g.get("refresh_count", 0) < 1 + r["returns"]: fail(f"{tag}: refresh_count {g.get('refresh_count')} < 1 + số lần trả việc {r['returns']}")
    if "files_changed_after_last_refresh" not in g: fail(f"{tag}: thiếu files_changed_after_last_refresh")
if not nb: fail("không có lượt arm B")
ok(f"{nb} lượt arm B có đồ thị khớp cây, làm mới đủ")
