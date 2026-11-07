#!/usr/bin/env python3
"""T-077 tiêu chí 1: KIỂM KHÓI chạy chồng -> 0 đỏ giả. Luồng A lặp C10 (check_10 của T-051) trên bản sao front (h.front_copy), luồng B chạy small_tile_tooltip
(bất biến vendor-images) trên front gốc tối đa ROUNDS lần (mặc định 6) và dừng khi hết DEADLINE giây (mặc định 80), dưới BURN tiến trình đốt CPU (mặc định 2, tải vừa, tự thoát sau 120s).
Eval này KHÔNG phân biệt chắc bản đúng/sai (đỏ giả hiện trạng chỉ ~5-15%/lần, có thể xanh trên hiện trạng); eval phân biệt chính là check_2. Giữ lại vì rẻ và bắt hồi quy rõ (vd cache riêng làm khởi động lạnh quá chậm).
Đỏ giả = một lần chạy của A hoặc B không in PASS trong khi cùng phép đo, chạy riêng một mình, PASS (bước 0 kiểm small_tile_tooltip trước). FAIL nếu có >=1 đỏ giả.
Chạy: python3 eval/T-077/check_1_chay_chong.py [--rounds N] [--burn W] [--deadline S] [--evalroot DIR] [--front DIR]. ~1-1.5 phút. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, shutil, threading, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import c, h
R = int(c.arg("--rounds", 6)); W = int(c.arg("--burn", 2)); DL = int(c.arg("--deadline", 80))
tmp = c.private_tmp(); bs = []; a_res = []; b_res = []; stop = threading.Event()
try:
    cp = c.front_copy(tmp)
    l0, _, _ = c.run_stt(c.FRONT, tmp)
    if not l0.startswith("PASS"): print("FAIL phép đo hỏng trước khi chạy chồng: small_tile_tooltip chạy một mình đã không PASS: " + l0[:100]); sys.exit(1)
    bs = c.burn(W)
    def A():
        while not stop.is_set(): a_res.append(c.run_c10(cp, tmp)[0])
    t = threading.Thread(target=A); t.start(); time.sleep(3)
    t_start = time.time()
    for i in range(R):
        if time.time() - t_start > DL: break
        b_res.append(c.run_stt(c.FRONT, tmp)[0]); time.sleep(2)
    stop.set(); t.join()
finally:
    stop.set()
    for b in bs: b.kill()
    time.sleep(1); h.kill_pids(h.marked()); h.rm_probe_files(c.FRONT); shutil.rmtree(tmp, ignore_errors=True)
bad = [("B lần %d" % (i + 1), l) for i, l in enumerate(b_res) if not l.startswith("PASS")] + [("A lần %d" % (i + 1), l) for i, l in enumerate(a_res) if not l.startswith("PASS")]
if bad: print(f"FAIL {len(bad)} đỏ giả trong {len(b_res)} lần small_tile_tooltip + {len(a_res)} lần C10 chạy chồng; đầu tiên: {bad[0][0]}: {bad[0][1][:120]}"); sys.exit(1)
print(f"PASS 0 đỏ giả: {len(b_res)} lần small_tile_tooltip (front gốc) + {len(a_res)} lần C10 (bản sao) chạy chồng, tải {W} tiến trình CPU")
