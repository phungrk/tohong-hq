#!/usr/bin/env python3
"""T-101 tiêu chí 9 (mục 8 spec): một mã phiên có nhiều transcript (ca thật: -home-user 2177 tin + -home-user-tohong-hq 28 tin).
Quy tắc: chọn file chứa con trỏ main hiện có; chưa có con trỏ thì file nhiều tin nhất; các file kia phải là tập con theo message.id
(bỏ qua, không đếm); nếu có tin không thuộc file chọn → thoát 2, không ghi gì. Một phần lỗi (con trỏ subagent hỏng) → ghi phần còn lại, thoát 2."""
import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
fails = []
ok = lambda mids: [(m, "end_turn") for m in mids]

def build(b, sid, big_dir, small_dir, small_extra=()):
    mids = [f"{sid}-m{i}" for i in range(6)]
    big = b.write_stops(b.proj.parent / big_dir / f"{sid}.jsonl", "Việc T-101", ok(mids))
    for aid, n in (("sa1", 2), ("sa2", 3)):
        b.write_stops(b.proj.parent / big_dir / sid / "subagents" / f"agent-{aid}.jsonl", "Giao việc T-101: x",
                      ok([f"{sid}-{aid}-m{i}" for i in range(n)]), attr="engineering")
    small = b.write_stops(b.proj.parent / small_dir / f"{sid}.jsonl", "Việc T-101", ok(mids[:2] + list(small_extra)))
    b.age(big); return big, small      # file nhỏ luôn MỚI hơn file lớn

# 1. file nhỏ đứng trước theo tên (-home-user-tohong-hq) và mới hơn; chưa có con trỏ → phải chọn file nhiều tin nhất
for big_dir, small_dir in (("-home-user", "-home-user-tohong-hq"), ("-zzz-lon", "-home-user")):
    b = lib.Box(); sid = "sess-9"; build(b, sid, big_dir, small_dir)
    r = b.run(["backfill", sid]); ev = b.events()
    ag = sorted(e["src"]["agent"] for e in ev)
    if r.returncode != 0 or ag != ["main", "sa1", "sa2"]: fails.append(f"[{small_dir}] thoát {r.returncode}, agent={ag}; cần 0 và main/sa1/sa2 mỗi cái một lần")
    if abs(sum(e["cost"] for e in ev) - lib.usd(6 + 2 + 3)) > 1e-3: fails.append(f"[{small_dir}] tổng ${sum(e['cost'] for e in ev):.4f}, cần ${lib.usd(11):.4f} (không đếm trùng 2 tin của file nhỏ)")
    b.run(["backfill", sid])
    if len(b.events()) != len(ev): fails.append(f"[{small_dir}] lần hai vẫn ghi thêm")

# 2. đã có con trỏ main (ghi một phần từ file lớn lúc còn 3 tin) rồi file lớn dài thêm → chỉ ghi phần tăng, vẫn không đụng file nhỏ
b = lib.Box(); sid = "sess-9c"
big = b.write_stops(b.proj / f"{sid}.jsonl", "Việc T-101", ok([f"{sid}-m{i}" for i in range(3)]))
b.run(["backfill", sid])
b.append(big, [f"{sid}-m{i}" for i in range(3, 6)])
b.write_stops(b.proj.parent / "-home-user-tohong-hq" / f"{sid}.jsonl", "Việc T-101", ok([f"{sid}-m0", f"{sid}-m1"]))
r = b.run(["backfill", sid]); m = [e["src"]["msgs"] for e in b.events() if e["src"]["agent"] == "main"]
if r.returncode != 0 or m != [3, 6]: fails.append(f"con trỏ có sẵn: thoát {r.returncode}, main msgs={m}; cần [3, 6]")

# 3. hai nhánh khác nhau (file nhỏ có tin không thuộc file lớn) → thoát 2, không ghi byte nào, dry-run cũng thoát 2
b = lib.Box(); sid = "sess-9d"; build(b, sid, "-home-user", "-home-user-tohong-hq", small_extra=("tin-nhanh-khac",))
snap = b.ledger_bytes(); r = b.run(["backfill", sid]); r2 = b.run(["backfill", sid, "--dry-run"])
if "invalid choice" in r.stderr: fails.append("lệnh backfill chưa tồn tại")
if r.returncode != 2 or b.ledger_bytes() != snap: fails.append(f"hai nhánh khác nhau: thoát {r.returncode}, hoặc đã ghi sổ cái; cần thoát 2 và không ghi")
if r2.returncode != 2 or "PENDING" in r2.stdout: fails.append(f"hai nhánh khác nhau, dry-run: thoát {r2.returncode}; cần 2, không in PENDING")

# 4. lỗi một phần: con trỏ của sa2 trỏ tin không còn → ghi main và sa1, bỏ sa2, thoát 2
b = lib.Box(); sid = "sess-9e"; build(b, sid, "-home-user", "-home-user-tohong-hq")
with open(b.root / "ledger" / "events.jsonl", "a", encoding="utf-8") as f:
    f.write(json.dumps({"id": "E-9999", "event": "cost", "cost": 0.0, "src": {"session": sid, "agent": "sa2", "msgs": 1, "last": "tin-ma"}}) + "\n")
before = len(b.events()); r = b.run(["backfill", sid]); new = sorted(e["src"]["agent"] for e in b.events()[before:])
if r.returncode != 2 or new != ["main", "sa1"]: fails.append(f"lỗi một phần: thoát {r.returncode}, ghi {new}; cần thoát 2 và ghi main, sa1")
lib.finish(fails)
