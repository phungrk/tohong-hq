"""T-147: tìm repo và vài hàm dùng chung cho eval. Repo: TOHONG_REPO, TOHONG_BACK_REPO, TOHONG_FRONT_REPO, rồi ../tohong, ../tohong-back, ../tohong-front cạnh tohong-hq."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def _find(env, rel, marker):
    for c in (os.environ.get(env), os.path.join(HQ, "..", rel)):
        if c and os.path.exists(os.path.join(c, marker)):
            return os.path.abspath(c)
    return None


def tohong():
    return _find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "enrich.py"))


def back():
    return _find("TOHONG_BACK_REPO", "tohong-back", "worker.js")


def front():
    return _find("TOHONG_FRONT_REPO", "tohong-front", "package.json")


def catalog_path(root):
    return os.path.join(root, "tools", "scraper", "pool-input-fields.json")


def embedded(back_root, name, const):
    """Đọc JSON nhúng trong lib/<name>.generated.js (export const <const> = <JSON>;)."""
    t = open(os.path.join(back_root, "lib", name), encoding="utf-8").read()
    i = t.index("export const " + const)
    i = t.index("=", i) + 1
    return json.loads(t[i:].strip().rstrip(";"))
