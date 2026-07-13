const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // API Local File Upload Endpoint (Saves dropped/selected audio files to local_uploads disk)
  if (req.method === 'POST' && req.url.startsWith('/api/upload')) {
    const query = req.url.split('?')[1] || '';
    const params = new URLSearchParams(query);
    const rawName = params.get('name') || `track_${Date.now()}.mp3`;
    const cleanName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    const uploadDir = path.join(__dirname, 'local_uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const targetPath = path.join(uploadDir, cleanName);
    const fileStream = fs.createWriteStream(targetPath);
    
    req.pipe(fileStream);
    
    fileStream.on('error', (err) => {
      res.writeHead(500, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify({ error: err.message }));
    });
    
    fileStream.on('finish', () => {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify({ url: `/local_uploads/${cleanName}` }));
    });
    return;
  }

  // API Save Endpoint (Writes curation array back to songs.js)
  if (req.method === 'POST' && req.url === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const songs = JSON.parse(body);
        const fileContent = `// Auto-generated unified database\nconst INITIAL_SONGS = ${JSON.stringify(songs, null, 2)};\n`;
        fs.writeFileSync(path.join(__dirname, 'songs.js'), fileContent, 'utf8');
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify({ success: true, count: songs.length }));
      } catch (err) {
        res.writeHead(400, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Server
  const cleanUrl = req.url.split('?')[0];
  // Root serves The Vault final site; old dashboard at /dashboard
  let filePath;
  if (cleanUrl === '/') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    filePath = path.join(__dirname, cleanUrl);
  }

  
  // Guard against directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    
    // Disable caching completely for development & local curation
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Curation server running at http://localhost:${PORT}`);
});
