#!/usr/bin/env python3
# Nguồn: T-230 (spec products/T-230-ai-mode-not-found-khong-vao-pool.md v1, Định nghĩa 2 và 5, Hành vi 1-3), rút bởi spec-critic tại Spec Gate 2026-11-24.
# Nằm ở eval/T-230/bat-bien-cho-merge/ tới khi PR tohong + PR back của T-230 merge và bất biến xanh trên main (ADR-028); Chief đưa vào eval/invariants/planner/vendor/pool/ và đặt số.
"""Bất biến (planner/vendor/pool): vendor có ÍT NHẤT MỘT bản ghi nguồn (tools/scraper/output/<tp>/<hạng mục>/vendors.json) mang khoá cấp vendor
ai_mode_result == "not_found" (đúng chuỗi) thì vắng khỏi pool sau bước 6 (tools/regen-pool-styles.sh), và bước 6 không xoá hay sửa bản ghi nguồn đó.
Hai phần:
 (A) Dựng bản sao tạm (eval/lib/regen_fixture.py, chặn mạng, không chạm repo thật): đặt cờ cho một vendor một bản ghi đang trong pool, cho bản ghi
     ĐẦU của một vendor nhiều bản ghi (bản ghi còn lại "found"), và đặt "found" cho một vendor đối chứng; chạy bước 6. Hai vendor mang cờ phải vắng pool,
     đối chứng phải còn, cây tohong sạch, mọi bản ghi mang cờ còn nguyên số lượng và giá trị cờ.
 (B) Dữ liệu thật: mọi id có bản ghi mang cờ trong TOHONG_REPO không có trong lib/vendorPool.generated.js của TOHONG_BACK_REPO.
     Lưu ý vận hành (như pool INV-022): PR dữ liệu tohong merge trước PR pool back thì (B) đỏ giữa hai lần merge; đó là tình trạng thật, merge PR pool ngay sau.
Không gắn cách cài (không nhắc build_pool.py hay --prune). Thiếu repo: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. Thoát 0 = đạt."""
import collections, glob, json, os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R  # noqa: E402

FLAG = "not_found"


def _vendors(d):
    return d["vendors"] if isinstance(d, dict) else d


def _set(fx, vid, value, only_first=False):
    n = 0
    for f in fx.source_files():
        d = json.load(open(f, encoding="utf-8"))
        hit = False
        for v in _vendors(d):
            if v.get("id") == vid and not (only_first and n):
                v["ai_mode_result"] = value
                n += 1
                hit = True
        if hit:
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    if not n:
        raise R.Fail(f"không thấy bản ghi nguồn của {vid}")


def part_a():
    st = {}

    def prep(fx):
        pool = fx.pool()
        c = collections.Counter(v["id"] for _, v in fx.records())
        single = sorted(i for i in pool if c.get(i) == 1)
        multi = sorted(i for i in pool if c.get(i, 0) >= 2)
        if len(single) < 2 or not multi:
            raise R.Fail(f"dữ liệu không đủ vendor để thử (single={len(single)}, multi={len(multi)})")
        s, ctl, m = single[0], single[1], multi[0]
        st.update(s=s, ctl=ctl, m=m, n_s=c[s], n_m=c[m])
        _set(fx, s, FLAG)
        _set(fx, m, "found")
        _set(fx, m, FLAG, only_first=True)
        _set(fx, ctl, "found")
    fx = R.build(prepare=prep)
    try:
        fx.regen()
        pool = fx.pool()
        bad = [k for k in ("s", "m") if st[k] in pool]
        if bad:
            raise R.Fail("vendor mang ai_mode_result=not_found vẫn trong pool: " + ", ".join(st[k] for k in bad))
        if st["ctl"] not in pool:
            raise R.Fail(f"đối chứng {st['ctl']} (found) mất khỏi pool")
        dirty = fx.git_status()
        if dirty:
            raise R.Fail("bước 6 làm bẩn cây tohong: " + "; ".join(dirty[:3]))
        for k in ("s", "m"):
            recs = [v for _, v in fx.records() if v["id"] == st[k]]
            flagged = sum(1 for v in recs if v.get("ai_mode_result") == FLAG)
            if len(recs) != st["n_" + k] or flagged != 1:
                raise R.Fail(f"bản ghi nguồn của {st[k]} bị xoá hoặc đổi cờ ({len(recs)}/{st['n_' + k]} bản ghi, {flagged} mang cờ)")
        return f"bản sao: {st['s']} và {st['m']} (nhiều bản ghi) vắng pool, đối chứng còn, nguồn nguyên"
    finally:
        fx.close()


def part_b():
    tohong = R.find("TOHONG_REPO", "tools/regen-pool-styles.sh", "tohong")
    back = R.find("TOHONG_BACK_REPO", "lib/vendorPool.generated.js", "tohong-back")
    if not tohong or not back:
        raise R.Fail("không thấy repo tohong/tohong-back (đặt TOHONG_REPO, TOHONG_BACK_REPO)")
    flagged = set()
    for f in glob.glob(os.path.join(tohong, "tools", "scraper", "output", "*", "*", "vendors.json")):
        for v in _vendors(json.load(open(f, encoding="utf-8"))):
            if v.get("ai_mode_result") == FLAG:
                flagged.add(v.get("id"))
    s = open(os.path.join(back, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
    ids = {v["id"] for v in json.loads(s[s.index("= [") + 2: s.rindex("]") + 1])}
    left = sorted(flagged & ids)
    if left:
        raise R.Fail(f"{len(left)} vendor mang ai_mode_result=not_found trong nguồn vẫn ở pool app, vd {left[:3]}")
    return f"dữ liệu thật: {len(flagged)} id mang cờ, 0 trong pool"


def main():
    return part_a() + "; " + part_b()


try:
    msg = main()
except R.Fail as e:
    if str(e).startswith("không thấy repo"):
        print("PASS chưa áp dụng (" + str(e) + ")"); sys.exit(0)
    print("FAIL " + str(e)); sys.exit(1)
print("PASS " + msg); sys.exit(0)
