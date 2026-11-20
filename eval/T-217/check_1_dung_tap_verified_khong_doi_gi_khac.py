#!/usr/bin/env python3
"""T-217 tiêu chí 1: đúng tập S được đặt verification_status="verified"; không có gì khác đổi trong nguồn.
Đo trên cây làm việc của TOHONG_REPO (thứ Engineering đang sửa), so với nền = merge-base của HEAD với origin/main (hoặc main; T217_BASE_REF ghi đè).
Chạy: python3 -I <file>."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t217 as T


def run():
    root = T.tohong()
    S, vs = T.target_ids(root)
    if not S:
        raise T.Fail("S rỗng: nguồn không có vendor nào thoả định nghĩa (dữ liệu tohong#108 chưa có trong TOHONG_REPO?)")
    sset = set(S)
    bad = []
    for v in vs:
        st = v.get("verification_status")
        if v["id"] in sset and st != "verified":
            bad.append(f"{v['id']} thuộc S nhưng verification_status={st!r}")
        if v["id"] not in sset and v["id"] != T.BINH_QUOI_2 and st != "auto_scraped":
            bad.append(f"{v['id']} ngoài S nhưng verification_status={st!r} (phải giữ auto_scraped)")
        if v["id"] == T.BINH_QUOI_2 and st != "verified":
            bad.append("Bình Quới 2 phải giữ verified")
    if bad:
        raise T.Fail(f"{len(bad)} lệch, vd: {bad[0]}")
    # không đổi gì khác: so với nền
    base = T.base_dir_for_diff(root)
    if not base:
        raise T.Fail("không dựng được nền để so (cần git merge-base HEAD origin/main|main; hoặc đặt T217_BASE_REF)")
    cur_path = os.path.join(root, T.VENUE)
    old_raw = subprocess.run(["git", "-C", root, "show", f"{base}:{T.VENUE}"], capture_output=True, text=True)
    if old_raw.returncode != 0:
        raise T.Fail(f"không đọc được nền {base}:{T.VENUE}")
    old = json.loads(old_raw.stdout)
    cur = json.load(open(cur_path, encoding="utf-8"))
    ovs = {v["id"]: v for v in old["vendors"]}
    if [v["id"] for v in cur["vendors"]] != [v["id"] for v in old["vendors"]]:
        raise T.Fail("tập hoặc thứ tự id trong vendors.json khác nền")
    for k in set(cur) | set(old):
        if k != "vendors" and cur.get(k) != old.get(k):
            raise T.Fail(f"trường gốc của file '{k}' bị đổi so với nền")
    changed = []
    for v in cur["vendors"]:
        o = ovs[v["id"]]
        a = {k: x for k, x in v.items() if k != "verification_status"}
        b = {k: x for k, x in o.items() if k != "verification_status"}
        if a != b:
            diff = sorted(k for k in set(a) | set(b) if a.get(k) != b.get(k))
            raise T.Fail(f"{v['id']}: đổi trường ngoài verification_status: {diff[:4]}")
        if v.get("verification_status") != o.get("verification_status"):
            changed.append(v["id"])
    if not changed and base:
        # cây đã trùng nền (vd chạy sau merge): chấp nhận vì kiểm trạng thái ở trên đã đạt
        pass
    if changed and set(changed) - sset:
        raise T.Fail(f"đổi trạng thái vendor ngoài S: {sorted(set(changed) - sset)[:3]}")
    # không đổi byte ngoài đúng một dòng mỗi bản ghi; không file nào khác ngoài vendors.json và enrich-report.json
    ns = subprocess.run(["git", "-C", root, "diff", "--numstat", base, "--", T.VENUE], capture_output=True, text=True).stdout.split()
    if changed and (len(ns) < 2 or int(ns[0]) != len(changed) or int(ns[1]) != len(changed)):
        raise T.Fail(f"vendors.json đổi {ns[:2]} dòng (thêm/xoá), cần đúng {len(changed)}/{len(changed)} (một dòng verification_status mỗi bản ghi; không định dạng lại file)")
    files = subprocess.run(["git", "-C", root, "diff", "--name-only", base], capture_output=True, text=True).stdout.split()
    st = subprocess.run(["git", "-C", root, "status", "--porcelain"], capture_output=True, text=True).stdout.splitlines()
    files += [l[3:].strip() for l in st]
    ok = {T.VENUE, "tools/scraper/output/HCMC/enrich-report.json"}
    extra = sorted({f for f in files if f not in ok})
    if extra:
        raise T.Fail(f"file ngoài vendors.json / enrich-report.json bị đổi: {extra[:3]}")
    return f"{len(S)} vendor thuộc S đã verified, Bình Quới 2 giữ nguyên, {len(vs) - len(S) - 1} vendor khác giữ auto_scraped; không trường nào khác đổi"


T.R.main_guard(run)
