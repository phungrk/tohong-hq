# eval T-135: chặn mọi kết nối mạng và GHI mỗi lần thử vào $NET_LOG (một dòng mỗi lần) để đo "đã định gọi Google chưa".
import os, socket
def _blocked(self, *a, **k):
    open(os.environ.get("NET_LOG", os.devnull), "a").write("connect\n")
    raise OSError("eval T-135: mạng bị chặn")
def _gai(*a, **k):
    open(os.environ.get("NET_LOG", os.devnull), "a").write("getaddrinfo\n")
    raise OSError("eval T-135: mạng bị chặn")
socket.socket.connect = _blocked
socket.create_connection = _blocked
socket.getaddrinfo = _gai
