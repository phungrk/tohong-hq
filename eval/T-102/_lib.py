"""Thư viện dùng chung của eval T-102. Chỉ đọc hồ sơ thí nghiệm và trạng thái máy; không nhắc cách cài Graphify."""
import datetime as dt, glob, hashlib, json, math, os, re, shlex, statistics, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
FRONT = os.environ.get("TOHONG_FRONT_REPO") or "/home/user/tohong-front"
HOME = os.environ.get("T102_HOME") or os.path.expanduser("~")
REPORT = os.path.join(HQ, "insights", "T-102-graphify-do-token.md")
RUNS = os.path.join(HQ, "insights", "T-102-runs")
MANIFEST = os.path.join(RUNS, "install-manifest.json")
TH = json.load(open(os.path.join(HERE, "thresholds.json"), encoding="utf-8"))
VN = dt.timezone(dt.timedelta(hours=7))   # sổ cái ghi giờ Việt Nam
ARMS = ("A", "B")

def fail(msg): print("FAIL " + msg); sys.exit(1)
def ok(msg): print("PASS " + msg); sys.exit(0)

def parse_ts(s, what="thời điểm"):
    """So sánh bằng giờ có múi. Chuỗi không có hậu tố múi giờ bị từ chối (trừ locked_at đã có +07:00)."""
    if not isinstance(s, str): fail(f"{what} không phải chuỗi thời gian")
    s = s.strip()
    try: d = dt.datetime.fromisoformat(s[:-1] + "+00:00" if s.endswith("Z") else s)
    except ValueError: fail(f"{what} không đọc được: {s!r}")
    if d.tzinfo is None: fail(f"{what} thiếu múi giờ (cần Z hoặc ±hh:mm): {s!r}")
    return d

def report_text():
    if not os.path.isfile(REPORT): fail("chưa có báo cáo insights/T-102-graphify-do-token.md")
    return open(REPORT, encoding="utf-8").read()

def runs():
    """Mọi hồ sơ lượt đã khởi chạy, kể cả lượt bị loại, theo seq."""
    fs = sorted(glob.glob(os.path.join(RUNS, "T-*-[AB]-r*.json")))
    if not fs: fail("chưa có hồ sơ lượt chạy insights/T-102-runs/T-xxx-<A|B>-r<n>.json")
    out = []
    for f in fs:
        try: out.append(json.load(open(f, encoding="utf-8")))
        except Exception as e: fail(f"{os.path.basename(f)} không phải JSON: {e}")
    try: out.sort(key=lambda r: r["seq"])
    except Exception: fail("có hồ sơ thiếu seq")
    return out

def is_excl(r): return r.get("excluded") is True
def valid(rs): return [r for r in rs if not is_excl(r)]
def tag(r): return f"{r.get('task')}-{r.get('arm')}-r{r.get('rep')}"

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

