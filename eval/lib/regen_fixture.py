"""T-215: dựng bản sao tạm của tohong (+ tohong-back) để chạy `tools/regen-pool-styles.sh` mà KHÔNG chạm repo thật, rồi đọc kết quả.
Dùng chung cho eval/T-215/check_*.py và các bất biến đề xuất của T-215. Không mạng (python bị chặn socket qua sitecustomize), không ghi .pyc.

Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq), TOHONG_BACK_REPO (mặc định ../tohong-back); dò ngược tới scripts/gate.py (ADR-070), không đếm cấp thư mục.
Bản sao tohong = cây làm việc hiện tại (file được git theo dõi + file chưa theo dõi không bị ignore), để eval đo đúng thứ Engineering đang sửa.
  T215_REF=<commit>  ghim bản sao tohong về đúng commit đó (git archive), vd eadf6d75259578e6feab2c190033a0916ff52a29 (tohong#108 đã merge).
Bản sao tohong được `git init` + commit trong thư mục tạm để `git status --porcelain` nói đúng "cây sạch hay bẩn" (có .gitignore của repo).
Pool nền = tohong-back lib/vendorPool.generated.js ở HEAD (không lấy bản đang bẩn trên đĩa).
"""
import glob, json, os, shutil, subprocess, sys, tempfile

sys.dont_write_bytecode = True
ALLOWED = {"korean", "luxury", "rustic", "natural", "editorial", "soft", "traditional", "modern", "minimalist", "simple"}
NONET = ("import socket\ndef _b(*a, **k):\n    raise OSError('T-215: mang bi chan')\n"
         "socket.socket.connect = _b\nsocket.socket.connect_ex = _b\nsocket.create_connection = _b\nsocket.getaddrinfo = _b\n")
