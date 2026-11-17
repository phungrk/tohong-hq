#!/usr/bin/env python3
"""T-200 · eval đối kháng tầng 3 (adversary, 2026-11-17, vòng v2).
adv-01 kiểm E/F bằng regex trên văn bản apply.cjs. Eval này chạy THẬT apply.cjs --write trên bản sao trong thư mục tạm,
với Playwright và fetch bị thay bằng mock (không mạng, không gọi endpoint admin nào), rồi kiểm hành vi.
Đồng thời kiểm allowlist.json theo hai lỗ tìm được khi kiểm mẫu lại.

  H. Allowlist không có hàng mà địa chỉ Maps bắt đầu bằng plus code (sau khi bỏ ký tự icon riêng U+E000-U+F8FF và khoảng trắng).
     decide2.py định chặn plus code nhưng regex neo ^ không bao giờ khớp vì gaddr bắt đầu bằng icon '\\ue0c8\\n'.
  I. Allowlist không chứa các hàng adversary đã mở lại Maps và kết luận sai/khả năng cao sai (danh sách dưới).
  J. Chạy --write bình thường: chỉ PUT id trong allowlist, mỗi id một lần, body = manual/accept_place/place_id của allowlist,
     có GET hàng đó ngay trước PUT.
  K. Note gửi lên production không chứa ký tự icon riêng (U+E000-U+F8FF) hay xuống dòng.
  L. applied.jsonl có dòng 403 cho một id thì id đó được PUT lại; dòng 200 đã đọc lại khớp thì không PUT lại.
  M. Hàng mà GET lúc ghi cho thấy đã có review / place_id khác: không PUT.
  N. PUT lỗi xen kẽ (500, 200, 500, ...): dừng sau đúng 5 lỗi tổng, exit 4, không PUT thêm sau lỗi thứ 5.
  O. Allowlist có place_id trùng: --write thoát 1 trước khi mở trình duyệt (0 lời gọi mạng).
  P. PUT trả 200 nhưng đọc lại không thấy review (hoặc place khác): lần chạy sau không được coi hàng đó là đã xong
     (phải đọc lại; nếu vẫn chưa có review thì ghi lại). Hiện apply.cjs ghi status 200 nên done-set bỏ qua vĩnh viễn.
Chạy: T200_ENRICH_DIR=<thư mục enrich> python3 -I adv-02-apply-hanh-vi-va-allowlist.py. Thoát 0 = đạt, 1 = vi phạm, 2 = thiếu dữ liệu/node."""
import json, os, re, shutil, subprocess, sys, tempfile

S = os.environ.get("T200_ENRICH_DIR",
    "/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/enrich")
need = ["rows.json", "decisions.json", "allowlist.json", "apply.cjs"]
if not all(os.path.isfile(os.path.join(S, f)) for f in need) or not shutil.which("node"):
    print("ERROR thiếu dữ liệu enrich hoặc node ở", S); sys.exit(2)

rows = {r["id"]: r for r in json.load(open(os.path.join(S, "rows.json"), encoding="utf-8"))}
dec = {d["id"]: d for d in json.load(open(os.path.join(S, "decisions.json"), encoding="utf-8"))}
allow = json.load(open(os.path.join(S, "allowlist.json"), encoding="utf-8"))["items"]
fails = {}

PUA = re.compile(r"[-]")
def clean(a): return PUA.sub("", a or "").strip()
fails["H"] = [f"{a['id']} {clean(dec[a['id']]['gaddr'])[:40]}" for a in allow
              if re.match(r"^[23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3}\b", clean(dec[a["id"]]["gaddr"]))]