def sha256_file(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()

# ---------------------------------------------------------------- kết luận cơ học
def verdict(rs):
    """Kết luận cơ học trên các lượt HỢP LỆ. Thiếu ô thì ('INCOMPLETE', None, {})."""
    rs = valid(rs)
    tasks = sorted({r["task"] for r in rs})
    if not tasks: return "INCOMPLETE", None, {}
    ratios = []
    for t in tasks:
        a = [r["usd"] for r in rs if r["task"] == t and r["arm"] == "A"]
        b = [r["usd"] for r in rs if r["task"] == t and r["arm"] == "B"]
        if not a or not b or statistics.median(a) == 0: return "INCOMPLETE", None, {}
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

def spread(c):
    med = statistics.median(x["usd"] for x in c)
    return (max(x["usd"] for x in c) - min(x["usd"] for x in c)) / med if med else 0

def structure(rs):
    """Số lượt hợp lệ mỗi ô PHẢI đúng một con số suy ra được từ chính hồ sơ (chống tuyển lọc):
    n0 = 2 (+1 nếu hai lượt hợp lệ đầu của ô rộng > 30%); nếu kết luận trên n0 lượt là INCONCLUSIVE thì +1 cho MỌI ô.
    Trả (complete, errors, info). errors = vượt/thiếu so với con số đó."""
    v = valid(rs)
    tasks = sorted({r["task"] for r in v})
    errs, cellsd, n0 = [], {}, {}
    for t in tasks:
        for arm in ARMS:
            c = sorted([r for r in v if r["task"] == t and r["arm"] == arm], key=lambda r: r["seq"])
            cellsd[(t, arm)] = c
            if len(c) < TH["reps_base_per_cell"]: errs.append(f"{t}-{arm}: mới {len(c)} lượt hợp lệ, cần >= {TH['reps_base_per_cell']}"); n0[(t, arm)] = None; continue
            n0[(t, arm)] = TH["reps_base_per_cell"] + (1 if spread(c[:TH["reps_base_per_cell"]]) > TH["extra_rep_if_cell_spread_over"] else 0)
    if errs or not tasks: return False, errs or ["chưa có lượt hợp lệ"], {}
    ph1 = [r for k, c in cellsd.items() for r in c[:n0[k]]]
    short1 = [f"{k[0]}-{k[1]}: ô rộng cần lượt thứ {n0[k]}, mới {len(c)}" for k, c in cellsd.items() if len(c) < n0[k]]
    if short1: return False, short1, {}
    v1 = verdict(ph1)[0]
    exp = {k: n0[k] + (TH["inconclusive_extra_reps_per_cell"] if v1 == "INCONCLUSIVE" else 0) for k in cellsd}
    over = [f"{k[0]}-{k[1]}: {len(c)} lượt hợp lệ, tối đa được phép {exp[k]}" for k, c in cellsd.items() if len(c) > exp[k]]
    if over: errs += ["vượt số lượt cho phép (kết luận pha 1 = %s): " % v1 + "; ".join(over)]
    over_max = [f"{k[0]}-{k[1]}" for k, c in cellsd.items() if len(c) > TH["reps_max_per_cell"]]
    if over_max: errs.append("vượt trần reps_max_per_cell: " + ", ".join(over_max))
    under = [f"{k[0]}-{k[1]}: {len(c)}/{exp[k]}" for k, c in cellsd.items() if len(c) < exp[k]]
    return (not errs and not under), errs + ([("chưa đủ lượt: " + "; ".join(under))] if under else []), dict(v1=v1, exp=exp)

# ---------------------------------------------------------------- ngân sách
def ledger_events():
    p = os.path.join(HQ, "ledger", "events.jsonl")
    if not os.path.isfile(p): return []
    out = []
    for l in open(p, encoding="utf-8"):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out

def _usd_in_text(text, usd):
    n = ("%d" % usd) if float(usd).is_integer() else ("%g" % usd)
    return bool(re.search(r"(\$\s?%s(?:[.,]0+)?(?![\d.,]*\d)|(?<![\d.,])%s(?:[.,]0+)?\s?(?:USD|usd|\$|đô))" % (re.escape(n), re.escape(n)), text))

def raises():
    """Các khoản Capu duyệt thêm vào ngân sách. KHÔNG đọc trường budget của board (task.py không đổi được nó sau khi tạo việc).
    Mỗi mục hợp lệ khi: decision_ref trỏ tới file decisions/ có nhắc T-102 và ghi đúng số tiền, VÀ ledger có sự kiện decided|escalated của T-102
    mà detail hoặc link nhắc tên file decision đó. Mục sai = FAIL (không bỏ qua im lặng)."""
    p = os.path.join(HERE, "budget-raises.json")
    if not os.path.isfile(p): return []
    ev = ledger_events()
    out = []
    for x in json.load(open(p, encoding="utf-8")).get("raises", []):
        rf = x.get("decision_ref", "")
        ref = os.path.join(HQ, rf)
        if not rf or not rf.startswith("decisions/") or not os.path.isfile(ref): fail(f"budget-raises.json: decision_ref {rf!r} không phải file trong decisions/")
        txt = open(ref, encoding="utf-8").read()
        if "T-102" not in txt: fail(f"budget-raises.json: {rf} không nhắc T-102")
        try: usd = float(x["usd"])
        except Exception: fail(f"budget-raises.json: mục {rf} thiếu usd")
        if usd <= 0: fail(f"budget-raises.json: mục {rf} có usd <= 0")
        if not _usd_in_text(txt, usd): fail(f"budget-raises.json: {rf} không ghi đúng số tiền ${usd:g}")
        base = os.path.basename(rf)
        if not any(e.get("task") == "T-102" and e.get("event") in ("decided", "escalated") and base in (str(e.get("detail", "")) + " " + str(e.get("link", ""))) for e in ev):
            fail(f"budget-raises.json: ledger không có sự kiện decided/escalated của T-102 nhắc {base}")
        out.append((parse_ts(x["approved_at"], "approved_at"), usd))
    return out

def cap_at(when):
    """approved(t) = ngân sách lúc tạo việc ($5) + tổng các khoản đã duyệt có approved_at <= t. Đây là TRẦN HIỆU LỰC duy nhất."""
    return TH["board_budget_at_creation_usd"] + sum(u for t, u in raises() if t <= when)

def stop_file():
    p = os.path.join(RUNS, "stop.json")
    return json.load(open(p, encoding="utf-8")) if os.path.isfile(p) else None

# ---------------------------------------------------------------- quét transcript
def tool_calls(path):
    if not os.path.isfile(path): fail(f"transcript không có: {path}")
    for i, line in enumerate(open(path, encoding="utf-8", errors="replace"), 1):
        line = line.strip()
        if not line: continue
        try: o = json.loads(line)
        except Exception: fail(f"transcript {os.path.basename(path)} dòng {i} không phải JSON")
        m = o.get("message") or {}
        c = m.get("content")
        if o.get("type") == "assistant" and isinstance(c, list):
            for b in c:
                if isinstance(b, dict) and b.get("type") == "tool_use":
                    yield b.get("name", ""), (b.get("input") or {})

# Chỉ các lệnh KHÔNG thể chạy lệnh khác mới được nhắc chữ graphify (đọc/tìm chuỗi). find/sed/awk/git/xargs/env/rg/sort/less/echo... có thể thực thi, nên KHÔNG nằm đây.
_BENIGN = ("cat", "grep", "egrep", "fgrep", "ls", "head", "tail", "wc", "stat", "file", "diff", "tree")
_BARE = re.compile(r"graphify(?!-out)", re.I)      # chữ graphify không phải là thư mục đầu ra graphify-out

def _split(cmd):
    """Tách lệnh theo ; && || | xuống dòng, $( và dấu huyền, nhưng KHÔNG tách bên trong nháy đơn hay nháy kép."""
    segs, cur, q, i = [], "", None, 0
    while i < len(cmd):
        c = cmd[i]
        if q:
            cur += c
            if c == q: q = None
            elif c == "\\" and q == '"' and i + 1 < len(cmd): cur += cmd[i + 1]; i += 1
        elif c in "'\"": q = c; cur += c
        elif cmd.startswith(("&&", "||"), i): segs.append(cur); cur = ""; i += 1
        elif cmd.startswith("$(", i): segs.append(cur); cur = ""; i += 1
        elif c in ";|\n`()": segs.append(cur); cur = ""
        else: cur += c
        i += 1
    segs.append(cur)
    return segs

def _segments(cmd):
    for seg in _split(cmd):
        try: toks = shlex.split(seg)
        except ValueError: toks = seg.split()
        while toks and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0]): toks = toks[1:]
        if toks: yield seg, toks

