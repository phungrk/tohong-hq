"""Dùng chung cho eval T-201. Repo back lấy từ TOHONG_BACK_REPO (mặc định /home/user/tohong-back, như inv-004 planner/admin)."""
import os, sys, tomllib

BACK = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
TOML = os.path.join(BACK, "wrangler.toml")

def load():
    if not os.path.isfile(TOML):
        print("ERROR không thấy " + TOML); sys.exit(2)
    try:
        return tomllib.load(open(TOML, "rb"))
    except Exception as e:
        print("FAIL wrangler.toml không parse được: %s" % e); sys.exit(1)
