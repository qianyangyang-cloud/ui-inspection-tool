const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  // Set response headers to allow iframe embedding
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('File not found');
    return;
  }
  
  // Get file extension
  const ext = path.extname(filePath);
  let contentType = 'text/html';
  
  switch(ext) {
    case '.js': contentType = 'text/javascript'; break;
    case '.css': contentType = 'text/css'; break;
    case '.json': contentType = 'application/json'; break;
    case '.png': contentType = 'image/png'; break;
    case '.jpg': contentType = 'image/jpg'; break;
    case '.mp4': contentType = 'video/mp4'; break;
  }
  
  res.setHeader('Content-Type', contentType);
  
  // Read and return file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
  console.log(`Test page available at: http://localhost:${PORT}/test-page.html`);
});