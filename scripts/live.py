#!/usr/bin/env python3
"""Gửi sự kiện tới đường truyền realtime tohong-live (Cloudflare Worker).

Dùng chung cho scripts/task.py và các hook. Không bao giờ làm chậm hay làm hỏng việc
của agent: không cấu hình thì bỏ qua, gửi lỗi thì im lặng, và mặc định gửi trong một
tiến trình nền tách riêng để lệnh gọi trả về ngay.

Biến môi trường:
  TOHONG_LIVE_URL    địa chỉ Worker, vd https://tohong-live.<subdomain>.workers.dev
                     (đặt trong .claude/settings.json)
  TOHONG_LIVE_TOKEN  tùy chọn. Cách khuyến nghị là lưu mã thành Network secret của môi trường
                     cloud (host tohong-live.phungnc.workers.dev, header Authorization: Bearer):
                     proxy tự gắn mã vào request, agent không bao giờ thấy mã. Chỉ đặt biến này
                     khi không dùng được Network secret. Không bao giờ commit mã.
  TOHONG_LIVE_SYNC=1 gửi đồng bộ thay vì chạy nền (dùng khi thử nghiệm)
"""
import json
import os
import subprocess
import sys
import urllib.request

PUBLIC_EVENT_FIELDS = ("id", "t", "task", "title", "event", "from", "to", "round", "severity", "cost",
                       "state", "holder", "owner", "reviewer", "rounds")


def _post(payload):
    url = os.environ.get("TOHONG_LIVE_URL", "").rstrip("/")
    token = os.environ.get("TOHONG_LIVE_TOKEN", "")
    if not url:
        return
    headers = {"Content-Type": "application/json"}
    if token:  # không có thì Network secret của môi trường cloud gắn hộ
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        url + "/event", data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers=headers)
    try:
        urllib.request.urlopen(req, timeout=5).read()
    except Exception:
        pass


def emit(payload):
    """Gửi một payload. Không chặn, không ném lỗi."""
    if not os.environ.get("TOHONG_LIVE_URL"):
        return
    try:
        if os.environ.get("TOHONG_LIVE_SYNC") == "1":
            _post(payload)
            return
        p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--post"],
                             stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             start_new_session=True)
        p.stdin.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        p.stdin.close()
    except Exception:
        pass


def emit_event(row, meta=None):
    """Gửi một dòng nhật ký (chỉ các trường công khai) kèm trạng thái sau khi chuyển."""
    payload = {"type": "event", **{k: row[k] for k in PUBLIC_EVENT_FIELDS if k in row and row[k] not in (None, "")}}
    if meta:
        for k in ("state", "holder", "owner", "reviewer", "rounds"):
            if meta.get(k) not in (None, ""):
                payload.setdefault(k, meta[k])
        payload.setdefault("title", meta.get("title", ""))
    emit(payload)


def emit_activity(agent, action, tool="", task=""):
    emit({"type": "activity", "agent": agent, "action": action, "tool": tool, "task": task})


if __name__ == "__main__" and "--post" in sys.argv:
    try:
        _post(json.loads(sys.stdin.read()))
    except Exception:
        pass
