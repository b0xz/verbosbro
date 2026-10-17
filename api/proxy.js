export default async function handler(req, res) {
  // Always set CORS headers first so client can handle errors gracefully
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url || (req.body && req.body.url);

  if (!targetUrl) {
    return res.status(400).send('Missing target URL parameter.');
  }

  const UA_POOLS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1'
  ];

  const randomUA = UA_POOLS[Math.floor(Math.random() * UA_POOLS.length)];

  try {
    const parsedUrl = new URL(targetUrl);
    const headers = {
      'user-agent': randomUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'referer': `${parsedUrl.protocol}//${parsedUrl.host}/`
    };

    const response = await fetch(targetUrl, { 
      headers, 
      redirect: 'follow' 
    });

    const contentType = response.headers.get('content-type') || 'text/html';
    res.setHeader('content-type', contentType);

    // Strip frame-blocking headers from target response
    try { res.removeHeader('x-frame-options'); } catch (e) {}
    try { res.removeHeader('content-security-policy'); } catch (e) {}
    try { res.removeHeader('x-content-type-options'); } catch (e) {}

    // HTML rewriting logic
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
          return `/api/proxy?url=${encodeURIComponent(abs)}`;
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
              try { return '/api/proxy?url=' + encodeURIComponent(new URL(url, document.baseURI).href); } catch(e) { return url; }
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

    // Binary / Asset responses (Buffer instead of broken streaming)
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);

  } catch (error) {
    return res.status(500).send(`
      <div style="color:#fff;background:#121212;font-family:sans-serif;padding:20px;text-align:center;">
        <h3>Proxy Error</h3>
        <p>Failed to load target URL: ${targetUrl}</p>
        <p><small>${error.message}</small></p>
      </div>
    `);
  }
}