# Mở lại Maps 2026-11-17 (adversary, chỉ đọc). Lý do ở accept/evalplus note của T-200.
WRONG = {
  "marry_9c10495f48eb": "Nhị Gia (tuần trăng mật) -> công ty loại 'Dịch vụ pháp lý'",
  "marry_9663a6fbfeb6": "HappyHouse Studio (chụp ảnh) -> 'Căn hộ nghỉ dưỡng cho thuê'",
  "marry_790a53213378": "Ô tô Đông Dương (thuê xe cưới) -> 'Đại lý ô tô' ở Tam Bình",
  "marry_a723b6948641": "Unique (venue 91B2 Phạm Văn Hai, nay là Queen Plaza) -> dịch vụ cưới ở Đặng Văn Bi: venue đổi sang cơ sở khác",
  "marry_b83d05c24fbb": "Tâm Nguyễn MakeUp Tân Phú -> 'Cơ sở trang điểm vĩnh viễn' Xuân Thới Sơn, tên người phổ biến",
  "marry_cf181dccb200": "Tiệm Bánh Family Củ Chi -> tiệm bánh cùng tên chung ở Q10",
  "marry_a611e7b4483b": "Nệm Sài Gòn (tên chung) Tân Phú -> 'nệm hoàng kim' Xuân Thới Sơn",
  "marry_71c4a7c489b9": "Áo Dài Phụ Dâu (tên mô tả dịch vụ) Q5 -> LAMIE Tân Phú",
}
ids = {a["id"] for a in allow}
fails["I"] = [f"{i}: {why}" for i, why in WRONG.items() if i in ids]

# ---------------- chạy apply.cjs thật với mock ----------------
PRELOAD = r"""
const Module=require('module');const fs=require('fs');
const LOG=process.env.MOCK_LOG, SC=JSON.parse(process.env.MOCK_SC||'{}');
const rows=Object.fromEntries(JSON.parse(fs.readFileSync(process.env.MOCK_DIR+'/rows.json')).map(r=>[r.id,r]));
const ev=e=>fs.appendFileSync(LOG,JSON.stringify(e)+'\n');
const _st=global.setTimeout;global.setTimeout=(f,ms,...a)=>_st(f,0,...a);
let nput=0;const state={};
for(const i of (SC.review_on||[]))state[i]={review:{action:'manual',by_capu:true}};
for(const i of (SC.pid_changed||[]))state[i]={google:{place_id:'ChIJ_OTHER'}};
global.localStorage={getItem:()=> 'tok'};
global.fetch=async(u,o)=>{const m=o.method;const url=new URL(u);
  if(m==='GET'){const q=url.searchParams.get('q');
    const rs=Object.values(rows).filter(r=>r.name===q).map(r=>Object.assign({id:r.id,group:r.group,review:r.review||null,override:r.override||null,google:r.google},state[r.id]||{}));
    ev({m,ids:rs.map(r=>r.id),q});return {status:200,json:async()=>({rows:rs})};}
  const id=decodeURIComponent(url.pathname.split('/')[4]);const body=JSON.parse(o.body);nput++;
  let st=200;if(SC.alt_fail&&nput%2===1)st=500;
  ev({m,id,body,st});
  if(st===200&&!(SC.put_no_effect||[]).includes(id))state[id]=Object.assign(state[id]||{},{review:{action:body.action,place_id:body.place_id,by_capu:false}});
  return {status:st,json:async()=>(st===200?{ok:true}:{error:'boom'})};};
const page={goto:async()=>{ev({m:'GOTO'})},waitForTimeout:async()=>{},evaluate:async(fn,arg)=>fn(arg)};
const mock={chromium:{launch:async()=>{ev({m:'LAUNCH'});return {newPage:async()=>page,close:async()=>{}}}}};
const _l=Module._load;Module._load=function(r,...a){if(/playwright/.test(r))return mock;return _l.call(this,r,...a)};
"""

def run(sc=None, applied=None, allow_items=None, rounds=1):
    d = tempfile.mkdtemp(prefix="t200adv02-")
    for f in ("rows.json", "decisions.json", "apply.cjs"): shutil.copy(os.path.join(S, f), d)
    json.dump({"items": allow_items if allow_items is not None else allow}, open(os.path.join(d, "allowlist.json"), "w"), ensure_ascii=False)
    open(os.path.join(d, "applied.jsonl"), "w").write("".join(json.dumps(x) + "\n" for x in (applied or [])))
    open(os.path.join(d, "preload.cjs"), "w").write(PRELOAD)
    logs, codes = [], []
    for k in range(rounds):
        log = os.path.join(d, f"mock{k}.jsonl"); open(log, "w").close()
        env = dict(os.environ, MOCK_LOG=log, MOCK_SC=json.dumps(sc or {}), MOCK_DIR=d)
        p = subprocess.run(["node", "-r", os.path.join(d, "preload.cjs"), os.path.join(d, "apply.cjs"), "--write"],
                           cwd=d, env=env, capture_output=True, text=True, timeout=300)
        codes.append(p.returncode)
        logs.append([json.loads(l) for l in open(log) if l.strip()])
    shutil.rmtree(d, ignore_errors=True)
    return codes, logs