GIT = ["git", "-c", "user.email=eval@t215", "-c", "user.name=eval", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"]


class Fail(Exception):
    pass


def hq_root():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        d = os.path.dirname(d)
    return os.getcwd()


def find(env, marker, sibling):
    for c in (os.environ.get(env), os.path.join(hq_root(), "..", sibling)):
        if c and os.path.isfile(os.path.join(c, marker)):
            return os.path.abspath(c)
    return None


def repos(need_back=True):
    t = find("TOHONG_REPO", "tools/regen-pool-styles.sh", "tohong")
    if not t:
        raise Fail("không thấy repo tohong có tools/regen-pool-styles.sh (đặt TOHONG_REPO)")
    b = find("TOHONG_BACK_REPO", "lib/vendorPool.generated.js", "tohong-back")
    if need_back and not b:
        raise Fail("không thấy repo tohong-back có lib/vendorPool.generated.js (đặt TOHONG_BACK_REPO)")
    return t, b


def _run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def _is_git(d):
    return _run(["git", "-C", d, "rev-parse", "--git-dir"]).returncode == 0


def _copy_tree(src, dst, ref=None, skip=("node_modules",)):
    os.makedirs(dst, exist_ok=True)
    if ref:
        p = subprocess.run(f"git -C '{src}' archive '{ref}' | tar -x -C '{dst}'", shell=True, capture_output=True, text=True)
        if p.returncode != 0:
            raise Fail(f"git archive {ref} trong {src} lỗi: {p.stderr[-200:]} (git fetch origin main?)")
        return
    if _is_git(src):
        files = _run(["git", "-C", src, "ls-files", "-z", "-co", "--exclude-standard"]).stdout.split("\0")
    else:
        files = [os.path.relpath(os.path.join(r, f), src) for r, ds, fs in os.walk(src) for f in fs
                 if not any(s in os.path.join(r, f).split(os.sep) for s in skip + (".git",))]
    for rel in files:
        if not rel or any(s in rel.split("/") for s in skip):
            continue
        s = os.path.join(src, rel)
        if not os.path.isfile(s):
            continue
        d = os.path.join(dst, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        shutil.copy2(s, d, follow_symlinks=False)


class Fx:
    def __init__(self):
        self.tmp = tempfile.mkdtemp(prefix="t215-")
        self.tohong = os.path.join(self.tmp, "tohong")
        self.back = os.path.join(self.tmp, "back")
        self.env = None

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    # ---- đường dẫn dữ liệu
    def venue_file(self):
        return os.path.join(self.tohong, "tools/scraper/output/HCMC/venue/vendors.json")

    def source_files(self):
        return sorted(glob.glob(os.path.join(self.tohong, "tools/scraper/output/HCMC/*/vendors.json")))

    def pool_file(self):
        return os.path.join(self.back, "lib", "vendorPool.generated.js")

    # ---- chạy
    def regen(self, photos_for="all"):
        cmd = ["bash", "tools/regen-pool-styles.sh", "--back", self.back]
        if photos_for:
            cmd += ["--photos-for", photos_for]
        p = subprocess.run(cmd, cwd=self.tohong, env=self.env, capture_output=True, text=True, timeout=600)
        if p.returncode != 0:
            raise Fail(f"regen-pool-styles.sh thoát {p.returncode}: {(p.stderr or p.stdout)[-300:]}")
        return p

    def git_status(self):
        return [l for l in _run(["git", "-C", self.tohong, "status", "--porcelain"]).stdout.splitlines() if l]

    def pool(self):
        s = open(self.pool_file(), encoding="utf-8").read()
        return {v["id"]: v for v in json.loads(s[s.index("= [") + 2: s.rindex("]") + 1])}

    # ---- nguồn
    def records(self):
        """[(đường dẫn tương đối, bản ghi)] mọi bản ghi HCMC/*/vendors.json, theo thứ tự đường dẫn."""
        out = []
        for f in self.source_files():
            d = json.load(open(f, encoding="utf-8"))
            for v in (d["vendors"] if isinstance(d, dict) else d):
                out.append((os.path.relpath(f, self.tohong), v))
        return out

    def extractor(self):
        sc = os.path.join(self.tohong, "tools", "scraper")
        if sc not in sys.path:
            sys.path.insert(0, sc)
        from extractors.style_tags import StyleTagExtractor
        return StyleTagExtractor()

    def text_tags(self):
        """id -> tập tag extractor cho ra từ văn bản nguồn của MỌI bản ghi cùng id (đúng phép đo của bất biến pool/inv-001 (b))."""
        ex = self.extractor()
        out = {}
        for _, v in self.records():
            tags = ex.extract({"name": v.get("name") or "", "description": v.get("description") or "",
                               "merchant_description": v.get("merchant_description") or "", "top_reviews": v.get("top_reviews") or []})
            out.setdefault(v["id"], set()).update(tags)
        return out

    def expected_protected(self):
        """id -> danh sách style_tags mà pool phải mang (xem spec T-215, mục Định nghĩa)."""
        out = {}
        for _, v in self.records():
            if is_protected(v):
                cur = out.setdefault(v["id"], [])
                for t in v.get("style_tags") or []:
                    if t not in cur:
                        cur.append(t)
        return out

    def edit_venue(self, fn):
        f = self.venue_file()
        d = json.load(open(f, encoding="utf-8"))
        vs = d["vendors"] if isinstance(d, dict) else d
        fn(vs)
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def is_protected(rec):
    """Bản ghi được bảo vệ (spec T-215): dòng enrichment_log CUỐI CÙNG có source == "google_ai_mode" và changes có khoá style_tags
    thì changes.style_tags là danh sách có ít nhất một phần tử là object với `tag` thuộc đúng 10 tag chuẩn (chữ thường) và `evidence` là chuỗi không rỗng sau khi cắt khoảng trắng."""
    last = None
    for e in rec.get("enrichment_log") or []:
        if isinstance(e, dict) and e.get("source") == "google_ai_mode" and isinstance(e.get("changes"), dict) and "style_tags" in e["changes"]:
            last = e["changes"]["style_tags"]
    if not isinstance(last, list):
        return False
    return any(isinstance(x, dict) and x.get("tag") in ALLOWED and isinstance(x.get("evidence"), str) and x["evidence"].strip() for x in last)


def build(prepare=None, full_back=False):
    """Dựng Fx. prepare(fx) được gọi sau khi chép, TRƯỚC khi commit nền (mọi sửa dữ liệu thử nghiệm nằm trong lần commit nền)."""
    t, b = repos(need_back=True)
    fx = Fx()
    try:
        _copy_tree(t, fx.tohong, ref=os.environ.get("T215_REF") or None)
        for need in ("tools/regen-pool-styles.sh", "tools/scraper/output/HCMC/venue/vendors.json"):
            if not os.path.isfile(os.path.join(fx.tohong, need)):
                raise Fail(f"bản sao tohong thiếu {need}")
        os.makedirs(os.path.join(fx.back, "lib"))
        if full_back:
            _copy_tree(b, fx.back, ref="HEAD" if _is_git(b) else None)
            nm = os.path.join(b, "node_modules")
            if os.path.isdir(nm):
                os.symlink(nm, os.path.join(fx.back, "node_modules"))
        pool_src = _run(["git", "-C", b, "show", "HEAD:lib/vendorPool.generated.js"]) if _is_git(b) else None
        if pool_src is not None and pool_src.returncode == 0:
            open(fx.pool_file(), "w", encoding="utf-8").write(pool_src.stdout)
        else:
            shutil.copy2(os.path.join(b, "lib", "vendorPool.generated.js"), fx.pool_file())
        nd = os.path.join(fx.tmp, "nonet")
        os.makedirs(nd)
        open(os.path.join(nd, "sitecustomize.py"), "w").write(NONET)
        fx.env = dict(os.environ, PYTHONPATH=nd, PYTHONDONTWRITEBYTECODE="1", GOOGLE_MAPS_API_KEY="")
        if not any(is_protected(v) for _, v in fx.records()):
            raise Fail("dữ liệu tohong không có vendor nào có bằng chứng style_tags (google_ai_mode): chưa có tohong#108 (git pull origin main hoặc đặt T215_REF)")
        if prepare:
            prepare(fx)
        r = _run(["git", "init", "-q"], cwd=fx.tohong)
        _run(["git", "-C", fx.tohong, "add", "-A"])
        c = subprocess.run(GIT + ["-C", fx.tohong, "commit", "-qm", "base"], capture_output=True, text=True)
        if c.returncode != 0:
            raise Fail("git commit nền lỗi: " + c.stderr[-200:])
        return fx
    except Exception:
        fx.close()
        raise


def main_guard(fn):
    """Chạy fn() -> chuỗi PASS; in PASS/FAIL, thoát 0/1."""
    try:
        msg = fn()
    except Fail as e:
        print("FAIL " + str(e)); sys.exit(1)
    print("PASS " + msg); sys.exit(0)
