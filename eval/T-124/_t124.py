"""T-124: hàm chuẩn (tham chiếu) của eval, KHÔNG phải code sản phẩm. Phân nhóm enrich vendor, bốn ô đếm, điều kiện Approve.
Đọc dữ liệu thật của repo tohong (tools/scraper/output/HCMC/*) hoặc ảnh chụp eval/T-124/snapshot.json. Không gọi Google, không mạng."""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
# Thứ tự category "nhà" của vendor (giống INV-026). other, wedding_planner không thuộc app (không có trong pool).
ORDER = ["venue", "photography", "wedding_attire", "makeup", "flower", "wedding_interior", "ceremony", "invitation",
         "wedding_gift", "wedding_ring", "wedding_car", "honeymoon", "wedding_planner", "other"]
NOT_APP = {"other", "wedding_planner"}
TO_APP = {"photography": "photography", "venue": "venue", "makeup": "makeup", "ceremony": "ceremony", "wedding_ring": "jewelry",
          "wedding_car": "transport", "wedding_attire": "attire", "flower": "decor", "wedding_interior": "decor",
          "invitation": "stationery", "wedding_gift": "stationery", "honeymoon": "honeymoon"}
GROUPS = ["full", "matched_no_photo", "addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar", "not_found",
          "temp_closed", "not_enriched"]
APPROVABLE = {"addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar"}
HI, MID = 0.95, 0.6   # tên giống >= 0,95 | >= 0,6 (và < 0,95) | còn lại


def tohong_root():
    for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")):
        if c and os.path.isdir(os.path.join(c, "tools", "scraper", "output", "HCMC")):
            return os.path.abspath(c)
    return None


def _last_google(rec):
    g = [e for e in (rec.get("enrichment_log") or []) if e.get("source") == "google_maps" and e.get("place_id")]
    return g[-1] if g else None


def facts_from_repo(root):
    base = os.path.join(root, "tools", "scraper", "output", "HCMC")
    recs, audit = {}, {}
    for c in ORDER:
        f = os.path.join(base, c, "vendors.json")
        if not os.path.exists(f):
            continue
        d = json.load(open(f, encoding="utf-8"))
        for x in (d["vendors"] if isinstance(d, dict) else d):
            recs.setdefault(x["id"], {})[c] = x
        a = os.path.join(base, c, "enrichment-audit.json")
        if os.path.exists(a):
            for r in json.load(open(a, encoding="utf-8")):
                audit.setdefault(r["vendor_id"], {}).setdefault(c, r)
    out = []
    for vid, byc in recs.items():
        cats = [c for c in ORDER if c in byc]
        if all(c in NOT_APP for c in cats):
            continue
        home = cats[0]
        rec = byc[home]
        g = _last_google(rec) or next((_last_google(byc[c]) for c in cats if _last_google(byc[c])), None)
        row = audit.get(vid, {}).get(home) or next((audit[vid][c] for c in cats if c in audit.get(vid, {})), None)
        contact = rec.get("contact") or {}
        out.append({
            "id": vid, "name": rec["name"], "category": TO_APP[home], "home": home,
            "marry_address": contact.get("address_source") or contact.get("address") or "",
            "photos": max(len(byc[c].get("google_photos") or []) for c in cats),
            "g": None if not g else {"place_id": g["place_id"], "name": g.get("matched_name"), "conf": g.get("confidence"),
                                     "has_flag": "address_match" in g, "address_match": g.get("address_match"),
                                     "address": g.get("formatted_address")},
            "audit": None if not row else {"status": row.get("status"), "conf": row.get("confidence"), "name": row.get("matched_name"),
                                           "candidate": row.get("candidate_place_id") or "", "reject_reason": row.get("reject_reason"),
                                           "closed_state": row.get("closed_state")},
        })
    out.sort(key=lambda f: (ORDER.index(f["home"]), f["name"].casefold(), f["id"]))
    return out


def classify(f):
    a, g = f["audit"], f["g"]
    if not g and a and (a.get("closed_state") == "temporarily_closed" or a.get("status") == "temporarily_closed"):
        return "temp_closed"
    if g:
        if not g["has_flag"]:
            return "unverified"
        if g["address_match"] is True:
            return "full" if f["photos"] >= 1 else "matched_no_photo"
        return "addr_diff_accepted"
    if a:
        c = a.get("conf") or 0.0
        if a.get("status") == "low_confidence":
            return "name_same_addr_diff" if c >= HI else "name_similar" if c >= MID else "not_found"
        return "not_found"
    return "not_enriched"


def candidate_place_id(f):
    if f["g"]:
        return f["g"]["place_id"]
    return (f["audit"] or {}).get("candidate") or ""


def approvable(f):
    return classify(f) in APPROVABLE and bool(candidate_place_id(f))


def summarize(facts):
    groups = {k: 0 for k in GROUPS}
    for f in facts:
        groups[classify(f)] += 1
    chips = {"full": groups["full"], "no_google_photo": sum(1 for f in facts if f["photos"] == 0),
             "name_similar": groups["name_similar"], "addr_diff": groups["addr_diff_accepted"] + groups["name_same_addr_diff"]}
    return {"total": len(facts), "groups": groups, "chips": chips, "approvable": sum(1 for f in facts if approvable(f))}


def load_snapshot():
    return json.load(open(os.path.join(HERE, "snapshot.json"), encoding="utf-8"))


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else tohong_root()
    facts = facts_from_repo(root)
    if len(sys.argv) > 2 and sys.argv[2] == "--write-snapshot":
        json.dump({"source": "tohong origin/main " + (sys.argv[3] if len(sys.argv) > 3 else "?"), "facts": facts},
                  open(os.path.join(HERE, "snapshot.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(summarize(facts), ensure_ascii=False))