def graphify_violations(name, inp):
    out = []
    if name == "Skill" and re.search("graphify", json.dumps(inp), re.I): out.append("skill_call")
    if name in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        fp = str(inp.get("file_path", ""))
        body = " ".join(str(inp.get(k, "")) for k in ("content", "new_string"))
        if fp.endswith(".graphifyignore"): out.append("ignore_edit")
        elif re.search("graphify", body, re.I) and re.search(r"(\.(sh|bash|py|js|cjs|mjs|ts)|Makefile|package\.json)$", fp): out.append("indirect_script")
    if name == "Bash":
        cmd = str(inp.get("command", ""))
        if re.search(r"(?i)\bunset\s+GRAPHIFY|GRAPHIFY_[A-Z_]+\s*=", cmd): out.append("env_tamper")
        for seg, toks in _segments(cmd):
            exe = os.path.basename(toks[0])
            if exe == "graphify":
                sub = next((t for t in toks[1:] if not t.startswith("-")), "")
                if sub not in TH["agent_graphify_subcommands"]: out.append(f"subcommand:{sub or '?'}")
                if any(t.split("=")[0] in TH["graphify_forbidden_flags"] for t in toks[1:]): out.append("forbidden_flag")
            elif _BARE.search(seg) and exe not in _BENIGN: out.append(f"indirect:{exe}")
    return out

