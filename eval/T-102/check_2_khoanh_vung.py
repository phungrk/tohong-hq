#!/usr/bin/env python3
"""Tiêu chí 2: Graphify chỉ nằm trong thư mục thí nghiệm.
(a) scratch_root = experiment_dir = thư mục riêng của T-102 trong scratchpad (không phải cả /tmp/claude-*);
(b) paths_written TÍNH LẠI từ hai ảnh chụp (đầu thí nghiệm trước khi cài; sau lượt chạy cuối trước khi gỡ) trên watch_roots, trừ allowed_exclusions
    có lý do (khai trong manifest.exclusions, phải nằm trong thresholds), phải bằng manifest.paths_written, và chỉ gồm experiment_dir (không đường dẫn nào khác: lúc cài lẫn lúc chạy);
(c) quét THẬT trạng thái máy hiện tại rộng hơn một file log: tohong-hq (vùng cấu hình), ~/.claude (cấu hình), ~/.config, ~/.cache, ~/.local, ~/.npm, ~/.agents, rc,
    tohong-front/.git (config, info/exclude, info/attributes, hooks, tên mọi mục trừ objects), cây làm việc tohong-front, công cụ toàn cục, PATH."""
import os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
m = manifest()
exp = os.path.realpath(m.get("experiment_dir", "") or "/nonexistent")
root = os.path.realpath(m.get("scratch_root", "") or "/nonexistent")
if not re.match(r"^/tmp/claude-[^/]+/.+/scratchpad/t102[\w.-]*$", root): fail(f"manifest.scratch_root phải là thư mục riêng của T-102 trong scratchpad (…/scratchpad/t102…), không phải thư mục cha: {root}")
if exp != root: fail("manifest.experiment_dir phải bằng scratch_root")
ex_names = m.get("exclusions", [])
allowed = {e["path"] for e in TH["allowed_exclusions"]}
if any(e not in allowed for e in ex_names): fail("manifest.exclusions có mục ngoài allowed_exclusions đã khoá: " + str([e for e in ex_names if e not in allowed]))
before, after = read_snapshot("fs-before.txt"), read_snapshot("fs-after-runs.txt")
pw = paths_written(before, after, exclusion_paths(set(ex_names)))
if pw: fail(f"có {len(pw)} đường dẫn ngoài thư mục thí nghiệm bị ghi/đổi/mất giữa hai ảnh chụp, vd {pw[:3]}")
if sorted(m.get("paths_written", [])) != [exp]: fail(f"manifest.paths_written phải đúng bằng [experiment_dir] (đã tính lại: không có đường dẫn nào khác), đang là {m.get('paths_written')}")
if "experiment_dir" not in m or not m.get("snapshot_before_at") or not m.get("snapshot_after_at"): fail("manifest thiếu snapshot_before_at/snapshot_after_at")
if parse_ts(m["snapshot_before_at"], "snapshot_before_at") >= min(parse_ts(r["started_at"]) for r in runs()): fail("ảnh chụp đầu không trước lượt đầu tiên")
if parse_ts(m["snapshot_after_at"], "snapshot_after_at") <= max(parse_ts(r["started_at"]) for r in runs()): fail("ảnh chụp sau không sau lượt cuối")
hits = [h for h in live_traces() if not under(h[1], exp)]
if hits: fail(f"có dấu vết Graphify ngoài thư mục thí nghiệm: {hits[:3]}")
w = shutil.which("graphify")
if w and not under(os.path.realpath(w), exp): fail(f"lệnh graphify nằm ngoài thư mục thí nghiệm: {w}")
ok("paths_written chỉ gồm thư mục thí nghiệm, không dấu vết ngoài")
