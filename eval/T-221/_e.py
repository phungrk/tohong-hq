"""Helper eval T-221: dùng lại thế giới giả + Root của eval/T-219/_t219.py; PYTHONPATH trỏ fake lỗi của T-221 (bọc fake T-219)."""
import os, re, sys, json
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-219"))
import _t219 as T  # noqa: E402

FAKE_ERR = os.path.join(HERE, "_fake_err")
LINE = re.compile(r"^P0_HTTP_ERROR kind=(gemini|text_search|details) status=(\d{3}) reason=(\S*) message=(.*)$")
KEY_RE = re.compile(r"AIza[0-9A-Za-z_-]{35}")
# khoá giả KHÁC khoá môi trường: eval kiểm che theo mẫu, không chỉ che đúng giá trị khoá đang chạy
KEY_X = "AIza" + "SyDEADBEEFcafe0123456789_-abcdefghi"[:35]
assert len(KEY_X) == 39


def run(fx, err, argv=None, run_id="221", world=None, **kw):
    """Chạy P0 thật (offline) với lỗi tuỳ ý. Trả (rc, out, calls, root)."""
    files, removed, fx0, meta = world or T.world()
    f = dict(fx0, **fx) if fx else fx0
    r = T.Root(files, removed)
    sp = os.path.join(r.base, "err_sent.jsonl")
    rc, out, calls = r.run(argv or T.std_args(), f, run_id=run_id, env_extra={"PYTHONPATH": FAKE_ERR, "FAKE_ERR": json.dumps(err), "FAKE_ERR_SENT": sp}, **kw)
    r.err_sent = [json.loads(l) for l in open(sp, encoding="utf-8")] if os.path.exists(sp) else []   # giá trị đã gửi ở mỗi lượt bị thay bằng lỗi
    return rc, out, calls, r


def lines(out):
    return out.splitlines()


def errs(out):
    return [l for l in lines(out) if l.startswith("P0_HTTP_ERROR")]


def strip_err(out):
    return "\n".join(l for l in lines(out) if not l.startswith("P0_HTTP_ERROR"))


def leaked(text):
    """Trả mô tả nếu text còn chứa khoá (đủ dạng AIza…, khoá môi trường, khoá giả của eval, đoạn >=12 ký tự đầu)."""
    for s in (T.MAPS_KEY, T.GEM_KEY, KEY_X):
        if s in text or s[:12] in text:
            return s[:8] + "…"
    if KEY_RE.search(text):
        return "chuỗi dạng AIza…"
    return None
