#!/usr/bin/env python3
"""T-074 tiêu chí 2: mỗi nhãn ghi người chấm; người chấm là người ngoài (3-5), khai không thấy điểm hệ thống và không sửa trọng số;
file nhãn không chứa dữ liệu cá nhân. Cách kiểm: validator phải nhận file nhãn mẫu và từ chối từng biến thể hỏng."""
import copy, json, os, subprocess, sys, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GOOD = os.path.join(ROOT, "eval/T-074/labels.sample.json")
def run(path):
    r = subprocess.run(["node", "eval/T-074/match_eval.mjs", "--validate", path], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr
def fail(m): print("FAIL " + m); sys.exit(1)
base = json.load(open(GOOD, encoding="utf-8"))
code, out = run(GOOD)
if code != 0: fail("file nhãn mẫu hợp lệ mà validator từ chối: " + out[-300:])
def v_no_grader(d): d["labels"][0]["grader"] = "ai-do"
def v_two(d): d["graders"] = d["graders"][:2]
def v_six(d): d["graders"] = d["graders"] + [dict(copy.deepcopy(d["graders"][0]), id=f"X{i}") for i in range(3)]
def v_internal(d): d["graders"][0]["relationship"] = "capu"
def v_saw(d): d["graders"][0]["declaration"]["saw_system_scores"] = True
def v_weights(d): d["graders"][1]["declaration"]["touched_matching_weights"] = None
def v_pii(d): d["graders"][0]["email"] = "a@b.c"
def v_dup(d): d["labels"].append(dict(d["labels"][0]))
def v_prof(d): d["profiles_sha"] = "0" * 16
def v_cat(d): d["labels"][0]["category"] = "decor"
def v_nofit(d): d["labels"][0]["fit"] = "có"
cases = [("nhãn ghi người chấm lạ", v_no_grader, "không có trong graders"), ("chỉ 2 người chấm", v_two, "cần 3-5"),
         ("6 người chấm", v_six, "cần 3-5"), ("người chấm nội bộ", v_internal, "external"),
         ("người chấm khai đã thấy điểm", v_saw, "saw_system_scores"), ("thiếu khai báo trọng số", v_weights, "touched_matching_weights"),
         ("có email người chấm", v_pii, "trường lạ"), ("nhãn trùng", v_dup, "trùng nhãn"),
         ("hồ sơ đã đổi", v_prof, "profiles_sha"), ("hạng mục ngoài 4", v_cat, "ngoài 4 hạng mục"), ("fit không phải boolean", v_nofit, "fit phải là")]
tmp = tempfile.mkdtemp()
for name, f, needle in cases:
    d = copy.deepcopy(base); f(d)
    p = os.path.join(tmp, "x.json"); json.dump(d, open(p, "w", encoding="utf-8"))
    code, out = run(p)
    if code == 0: fail(f"validator nhận nhầm biến thể hỏng: {name}")
    if needle not in out: fail(f"biến thể '{name}' bị từ chối nhưng không nêu lý do chứa '{needle}': {out[-200:]}")
real = os.path.join(ROOT, "eval/T-074/labels.json")
if os.path.exists(real):
    code, out = run(real)
    if code != 0: fail("labels.json thật không hợp lệ: " + out[-300:])
print(f"PASS validator nhận nhãn mẫu và từ chối {len(cases)} biến thể hỏng" + (" ; labels.json thật hợp lệ" if os.path.exists(real) else ""))
