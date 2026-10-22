import { Readable } from 'stream';

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('timing-allow-origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'fast';
  const device = req.query.device || 'desktop';
  const vpn = req.query.vpn || 'us-east';

  if (!targetUrl) return res.status(400).send('Missing target URL parameter.');

  try {
    targetUrl = decodeURIComponent(targetUrl);
  } catch (e) {}

  while (targetUrl.includes('/api/proxy?url=')) {
    try {
      const parts = targetUrl.split('/api/proxy?url=');
      targetUrl = decodeURIComponent(parts[parts.length - 1]);
    } catch (e) {
      break;
    }
  }

  if (!/^https?:\/\//i.test(targetUrl)) {
    try {
      targetUrl = new URL(targetUrl, 'https://example.com').href;
    } catch (e) {
      return res.status(400).send('Invalid target URL parameter.');
    }
  }

  const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    tablet: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    xbox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edge/110.0.1587.57',
    playstation: 'Mozilla/5.0 (PlayStation 5 3.20) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    smarttv: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.100 TV Safari/537.36'
  };

  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const vpnXForwarded = vpn === 'eu-west' ? '85.214.132.11' : vpn === 'asia-sec' ? '202.12.29.11' : '54.240.196.18';

    const headers = {
      'user-agent': selectedUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'referer': `${baseUrl}/`,
      'origin': baseUrl,
      'x-forwarded-for': vpnXForwarded,
      'x-real-ip': vpnXForwarded,
      'upgrade-insecure-requests': '1',
      'dnt': '1'
    };

    if (req.headers.cookie) headers.cookie = req.headers.cookie;
    if (req.headers['authorization']) headers.authorization = req.headers['authorization'];
    if (req.headers['range']) headers.range = req.headers['range'];

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'manual',
      compress: true
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
      if (req.body) fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Enhanced Redirect Handling: Intercept 3xx and rewrite Location
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        const absoluteRedirectUrl = new URL(locationHeader, targetUrl).href;
        const proxiedRedirect = `/api/proxy?url=${encodeURIComponent(absoluteRedirectUrl)}&mode=${mode}&device=${device}&vpn=${vpn}`;
        return res.redirect(302, proxiedRedirect);
      }
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('content-type', rawContentType); } catch (e) {}
    if (response.headers.get('content-range')) res.setHeader('content-range', response.headers.get('content-range'));
    if (response.headers.get('accept-ranges')) res.setHeader('accept-ranges', response.headers.get('accept-ranges'));

    res.setHeader('x-proxied-by', 'verbos-quantum-core');
    res.setHeader('x-target-url', targetUrl);
    res.setHeader('x-target-origin', baseUrl);
    res.setHeader('x-vpn-node', vpn);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      try {
        const sanitizedCookie = setCookie
          .replace(/;\s*Domain=[^;]+/gi, '')
          .replace(/;\s*Secure/gi, '')
          .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=None');
        res.setHeader('set-cookie', sanitizedCookie);
      } catch (e) {}
    }

    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-content-type-options',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'permissions-policy',
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
        if (trimmed.includes('/api/proxy?url=')) return val;
        
        const absUrl = new URL(trimmed, targetUrl).href;
        return `/api/proxy?url=` + encodeURIComponent(absUrl) + `&mode=${mode}&device=${device}&vpn=${vpn}`;
      } catch (e) {
        return val;
      }
    }

    if (!isHTML && !isCSS && !isJS) {
      res.status(response.status);
      try { res.removeHeader('content-length'); } catch (e) {}
      
      if (response.body) {
        try {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          return res.end();
        } catch (streamErr) {
          const buffer = Buffer.from(await response.arrayBuffer());
          return res.send(buffer);
        }
      }
      return res.end();
    }

    let body = await response.text();

    if (isCSS) {
      body = body.replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      body = body.replace(/@import\s+(['"])([^'"\)]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isJS) {
      body = body.replace(/(fetch\s*\(\s*)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);
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
            const proxyBase = '/api/proxy?mode=${mode}&device=${device}&vpn=${vpn}&url=';
            function proxify(url) {
              try {
                if (!url || typeof url !== 'string') return url;
                let trimmed = url.trim();
                if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:') || trimmed.startsWith('about:')) return url;
                if (trimmed.includes('/api/proxy?url=')) return url;
                const abs = new URL(trimmed, document.baseURI).href;
                
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: 'verbos-navigate', url: abs }, '*');
                }

                return proxyBase + encodeURIComponent(abs);
              } catch(e) { return url; }
            }

            document.addEventListener('click', function(e) {
              const anchor = e.target.closest('a, area');
              if (anchor && anchor.href && !anchor.href.startsWith('javascript:') && !anchor.href.startsWith('#')) {
                e.preventDefault();
                window.location.href = proxify(anchor.href);
              }
            }, true);

            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form && form.action) {
                form.action = proxify(form.action);
              }
            }, true);

            try {
              const originalAssign = window.location.assign;
              window.location.assign = function(url) {
                return originalAssign.call(window.location, proxify(url));
              };

              const originalReplace = window.location.replace;
              window.location.replace = function(url) {
                return originalReplace.call(window.location, proxify(url));
              };

              const loc = window.location;
              if (loc) {
                Object.defineProperty(window, 'location', {
                  get: function() { return loc; },
                  set: function(val) {
                    loc.href = proxify(val);
                  },
                  configurable: true
                });
              }
            } catch(err) {}
          })();
        </script>
      `;

      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${injectionScript}`);
      } else if (body.includes('<head ')) {
        body = body.replace(/<head(.*?)>/i, (m, attrs) => `<head${attrs}>${injectionScript}`);
      } else {
        body = injectionScript + body;
      }
    }

    try { res.removeHeader('content-length'); } catch (e) {}
    return res.status(200).send(body);

  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding-top:100px;">
        <h2>proxy connection error</h2>
        <p>failed to retrieve resource: ${error.message}</p>
        <p><em>ill fix this after school maybe</em></p>
      </body>
      </html>
    `);
  }
}
