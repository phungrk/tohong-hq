// Vite "lạ": một tiến trình duy nhất nghe MỌI cổng trong dải cổng mà các eval front cũ hay bốc ngẫu nhiên (5100-6199),
// trả 200 cho mọi đường dẫn (giống vite lạ trả 200 cho trang bất kỳ). Cổng bận thì bỏ qua. Chạy: node decoy.cjs  (in READY khi đã nghe xong)
const http = require('http');
const srv = () => http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<html>vite-la</html>'); });
let n = 0, pending = 0;
for (let p = 5100; p <= 6199; p++) {
  pending++;
  const s = srv(); s.on('error', () => { if (--pending === 0) console.log('READY ' + n); });
  s.listen(p, '127.0.0.1', () => { n++; if (--pending === 0) console.log('READY ' + n); });
}