def _git_sub(toks):
    i = 1
    while i < len(toks):
        t = toks[i]
        if t in ("-C", "-c", "--git-dir", "--work-tree"): i += 2; continue
        if t.startswith("-"): i += 1; continue
        return t, toks[i + 1:]
    return "", []

def _is_ancestor(tok, base):
    r = subprocess.run(["git", "-C", FRONT, "rev-parse", "--verify", "--quiet", tok + "^{commit}"], capture_output=True, text=True)
    if r.returncode: return True          # không phải commit: bỏ qua
    return subprocess.run(["git", "-C", FRONT, "merge-base", "--is-ancestor", r.stdout.strip(), base]).returncode == 0

PEEK_SUBS = {"log", "show", "reflog", "rev-list", "branch", "tag", "for-each-ref", "cat-file", "ls-tree", "checkout", "switch", "fetch", "stash", "worktree", "remote", "merge-base", "show-ref"}

def peek_violations(name, inp, base_sha):
    out = []
    front_re = re.compile(re.escape(FRONT) + r"(?!/node_modules)|/home/user/tohong-front(?!/node_modules)")
    blob = " ".join(str(v) for v in inp.values()) if name in ("Read", "Grep", "Glob", "Edit", "Write", "MultiEdit") else str(inp.get("command", ""))
    if name in ("Bash", "Read", "Grep", "Glob", "Edit", "Write", "MultiEdit") and front_re.search(blob): out.append("outside_worktree")
    if name == "Bash":
        base = subprocess.run(["git", "-C", FRONT, "rev-parse", base_sha], capture_output=True, text=True).stdout.strip()
        for seg, toks in _segments(str(inp.get("command", ""))):
            if os.path.basename(toks[0]) != "git": continue
            sub, args = _git_sub(toks)
            if sub in PEEK_SUBS: out.append(f"git {sub}")
            for a in args:
                if a in ("--all", "--branches", "--remotes", "main", "master") or a.startswith(("origin/", "refs/", "remotes/")): out.append(f"git ref {a}")
                for h in re.findall(r"(?<![0-9a-zA-Z])[0-9a-f]{7,40}(?![0-9a-zA-Z])", a):
                    if base and not _is_ancestor(h, base): out.append(f"git sha {h[:8]} sau base")
    return out

def scan_run(r):
    """Quét lại các transcript của lượt. Trả (peek, gviol) là hai danh sách chuỗi."""
    peek, gv = [], []
    ts = r.get("transcripts")
    if not isinstance(ts, list) or not ts: fail(f"{tag(r)}: thiếu transcripts (danh sách {{path, sha256}})")
    for t in ts:
        p = os.path.join(HQ, t.get("path", ""))
        if not os.path.isfile(p): fail(f"{tag(r)}: transcript {t.get('path')} không nằm trong repo")
        if sha256_file(p) != t.get("sha256"): fail(f"{tag(r)}: sha256 transcript {t.get('path')} không khớp hồ sơ (bị sửa)")
        for name, inp in tool_calls(p):
            peek += peek_violations(name, inp, r["base_sha"])
            if r.get("arm") == "B": gv += graphify_violations(name, inp)
    return peek, gv

# ---------------------------------------------------------------- khoanh vùng (check_2, check_3)
def expand(p):
    return p.replace("<HQ>", HQ).replace("<FRONT>", FRONT).replace("~", HOME, 1) if p.startswith(("~", "<")) else p

def watch_files():
    """Danh sách (path, size, mtime_ns) của watch_roots, bỏ snapshot_skip. Dùng để tạo/so ảnh chụp."""
    skip = [expand(s) for s in TH["snapshot_skip"]]
    roots = []
    for w in TH["watch_roots"]:
        if w == "~/<dotfile-cấp-một>": roots += [os.path.join(HOME, f) for f in sorted(os.listdir(HOME)) if f.startswith(".") and os.path.isfile(os.path.join(HOME, f))]
        else: roots.append(expand(w))
    out = {}
    for r in roots:
        if os.path.isfile(r):
            st = os.stat(r); out[r] = (st.st_size, st.st_mtime_ns); continue
        for d, ds, fs in os.walk(r):
            ds[:] = [x for x in ds if x not in skip and os.path.join(d, x) not in skip and x != "node_modules"]
            for f in fs:
                p = os.path.join(d, f)
                try: st = os.lstat(p)
                except OSError: continue
                out[p] = (st.st_size, st.st_mtime_ns)
    return out

