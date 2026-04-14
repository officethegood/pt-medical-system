const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing "url" parameter' }));
      return;
    }

    // Security: only allow CMSV6 API
    if (!targetUrl.includes('StandardApiAction')) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'URL not allowed' }));
      return;
    }

    // Fetch from CMSV6
    const data = await fetchUrl(targetUrl);
    res.writeHead(200);
    res.end(data);

  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log('GPS Proxy running on port ' + PORT);
});
