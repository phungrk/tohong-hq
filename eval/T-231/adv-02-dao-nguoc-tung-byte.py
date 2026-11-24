"""T-231 đối kháng 02 (adversary). Spec T-230 Hành vi 2 và 7: đặt cờ rồi đảo ngược.
Ba lần bước 6 trên cùng bản sao: p0 (không cờ), p1 (cờ "not_found" cho một vendor đơn và một vendor nhiều bản ghi), p2 (đảo ngược: bản đơn "found",
vendor nhiều bản ghi xoá khoá). Mong đợi: mọi vendor khác giống p0 từng byte (JSON giữ thứ tự khoá) và cùng thứ tự ở cả p1 và p2;
hai vendor vắng p1 và quay lại p2 với cùng id, tên, hạng mục; cây nguồn sau p2 chỉ khác gốc ở khoá ai_mode_result (giá trị "found")."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.join(_o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))), "T-230"))
import json
from lib230 import build, picks, set_field, Fail, run, MISSING


def raw_pool(fx):
    s = open(fx.pool_file(), encoding="utf-8").read()
    return json.loads(s[s.index("= [") + 2: s.rindex("]") + 1])


def main():
    fx = build(None, full_back=True)
    try:
        (s, _, _), m = picks(fx)
        fx.regen(); p0 = raw_pool(fx)
        set_field(fx, s, "not_found"); set_field(fx, m, "not_found", only_first=True)
        fx.regen(); p1 = raw_pool(fx)
        set_field(fx, s, "found"); set_field(fx, m, MISSING)
        fx.regen(); p2 = raw_pool(fx)
        fails = []
        others = lambda p: [json.dumps(v, ensure_ascii=False) for v in p if v["id"] not in (s, m)]
        if others(p1) != others(p0):
            fails.append("p1: vendor khác đổi so với p0")
        if others(p2) != others(p0):
            fails.append("p2: vendor khác đổi so với p0")
        ids1 = {v["id"] for v in p1}
        if s in ids1 or m in ids1:
            fails.append("p1: vendor cờ vẫn trong pool")
        by0, by2 = {v["id"]: v for v in p0}, {v["id"]: v for v in p2}
        for vid in (s, m):
            if vid not in by2:
                fails.append(f"p2: {vid} không quay lại"); continue
            for k in ("name", "category", "categories"):
                if by0[vid].get(k) != by2[vid].get(k):
                    fails.append(f"p2: {vid}.{k} khác p0")
        st = [l for l in fx.git_status() if l.strip()]
        if any(not l.rstrip().endswith("vendors.json") for l in st):
            fails.append(f"cây nguồn bẩn ngoài vendors.json: {st[:5]}")
        if fails:
            raise Fail("; ".join(fails))
        return f"đặt cờ/đảo ngược {s}, {m}: {len(p0) - 2} vendor khác giống p0 từng byte ở p1 và p2; hai vendor quay lại cùng id/tên/hạng mục"
    finally:
        fx.close()


run(main)
