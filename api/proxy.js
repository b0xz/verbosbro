export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('cache-control', 'public, max-age=60');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'fast';
  const device = req.query.device || 'desktop';

  if (!targetUrl) return res.status(400).send('Missing target URL.');

  // Hardware mapped UA Pools
  const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    tablet: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  };

  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    
    const headers = {
      'user-agent': selectedUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'referer': `${baseUrl}/`,
      'origin': baseUrl
    };

    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    const fetchOptions = { method: req.method, headers, redirect: 'follow' };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
      if (req.body) fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('content-type', contentType);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('set-cookie', setCookie.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*Secure/gi, ''));
    }

    try { res.removeHeader('x-frame-options'); } catch (e) {}
    try { res.removeHeader('content-security-policy'); } catch (e) {}
    try { res.removeHeader('x-content-type-options'); } catch (e) {}

    // Fast Mode & Binary Relay
    if (mode === 'fast' || !contentType.includes('text/html')) {
      if (response.body && typeof response.body.pipe === 'function') {
        return response.body.pipe(res);
      }
      return res.status(200).send(Buffer.from(await response.arrayBuffer()));
    }

    // Strong Mode HTML & Resource Rewriter
    let body = await response.text();
    body = body.replace(/integrity="[^"]*"/gi, '').replace(/nonce="[^"]*"/gi, '').replace(/crossorigin="[^"]*"/gi, '');

    function proxifyUrl(val) {
      try {
        if (!val || /^(data:|javascript:|#|mailto:|blob:)/i.test(val)) return val;
        if (val.includes('/api/proxy?url=')) return val;
        let absUrl = val.startsWith('//') ? parsedUrl.protocol + val : val.startsWith('/') ? `${baseUrl}${val}` : new URL(val, baseUrl).href;
        return `/api/proxy?url=${encodeURIComponent(absUrl)}&mode=${mode}&device=${device}`;
      } catch (e) {
        return val;
      }
    }

    body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed)[^>]*?\s(?:src|poster)=)["']([^"']+)["']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
    body = body.replace(/(<(?:a|area|link)[^>]*?\shref=)["']([^"']+)["']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
    body = body.replace(/url\((['"]?)([^'")]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);

    const injector = `
      <base href="${baseUrl}/">
      <script>
        (function() {
          function proxify(url) {
            try {
              if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
              if (url.includes('/api/proxy?url=')) return url;
              return '/api/proxy?url=' + encodeURIComponent(new URL(url, document.baseURI).href) + '&mode=${mode}&device=${device}';
            } catch(e) { return url; }
          }
          const originalFetch = window.fetch;
          window.fetch = function(resource, init) {
            let url = resource instanceof Request ? resource.url : resource;
            return originalFetch(resource instanceof Request ? new Request(proxify(url), resource) : proxify(url), init);
          };
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            arguments[1] = proxify(url);
            return originalOpen.apply(this, arguments);
          };
          document.addEventListener('click', function(e) {
            const el = e.target.closest('a, area');
            if (el && el.href && !el.href.startsWith('javascript:') && !el.href.startsWith('#')) {
              e.preventDefault();
              window.location.href = proxify(el.href);
            }
          }, true);
        })();
      </script>
    `;

    body = body.includes('<head>') ? body.replace('<head>', `<head>${injector}`) : injector + body;
    return res.status(200).send(body);

  } catch (error) {
    return res.status(500).send(`<h3>Proxy Error</h3><p>${error.message}</p>`);
  }
}
