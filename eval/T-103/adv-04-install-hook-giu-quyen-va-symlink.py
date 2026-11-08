#!/usr/bin/env python3
"""T-103 adv-04 (tầng 3). Spec T-101 mục 1: chỉ chạm khoá hooks, khoá khác (env...) giữ nguyên; không đổi file khác.
Input: (a) settings.json quyền 0600 (khoá env có thể chứa bí mật); (b) settings.json là symlink tới file dotfiles.
Mong: (a) sau install-hook quyền vẫn 0600 (không lộ env cho user khác); (b) vẫn là symlink, file đích nhận hook."""
import sys, os, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish

fails = []
b = Box()
st = b.home / ".claude" / "settings.json"
st.write_text(json.dumps({"env": {"SOME_TOKEN": "giả"}})); os.chmod(st, 0o600)
b.run(["install-hook"])
mode = st.stat().st_mode & 0o777
if mode != 0o600:
    fails.append(f"quyền đổi 0600 → {oct(mode)}")
st.unlink()
real = b.d / "dotfiles" / "settings.json"; real.parent.mkdir(); real.write_text("{}")
st.symlink_to(real)
b.run(["install-hook"])
if not st.is_symlink():
    fails.append("symlink bị thay bằng file thường")
if "hooks" not in json.loads(real.read_text()):
    fails.append("file đích của symlink không nhận hook")
finish(fails)
