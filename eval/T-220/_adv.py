"""Helper cho eval đối kháng T-220: dùng lại thế giới giả và Root của eval/T-219/_t219.py; PYTHONPATH trỏ fake của T-220 (bọc fake T-219)."""
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-219"))
import _t219 as T  # noqa: E402

FAKE_ADV = os.path.join(HERE, "_fake_adv")


def env(**kw):
    e = {"PYTHONPATH": FAKE_ADV}
    e.update(kw)
    return e
