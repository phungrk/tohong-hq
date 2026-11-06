#!/usr/bin/env python3
"""Nguồn: T-085 adv-01 (adversary, Code Gate 2026-11-06). Sự cố: if: secrets.* trong mirror-issue.yml làm GitHub từ chối cả file, 100% lượt chạy đỏ 0 job từ 2026-11-04.
Bất biến (hq, mọi workflow): context hợp lệ trong mọi workflow (bảng context availability của GitHub).
Các lỗi check_1 không bắt:
  a) secrets trong if viết kiểu chỉ mục: secrets['X'] / secrets["X"] (check_1 chỉ bắt `secrets.`)
  b) step `if` đọc env.X mà X chỉ khai ở env của CHÍNH step đó (env cấp step chưa có lúc đánh giá if
     -> luôn rỗng, bước bị bỏ qua mãi mãi; actionlint cũng không bắt)
  c) env.* trong `if` cấp job (context env không có ở jobs.<id>.if)
  d) inputs.X không khai trong workflow_dispatch/workflow_call inputs
  e) job có secret ở env cấp job/workflow mà có step in toàn bộ env (printenv, env, set -x)
Chạy: python3 -I eval/invariants/hq/inv-002-workflow-context-hop-le.py [thư mục workflows]"""
import pathlib, re, sys, yaml

ROOT = pathlib.Path(__file__).resolve().parents[3]
WF = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".github/workflows"
SECRETS_RE = re.compile(r"\bsecrets\s*(\.|\[)")
ENV_RE = re.compile(r"\benv\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)|\[\s*['\"]([^'\"]+)['\"]\s*\])")
INPUTS_RE = re.compile(r"\binputs\s*\.\s*([A-Za-z_][A-Za-z0-9_-]*)")
DUMP_RE = re.compile(r"(^|[\s;&|])(printenv|env)\s*($|[;&|>])|set\s+-[a-z]*x", re.M)
bad = []


def all_strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from all_strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from all_strings(v)


def has_secret(envmap):
    return any(SECRETS_RE.search(str(v)) for v in (envmap or {}).values())


files = sorted(list(WF.glob("*.yml")) + list(WF.glob("*.yaml")))
if not files:
    print(f"ERROR không thấy workflow ở {WF}"); sys.exit(2)
for f in files:
    d = yaml.safe_load(f.read_text())
    on = d.get("on", d.get(True)) or {}
    declared = set()
    if isinstance(on, dict):
        for trig in ("workflow_dispatch", "workflow_call"):
            t = on.get(trig) or {}
            declared |= set((t.get("inputs") or {}).keys()) if isinstance(t, dict) else set()
    for s in all_strings(d):
        for name in INPUTS_RE.findall(s):
            if name not in declared:
                bad.append(f"{f.name}: inputs.{name} không khai trong inputs")
    wf_env = set((d.get("env") or {}).keys())
    wf_secret = has_secret(d.get("env"))
    for jid, job in (d.get("jobs") or {}).items():
        jif = str(job.get("if", ""))
        if SECRETS_RE.search(jif):
            bad.append(f"{f.name}:{jid}: if cấp job dùng secrets")
        if ENV_RE.search(jif):
            bad.append(f"{f.name}:{jid}: if cấp job dùng env (không có ở jobs.<id>.if)")
        job_env = wf_env | set((job.get("env") or {}).keys())
        secret_wide = wf_secret or has_secret(job.get("env"))
        for i, st in enumerate(job.get("steps") or []):
            sid = st.get("name") or st.get("id") or f"step{i}"
            sif = str(st.get("if", ""))
            if SECRETS_RE.search(sif):
                bad.append(f"{f.name}:{jid}/{sid}: if bước dùng secrets")
            for a, b in ENV_RE.findall(sif):
                name = a or b
                if name not in job_env:
                    where = "chỉ khai ở env của chính bước" if name in (st.get("env") or {}) else "không khai ở workflow/job"
                    bad.append(f"{f.name}:{jid}/{sid}: if đọc env.{name} nhưng {where} -> luôn rỗng")
            if secret_wide and DUMP_RE.search(str(st.get("run", ""))):
                bad.append(f"{f.name}:{jid}/{sid}: in toàn bộ env trong job có secret cấp job/workflow")
if bad:
    print("FAIL\n" + "\n".join(bad)); sys.exit(1)
print(f"PASS {len(files)} workflow: không secrets/env sai chỗ trong if, inputs đều khai, không in env khi có secret cấp job")
