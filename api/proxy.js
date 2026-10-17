export default async function handler(req, res) {
  // Global CORS headers
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'strong';

  if (!targetUrl) {
    return res.status(400).send('Missing target URL parameter.');
  }

  const UA_POOLS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  ];

  const randomUA = UA_POOLS[Math.floor(Math.random() * UA_POOLS.length)];

  try {
    const parsedUrl = new URL(targetUrl);
    
    const headers = {
      'user-agent': randomUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'upgrade-insecure-requests': '1'
    };

    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie;
    }

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'follow'
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.headers['content-type']) {
        headers['content-type'] = req.headers['content-type'];
      }
      if (req.body) {
        fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('content-type', contentType);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('set-cookie', setCookie);
    }

    // Strip framing restrictions
    try { res.removeHeader('x-frame-options'); } catch (e) {}
    try { res.removeHeader('content-security-policy'); } catch (e) {}
    try { res.removeHeader('x-content-type-options'); } catch (e) {}

    // HTML Rewriting Engine
    if (contentType.includes('text/html')) {
      let body = await response.text();
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      body = body.replace(/integrity="[^"]*"/gi, '');
      body = body.replace(/nonce="[^"]*"/gi, '');
      body = body.replace(/crossorigin="[^"]*"/gi, '');

      function proxifyUrl(val) {
        try {
          if (!val || /^(data:|javascript:|#|mailto:)/i.test(val)) return val;
          if (val.includes('/api/proxy?url=')) return val;
          const abs = new URL(val, baseUrl).href;
          return `/api/proxy?url=${encodeURIComponent(abs)}&mode=${mode}`;
        } catch (e) {
          return val;
        }
      }

      body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed)[^>]*?\s(?:src|poster)=)["']([^"']+)["']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
      body = body.replace(/(<(?:a|area|link)[^>]*?\shref=)["']([^"']+)["']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);

      const injector = `
        <base href="${baseUrl}/">
        <script>
          (function() {
            function proxify(url) {
              try { return '/api/proxy?url=' + encodeURIComponent(new URL(url, document.baseURI).href) + '&mode=${mode}'; } catch(e) { return url; }
            }
            document.addEventListener('click', function(e) {
              const el = e.target.closest('a, area');
              if (el && el.href && !el.href.startsWith('javascript:') && !el.href.startsWith('#')) {
                e.preventDefault();
                window.location.href = proxify(el.href);
              }
            }, true);
          })();
        <\/script>
      `;

      body = body.includes('<head>') ? body.replace('<head>', `<head>${injector}`) : injector + body;
      return res.status(200).send(body);
    }

    // Buffer translation for images, styles, scripts, and video fragments
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);

  } catch (error) {
    return res.status(500).send(`
      <div style="color:#fff;background:#121212;font-family:sans-serif;padding:30px;text-align:center;">
        <h3 style="color:#ff5555;">Miksi Proxy Connection Error</h3>
        <p>Unable to connect to target URL: <strong>${targetUrl}</strong></p>
        <p><small>${error.message}</small></p>
      </div>
    `);
  }
}