ap = {a["id"]: a["place_id"] for a in allow}
# J, K: chạy bình thường
codes, logs = run()
ev = logs[0]
puts = [e for e in ev if e["m"] == "PUT"]
j = []
if codes[0] != 0: j.append(f"exit {codes[0]}")
if sorted(e["id"] for e in puts) != sorted(ap): j.append(f"PUT {len(puts)} hàng, allowlist {len(ap)}")
for k, e in enumerate(ev):
    if e["m"] != "PUT": continue
    b = e["body"]
    if e["id"] not in ap or b.get("decision") != "manual" or b.get("action") != "accept_place" or b.get("place_id") != ap.get(e["id"]):
        j.append(f"{e['id']} body sai {b.get('decision')}/{b.get('action')}")
    if not (k and ev[k-1]["m"] == "GET" and e["id"] in ev[k-1]["ids"]): j.append(f"{e['id']} không GET ngay trước PUT")
fails["J"] = j
fails["K"] = [f"{e['id']} note={e['body'].get('note','')[:45]!r}" for e in puts if PUA.search(e["body"].get("note", "")) or "\n" in e["body"].get("note", "")]

# L: dòng 403 phải được ghi lại, dòng 200 thì không
a3 = [a["id"] for a in allow[:3]]; a200 = allow[3]["id"]
codes, logs = run(applied=[{"id": i, "status": 403} for i in a3] + [{"id": a200, "status": 200, "after": "Chờ Capu (accept_place)"}])
pl = [e["id"] for e in logs[0] if e["m"] == "PUT"]
fails["L"] = [f"{i} (403) không được PUT lại" for i in a3 if i not in pl] + ([f"{a200} (200) bị PUT lại"] if a200 in pl else [])

# M: hàng đã có review / place khác lúc ghi
rv, pc = allow[5]["id"], allow[6]["id"]
codes, logs = run(sc={"review_on": [rv], "pid_changed": [pc]})
pl = [e["id"] for e in logs[0] if e["m"] == "PUT"]
fails["M"] = [f"{i} vẫn bị PUT" for i in (rv, pc) if i in pl]

# N: lỗi xen kẽ
codes, logs = run(sc={"alt_fail": True})
st = [e["st"] for e in logs[0] if e["m"] == "PUT"]
nerr = sum(1 for s in st if s != 200)
fails["N"] = [] if (codes[0] == 4 and nerr == 5 and st and st[-1] != 200) else [f"exit {codes[0]}, PUT {len(st)}, lỗi {nerr}"]

# O: place_id trùng trong allowlist
dup = allow + [{"id": allow[1]["id"], "place_id": allow[0]["place_id"]}]  # hàng thứ hai mang place của hàng đầu
codes, logs = run(allow_items=dup)
fails["O"] = [] if (codes[0] == 1 and not any(e["m"] in ("LAUNCH", "GET", "PUT") for e in logs[0])) else [f"exit {codes[0]}, gọi mạng {sum(1 for e in logs[0] if e['m'] in ('GET','PUT'))}"]

# P: PUT 200 nhưng không có hiệu lực -> lần chạy sau phải xử lý lại
ne = allow[8]["id"]
codes, logs = run(sc={"put_no_effect": [ne]}, allow_items=allow[:10], rounds=2)
second = [e for e in logs[1] if e.get("id") == ne or ne in e.get("ids", [])]
fails["P"] = [] if second else [f"{ne}: PUT 200 nhưng đọc lại không thấy review; lần chạy 2 bỏ qua hẳn (done-set coi là xong)"]

bad = 0
for k in "HIJKLMNOP":
    v = fails.get(k, [])
    print(("FAIL" if v else "PASS"), k, len(v))
    for x in v[:12]: print("   ", x)
    bad += bool(v)
sys.exit(1 if bad else 0)
