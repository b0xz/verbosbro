export default async function handler(req, res) {
  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'fast';

  if (!targetUrl) {
    return res.status(400).send('missing target url');
  }

  const UA_POOLS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.40 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.40 Mobile Safari/537.36'
  ];

  const randomUA = UA_POOLS[Math.floor(Math.random() * UA_POOLS.length)];

  try {
    const parsedUrl = new URL(targetUrl);
    const headers = {
      'user-agent': randomUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,video/*,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': `${parsedUrl.protocol}//${parsedUrl.host}/`
    };

    if (mode === 'strong') {
      headers['sec-ch-ua'] = '"Chromium";v="123", "Not:A-Brand";v="8"';
      headers['sec-fetch-dest'] = 'document';
      headers['sec-fetch-mode'] = 'navigate';
      headers['sec-fetch-site'] = 'cross-site';
      headers['upgrade-insecure-requests'] = '1';
    }

    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    const response = await fetch(targetUrl, { headers, redirect: 'follow' });
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', contentType);

    try { res.removeHeader('x-frame-options'); } catch (e) {}
    try { res.removeHeader('content-security-policy'); } catch (e) {}
    try { res.removeHeader('x-content-type-options'); } catch (e) {}

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

      body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed)[^>]*?\s(?:src|poster)=)["']([^"']+)["']/gi, (m, p1, p2) => {
        return `${p1}"${proxifyUrl(p2)}"`;
      });

      body = body.replace(/(<(?:a|area|link)[^>]*?\shref=)["']([^"']+)["']/gi, (m, p1, p2) => {
        return `${p1}"${proxifyUrl(p2)}"`;
      });

      body = body.replace(/url\(([^)]+)\)/gi, (m, p1) => {
        const cleaned = p1.replace(/["'\s]/g, '');
        return `url(${proxifyUrl(cleaned)})`;
      });

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

    if (response.body && typeof response.body.pipe === 'function') {
      return response.body.pipe(res);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);

  } catch (error) {
    return res.status(500).send(`<h3>miksi proxy connection error</h3><p>${error.message}</p>`);
  }
}
