"""Khung chung cho eval T-232 (không phải eval). Dùng lại eval/lib/regen_fixture.py qua eval/T-230/lib230.py: bản sao tạm tohong (+ back), chặn mạng.
Repo: TOHONG_REPO (mặc định ../tohong), TOHONG_BACK_REPO (mặc định ../tohong-back). Chạy check: python3 -I <file>."""
import json, os, subprocess, sys
sys.dont_write_bytecode = True
_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(_here), "T-230"))
from lib230 import build, counts, report, Fail, run, R  # noqa: E402,F401

VALID = ["found", "not_found", "address_mismatch", "wrong_category"]


def cat_of(path):
    return path.replace("\\", "/").split("/")[-2]


def files_by_cat(fx):
    return {cat_of(f): f for f in fx.source_files()}


def edit(fx, cat, fn):
    """fn(list vendors) sửa tại chỗ bản ghi của file hạng mục cat."""
    f = files_by_cat(fx)[cat]
    d = json.load(open(f, encoding="utf-8"))
    vs = d["vendors"] if isinstance(d, dict) else d
    fn(vs)
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def rec(vs, vid):
    return next(v for v in vs if v.get("id") == vid)


def ai_log(value=None, **more):
    ch = dict(more)
    if value is not None or "ai_mode_result" in more:
        ch.setdefault("ai_mode_result", value)
    return {"source": "google_ai_mode", "timestamp": "2026-11-28T00:00:00Z", "changes": ch}


def flag(fx, cat, vid, value, log=True, log_value="same", **extra):
    """Đặt ai_mode_result=value trên bản ghi vid của hạng mục cat; log=True thêm dòng google_ai_mode có changes.ai_mode_result (= value, hoặc log_value)."""
    def fn(vs):
        v = rec(vs, vid)
        v["ai_mode_result"] = value
        v.update(extra)
        if log:
            v.setdefault("enrichment_log", []).append(ai_log(value if log_value == "same" else log_value))
    edit(fx, cat, fn)


def single_ids(fx, cat, n):
    c = counts(fx)
    ids = []
    for f in fx.source_files():
        if cat_of(f) != cat:
            continue
        d = json.load(open(f, encoding="utf-8"))
        ids = [v["id"] for v in (d["vendors"] if isinstance(d, dict) else d) if c[v["id"]] == 1]
    if len(ids) < n:
        raise Fail(f"hạng mục {cat} không đủ {n} vendor một bản ghi")
    return sorted(ids)[:n]


def multi_ids(fx, n):
    """Vendor có đúng 2 bản ghi ở hai hạng mục của app (không other/wedding_planner, vốn không có dòng báo cáo): [(id, [cat1, cat2])] theo id."""
    where = {}
    for f in fx.source_files():
        d = json.load(open(f, encoding="utf-8"))
        for v in (d["vendors"] if isinstance(d, dict) else d):
            where.setdefault(v["id"], []).append(cat_of(f))
    out = sorted((i, cs) for i, cs in where.items() if len(cs) == 2 and len(set(cs)) == 2 and not set(cs) & {"other", "wedding_planner"})
    if len(out) < n:
        raise Fail(f"không đủ {n} vendor hai bản ghi")
    return out[:n]


def tool(fx, *args):
    """Chạy công cụ cờ AI Mode của repo (tools/scraper/ai_mode_flags.py) trong bản sao tạm, cwd tools/scraper."""
    sc = os.path.join(fx.tohong, "tools", "scraper")
    if not os.path.isfile(os.path.join(sc, "ai_mode_flags.py")):
        raise Fail("không có tools/scraper/ai_mode_flags.py")
    p = subprocess.run([sys.executable, "ai_mode_flags.py", *args], cwd=sc, env=fx.env, capture_output=True, text=True, timeout=300)
    return p.returncode, p.stdout, p.stderr


def violations(out):
    """[(rule, category, id)] từ các dòng AI_MODE_FLAG_VIOLATION <rule> <category> <id> ..."""
    res = []
    for l in out.splitlines():
        p = l.split()
        if len(p) >= 4 and p[0] == "AI_MODE_FLAG_VIOLATION":
            res.append((p[1], p[2], p[3]))
    return res


def commit(fx, msg="buoc"):
    subprocess.run(["git", "-C", fx.tohong, "add", "-A"], capture_output=True)
    c = subprocess.run(R.GIT + ["-C", fx.tohong, "commit", "-qm", msg], capture_output=True, text=True)
    if c.returncode != 0:
        raise Fail("commit tạm lỗi: " + c.stderr[-200:])
