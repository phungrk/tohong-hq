"""Helper dùng chung cho eval T-073. Tìm repo sản phẩm theo biến môi trường, rồi thư mục anh em của tohong-hq.
  TOHONG_REPO      = repo `tohong` (có tools/scraper/…). Mặc định: ../tohong so với gốc tohong-hq.
  TOHONG_BACK_REPO = repo `tohong-back` (có lib/vendorPool.generated.js). Mặc định: ../tohong-back."""
import json, os, sys

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def repo(env, marker, sibling):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sibling)):
        if c and os.path.isfile(os.path.join(c, marker)):
            return os.path.abspath(c)
    print("FAIL không tìm thấy repo %s (đặt %s=<đường dẫn>; đã thử ../%s)" % (sibling, env, sibling))
    sys.exit(1)


def tohong():
    return repo("TOHONG_REPO", os.path.join("tools", "scraper", "extractors", "style_tags.py"), "tohong")


def back():
    return repo("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")


def load_pool(path):
    s = open(path, encoding="utf-8").read()
    return json.loads(s[s.index("= [") + 2 : s.rindex("]") + 1])


def scraper_on_path(root):
    sys.path.insert(0, os.path.join(root, "tools", "scraper"))
