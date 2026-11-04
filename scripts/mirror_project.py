#!/usr/bin/env python3
"""Đồng bộ sổ cái lên GitHub Project (v2) — mặt kính Kanban cho điện thoại của Capu (ADR-012).

Một chiều: board/T-xxx.md → trường của item trên Project. Kéo thẻ trên Project không có hiệu lực;
lần chạy sau kéo về đúng sổ cái. Chỉ việc có trường `issue` mới lên Project (item = issue đó).

Cần (do Capu đặt một lần, script không tạo thay):
  secrets.PROJECTS_TOKEN   personal access token có scope `project` (GITHUB_TOKEN không đọc được Project của user)
  vars.PROJECT_NUMBER      số Project (trên URL github.com/users/<owner>/projects/<số>)
  Trên Project phải có các trường:
    Status (single select) với option tên đúng các cột:
      Ý định · Spec · Spec Gate · Code · Code Gate · Chờ Capu · Bị chặn · Xong
    Bậc (single select A/B/C) · Vùng (text) · Vòng (text) · Cổng (single select GREEN/RED/—)   — tùy chọn, có thì điền

Projects v2 chỉ có GraphQL; vì vậy script này chỉ chạy trong GitHub Actions, không chạy từ phiên cloud.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import task as ledger  # noqa: E402

ROOT = ledger.ROOT
OWNER = os.environ.get("GITHUB_REPOSITORY", "phungrk/tohong-hq").split("/")[0]
REPO = os.environ.get("GITHUB_REPOSITORY", "phungrk/tohong-hq").split("/")[1]
TOKEN = os.environ.get("PROJECTS_TOKEN", "")
NUMBER = int(os.environ.get("PROJECT_NUMBER") or 0)

COLUMN = {"new": "Ý định", "doing": "Code", "rework": "Code", "spec": "Spec", "review": None,
          "blocked": "Bị chặn", "escalated": "Chờ Capu", "done": "Xong"}


def gql(query, variables):
    req = urllib.request.Request("https://api.github.com/graphql", method="POST",
                                 data=json.dumps({"query": query, "variables": variables}).encode(),
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
                                          "User-Agent": "tohong-hq-mirror"})
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.loads(r.read().decode())
    if out.get("errors"):
        raise SystemExit(f"GraphQL: {out['errors'][0].get('message')}")
    return out["data"]


def column_of(meta):
    st = meta["state"]
    if st == "review":
        return "Spec Gate" if meta.get("reviewer") == "spec-critic" else "Code Gate"
    if st in ("doing", "rework") and meta.get("owner") == "product":
        return "Spec"
    if st == "done" and meta.get("tier") == "C":
        return "Chờ Capu"
    if st == "done" and meta.get("tier") == "B":
        try:
            if ledger.now() - ledger.parse_stamp(meta["updated"]) < timedelta(hours=48):   # giờ sổ cái, không phải giờ runner
                return "Chờ Capu"
        except Exception:
            pass
    return COLUMN.get(st, "Ý định")


def gate_of(tid):
    p = ROOT / "eval" / tid / "gate-latest.json"
    if not p.exists():
        return "—"
    try:
        return json.loads(p.read_text(encoding="utf-8")).get("verdict", "—")
    except Exception:
        return "—"


def main():
    if not TOKEN or not NUMBER:
        print("Bỏ qua: thiếu PROJECTS_TOKEN hoặc PROJECT_NUMBER.")
        return
    d = gql("""query($o:String!,$n:Int!){ user(login:$o){ projectV2(number:$n){ id
        fields(first:30){ nodes{ ... on ProjectV2FieldCommon{ id name dataType }
          ... on ProjectV2SingleSelectField{ id name dataType options{ id name } } } } } } }""",
            {"o": OWNER, "n": NUMBER})
    proj = d["user"]["projectV2"]
    fields = {f["name"]: f for f in proj["fields"]["nodes"] if f}
    if "Status" not in fields:
        raise SystemExit("Project thiếu trường Status.")

    def set_field(item_id, name, value):
        f = fields.get(name)
        if not f:
            return
        if f["dataType"] == "SINGLE_SELECT":
            opt = next((o["id"] for o in f.get("options", []) if o["name"] == value), None)
            if not opt:
                print(f"  Project thiếu option '{value}' ở trường {name}; bỏ qua.")
                return
            val = {"singleSelectOptionId": opt}
        else:
            val = {"text": str(value)}
        gql("""mutation($p:ID!,$i:ID!,$f:ID!,$v:ProjectV2FieldValue!){
              updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:$v}){ clientMutationId } }""",
            {"p": proj["id"], "i": item_id, "f": f["id"], "v": val})

    n = 0
    for p in sorted((ROOT / "board").glob("T-*.md")):
        try:
            meta, _ = ledger.read_task(p.stem)
        except ledger.LedgerError:
            continue
        raw = str(meta.get("issue") or "").strip()
        if not raw:
            continue
        if not re.fullmatch(r"[1-9]\d*", raw):
            print(f"CẢNH BÁO: {meta['id']} có issue không hợp lệ {raw!r}; bỏ qua.", file=sys.stderr)
            continue
        iss = gql("""query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issue(number:$n){ id } } }""",
                  {"o": OWNER, "r": REPO, "n": int(raw)})["repository"]["issue"]["id"]
        item = gql("""mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }""",
                   {"p": proj["id"], "c": iss})["addProjectV2ItemById"]["item"]["id"]
        set_field(item, "Status", column_of(meta))
        set_field(item, "Bậc", meta.get("tier") or "B")
        set_field(item, "Vùng", meta.get("area") or "—")
        set_field(item, "Vòng", f"vòng {meta['rounds']} · spec rework {meta['spec_returns']} · eval+ {meta['evals_added']}")
        set_field(item, "Cổng", gate_of(meta["id"]))
        n += 1
        print(f"{meta['id']} → {column_of(meta)}")
    print(f"Đã đồng bộ {n} việc lên Project #{NUMBER}.")


if __name__ == "__main__":
    main()
