"""Thư viện dùng chung của eval T-102. Chỉ đọc hồ sơ thí nghiệm và trạng thái máy; không nhắc cách cài Graphify."""
import glob, json, math, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
FRONT = os.environ.get("TOHONG_FRONT_REPO") or "/home/user/tohong-front"
REPORT = os.path.join(HQ, "insights", "T-102-graphify-do-token.md")
RUNS = os.path.join(HQ, "insights", "T-102-runs")
MANIFEST = os.path.join(RUNS, "install-manifest.json")
TH = json.load(open(os.path.join(HERE, "thresholds.json"), encoding="utf-8"))

def fail(msg): print("FAIL " + msg); sys.exit(1)
def ok(msg): print("PASS " + msg); sys.exit(0)

def report_text():
    if not os.path.isfile(REPORT): fail("chưa có báo cáo insights/T-102-graphify-do-token.md")
    return open(REPORT, encoding="utf-8").read()

def runs():
    fs = sorted(glob.glob(os.path.join(RUNS, "T-*-[AB]-r*.json")))
    if not fs: fail("chưa có hồ sơ lượt chạy insights/T-102-runs/T-xxx-<A|B>-r<n>.json")
    out = []
    for f in fs:
        try: out.append(json.load(open(f, encoding="utf-8")))
        except Exception as e: fail(f"{os.path.basename(f)} không phải JSON: {e}")
    return out

def manifest():
    if not os.path.isfile(MANIFEST): fail("chưa có insights/T-102-runs/install-manifest.json")
    return json.load(open(MANIFEST, encoding="utf-8"))

def pricing():
    return json.load(open(os.path.join(HQ, "scripts", "pricing.json"), encoding="utf-8"))["models"]

def usd_of(model, t):
    p = pricing().get(model)
    if not p: fail(f"model {model} không có trong scripts/pricing.json")
    return (t["input"] * p["input"] + t["cache_read"] * p["cache_read"]
            + t["cache_write"] * p["cache_write_5m"] + t["output"] * p["output"]) / 1e6

def verdict(rs):
    """Kết luận cơ học từ hồ sơ + thresholds.json. Trả (verdict, reduction, chi tiết)."""
    tasks = sorted({r["task"] for r in rs})
    ratios = []
    for t in tasks:
        a = [r["usd"] for r in rs if r["task"] == t and r["arm"] == "A"]
        b = [r["usd"] for r in rs if r["task"] == t and r["arm"] == "B"]
        ratios.append(statistics.median(b) / statistics.median(a))
    red = 1 - sum(ratios) / len(ratios)
    cheaper = sum(1 for x in ratios if x < 1)
    need = math.ceil(len(tasks) * TH["adopt_tasks_cheaper_fraction"] - 1e-9)
    def grp(arm): return [r for r in rs if r["arm"] == arm]
    ga, gb = grp("A"), grp("B")
    green = lambda g: sum(1 for r in g if r["gate_green_first"]) / len(g)
    ret = lambda g: sum(r["returns"] for r in g) / len(g)
    gate_ok = green(gb) >= green(ga) and ret(gb) <= ret(ga)
    if red >= TH["adopt_reduction_min"] and cheaper >= need and gate_ok: v = "ADOPT"
    elif red < TH["drop_reduction_max"] or not gate_ok: v = "DROP"
    else: v = "INCONCLUSIVE"
    return v, red, dict(ratios=ratios, cheaper=cheaper, need=need, gate_ok=gate_ok)