def read_snapshot(name):
    p = os.path.join(RUNS, name)
    if not os.path.isfile(p): fail(f"chưa có insights/T-102-runs/{name} (ảnh chụp để tính paths_written)")
    out = {}
    for line in open(p, encoding="utf-8"):
        if line.strip():
            a, b, c = line.rstrip("\n").split("\t"); out[a] = (int(b), int(c))
    return out

def exclusion_paths(names=None):
    ex = [expand(e["path"]) for e in TH["allowed_exclusions"] if names is None or e["path"] in names]
    return ex

def under(p, base): return p == base or p.startswith(base.rstrip("/") + os.sep)

def paths_written(before, after, exclusions):
    """ĐỊNH NGHĨA DUY NHẤT: tập đường dẫn trong watch_roots mà ảnh chụp ĐẦU thí nghiệm (trước khi cài) và ảnh chụp SAU LƯỢT CHẠY CUỐI
    (trước khi gỡ) khác nhau (mới, đổi kích thước/mtime, hoặc mất), trừ các mục trong exclusions."""
    ch = {p for p in set(before) | set(after) if before.get(p) != after.get(p)}
    return sorted(p for p in ch if not any(under(p, e) for e in exclusions))

GRAPHIFY = re.compile(r"graphify", re.I)
def _small_text(p):
    try:
        if os.path.getsize(p) > 256_000: return None
        b = open(p, "rb").read()
        return None if b"\0" in b else b.decode("utf-8", "ignore")
    except OSError: return None

def scan(base, content=True, skip=()):
    hits = []
    if not os.path.exists(base): return hits
    if os.path.isfile(base):
        t = _small_text(base) if content else None
        return [base] if GRAPHIFY.search(os.path.basename(base)) or (t and GRAPHIFY.search(t)) else []
    for d, ds, fs in os.walk(base):
        ds[:] = [x for x in ds if os.path.join(d, x) not in skip and x not in ("node_modules", "__pycache__", "objects")]
        for n in ds + fs:
            if GRAPHIFY.search(n): hits.append(os.path.join(d, n))
        if content:
            for f in fs:
                p = os.path.join(d, f)
                t = _small_text(p)
                if t and GRAPHIFY.search(t) and p not in hits: hits.append(p)
    return hits

def live_traces():
    """Quét trạng thái THẬT hiện tại, rộng hơn một file log. Trả danh sách (vùng, đường dẫn)."""
    out = []
    add = lambda zone, hs: out.extend((zone, h) for h in hs)
    for sub in (".claude", "scripts", "templates", "CLAUDE.md", "handbook", "routines", ".github"):
        add("tohong-hq/" + sub, scan(os.path.join(HQ, sub)))
    c = os.path.join(HOME, ".claude")
    cfg = [os.path.join(c, x) for x in ("settings.json", "settings.local.json", "CLAUDE.md", "skills", "hooks", "commands", "agents", "plugins")]
    for p in cfg: add("~/.claude", scan(p))
    if os.path.isdir(c):                                                         # mọi nơi khác trong ~/.claude: chỉ xét TÊN
        add("~/.claude(tên)", scan(c, content=False, skip=(os.path.join(c, "projects"),)))
    for f in (".claude.json", ".bashrc", ".profile", ".zshrc", ".bash_profile", ".zprofile"): add("~/" + f, scan(os.path.join(HOME, f)))
    add("~/.config", scan(os.path.join(HOME, ".config")))
    for d in (".cache", ".local", ".npm", ".agents"): add("~/" + d, scan(os.path.join(HOME, d), content=False))
    g = os.path.join(FRONT, ".git")
    for f in ("config", "config.worktree"): add("tohong-front/.git", scan(os.path.join(g, f)))
    for sub in ("info", "hooks"): add("tohong-front/.git/" + sub, scan(os.path.join(g, sub)))
    add("tohong-front/.git(tên)", scan(g, content=False))
    st = subprocess.run(["git", "-C", FRONT, "status", "--porcelain"], capture_output=True, text=True).stdout
    if GRAPHIFY.search(st) or os.path.exists(os.path.join(FRONT, "graphify-out")) or os.path.exists(os.path.join(FRONT, ".graphifyignore")):
        out.append(("tohong-front (cây làm việc)", FRONT))
    return out
