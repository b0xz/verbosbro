import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('timing-allow-origin', '*');
  res.setHeader('x-content-type-options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let targetUrl = req.query.url || (req.body && req.body.url);
  const token = req.query.token;
  const mode = req.query.mode || 'fast';
  const device = req.query.device || 'desktop';
  const vpn = req.query.vpn || 'us-east';
  const simIp = req.query.sim_ip || '192.168.1.102';
  const adblock = req.query.adblock === 'true';

  if (token && !targetUrl) {
    try {
      let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      targetUrl = decodeURIComponent(atob(base64));
    } catch (e) {
      return res.status(400).send('Invalid proxy token.');
    }
  }

  if (!targetUrl) return res.status(400).send('Missing target URL parameter.');

  try {
    targetUrl = decodeURIComponent(targetUrl);
  } catch (e) {}

  while (targetUrl.includes('/api/proxy?token=') || targetUrl.includes('/api/proxy?url=')) {
    try {
      if (targetUrl.includes('token=')) {
        const tParam = targetUrl.split('token=')[1].split('&')[0];
        let base64 = tParam.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        targetUrl = decodeURIComponent(atob(base64));
      } else {
        const parts = targetUrl.split('/api/proxy?url=');
        targetUrl = decodeURIComponent(parts[parts.length - 1]);
      }
    } catch (e) {
      break;
    }
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
      targetUrl = 'https://' + targetUrl;
    } else {
      targetUrl = 'https://search.yahoo.com/search?p=' + encodeURIComponent(targetUrl);
    }
  }

  const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    tablet: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  };

  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const proxyHeaders = {
      'user-agent': selectedUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'referer': `${baseUrl}/`,
      'origin': baseUrl,
      'x-forwarded-for': simIp,
      'x-real-ip': simIp,
      'cache-control': 'no-cache',
      'upgrade-insecure-requests': '1'
    };

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      redirect: 'manual',
      compress: true
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        const absoluteRedirectUrl = new URL(locationHeader, targetUrl).href;
        const encodedToken = btoa(encodeURIComponent(absoluteRedirectUrl)).replace(/=/g, '');
        const proxiedRedirect = `/api/proxy?token=${encodedToken}&mode=${mode}&device=${device}&vpn=${vpn}&sim_ip=${simIp}&adblock=${adblock}`;
        return res.redirect(302, proxiedRedirect);
      }
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('content-type', rawContentType); } catch (e) {}

    res.setHeader('x-proxied-by', 'celest-quantum-gateway');
    res.setHeader('referrer-policy', 'no-referrer');

    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-content-type-options',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'strict-transport-security'
    ];

    headersToRemove.forEach(h => {
      try { res.removeHeader(h); } catch (e) {}
    });

    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const isCSS = contentType.includes('text/css') || contentType.includes('css');
    const isJS = contentType.includes('javascript') || contentType.includes('application/ecmascript') || contentType.includes('module');

    function proxifyUrl(val) {
      try {
        if (!val || typeof val !== 'string') return val;
        let trimmed = val.trim();
        if (/^(data:|javascript:|#|mailto:|blob:|about:)/i.test(trimmed)) return val;
        if (trimmed.includes('/api/proxy?token=')) return val;
        
        const absUrl = new URL(trimmed, targetUrl).href;
        const encoded = btoa(encodeURIComponent(absUrl)).replace(/=/g, '');
        return `/api/proxy?token=` + encoded + `&mode=${mode}&device=${device}&vpn=${vpn}&sim_ip=${simIp}&adblock=${adblock}`;
      } catch (e) {
        return val;
      }
    }

    if (!isHTML && !isCSS && !isJS) {
      res.status(response.status);
      try { res.removeHeader('content-length'); } catch (e) {}
      const buffer = Buffer.from(await response.arrayBuffer());
      return res.send(buffer);
    }

    let body = await response.text();

    if (isCSS) {
      body = body.replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isJS) {
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isHTML) {
      body = body
        .replace(/integrity="[^"]*"/gi, '')
        .replace(/nonce="[^"]*"/gi, '')
        .replace(/crossorigin="[^"]*"/gi, '')
        .replace(/http:\/\//gi, 'https://');

      const injectionScript = `
        <base href="${baseUrl}/">
        <script>
          (function() {
            function encodeProxyUrl(url) {
              try {
                if (!url || typeof url !== 'string') return url;
                let trimmed = url.trim();
                if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:') || trimmed.startsWith('about:')) return url;
                if (trimmed.includes('/api/proxy?token=')) return url;
                
                const abs = new URL(trimmed, document.baseURI).href;
                const encoded = btoa(encodeURIComponent(abs)).replace(/=/g, '');
                return '/api/proxy?token=' + encoded + '&sim_ip=${simIp}&adblock=${adblock}';
              } catch(e) { return url; }
            }

            document.addEventListener('click', function(e) {
              const anchor = e.target.closest('a, area');
              if (anchor && anchor.href && !anchor.href.startsWith('javascript:') && !anchor.href.startsWith('#')) {
                e.preventDefault();
                window.location.href = encodeProxyUrl(anchor.href);
              }
            }, true);

            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form && form.action) {
                form.action = encodeProxyUrl(form.action);
              }
            }, true);
          })();
        </script>
      `;

      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${injectionScript}`);
      } else {
        body = injectionScript + body;
      }
    }

    try { res.removeHeader('content-length'); } catch (e) {}
    return res.status(200).send(body);

  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>celest — unknown website</title>
        <style>
          body {
            margin: 0; padding: 0; width: 100vw; height: 100vh;
            background-color: #000000; color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex; align-items: center; justify-content: flex-start;
            padding-left: 10vw; overflow: hidden; text-transform: lowercase;
            animation: fadeInError 0.4s ease-out;
          }
          @keyframes fadeInError {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .error-container { 
            display: flex; flex-direction: column; align-items: flex-start; gap: 12px; 
            max-width: 480px; z-Index: 2; position: relative;
          }
          .error-code { font-size: 0.85rem; color: #888888; font-weight: 500; letter-spacing: 1px; }
          .error-title { font-size: 2rem; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
          .error-text { font-size: 0.95rem; color: #aaaaaa; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-code">error 500</div>
          <div class="error-title">unknown or unreachable website</div>
          <div class="error-text">we couldn't connect to the requested address. please verify the URL and try again.</div>
        </div>
      </body>
      </html>
    `);
  }
}
