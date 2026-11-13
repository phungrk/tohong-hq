# eval T-135: chặn mọi kết nối mạng; MỖI lần định kết nối tới googleapis.com ghi một dòng vào $NET_LOG:
#   "ok"        nếu stdout của tiến trình ($STDOUT_FILE, nếu đặt) đã có ít nhất k dòng GOOGLE_REQUEST (k = thứ tự lần thử) — sổ chi in TRƯỚC khi gửi;
#   "UNORDERED" nếu chưa (hoặc không có $STDOUT_FILE thì chỉ ghi "ok").
import os, socket
def _note(host):
    if not str(host).endswith("googleapis.com"):
        return
    nl, sf = os.environ.get("NET_LOG"), os.environ.get("STDOUT_FILE")
    if not nl:
        return
    prior = len(open(nl).read().split()) if os.path.exists(nl) else 0
    made = None
    if sf:
        try: made = open(sf, encoding="utf-8", errors="replace").read().count("GOOGLE_REQUEST")
        except OSError: made = 0
    open(nl, "a").write(("ok" if made is None or made >= prior + 1 else "UNORDERED") + "\n")
def _gai(host, *a, **k):
    _note(host)
    raise OSError("eval T-135: mạng bị chặn")
def _blocked(self, *a, **k):
    raise OSError("eval T-135: mạng bị chặn")
socket.socket.connect = _blocked
socket.create_connection = _gai_cc = lambda addr, *a, **k: _gai(addr[0])
socket.getaddrinfo = _gai
