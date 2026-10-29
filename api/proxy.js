import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1. Enable Global CORS Handshaking
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

  // 2. Decode Token using standard Base64 conversion
  if (token && !targetUrl) {
    try {
      let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      targetUrl = decodeURIComponent(Buffer.from(base64, 'base64').toString('utf8'));
    } catch (e) {
      return res.status(400).send('Invalid proxy token.');
    }
  }

  if (!targetUrl) return res.status(400).send('Missing target URL parameter.');

  try {
    targetUrl = decodeURIComponent(targetUrl);
  } catch (e) {}

  // Prevent infinite extraction patterns
  while (targetUrl.includes('/service/') || targetUrl.includes('/api/proxy?token=')) {
    try {
      if (targetUrl.includes('/service/')) {
        const tParam = targetUrl.split('/service/')[1].split('&')[0];
        let base64 = tParam.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        targetUrl = decodeURIComponent(Buffer.from(base64, 'base64').toString('utf8'));
      } else if (targetUrl.includes('token=')) {
        const tParam = targetUrl.split('token=')[1].split('&')[0];
        let base64 = tParam.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        targetUrl = decodeURIComponent(Buffer.from(base64, 'base64').toString('utf8'));
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }

  // Format incomplete URL lookups safely
  if (!/^https?:\/\//i.test(targetUrl)) {
    if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
      targetUrl = 'https://' + targetUrl;
    } else {
      targetUrl = 'https://google.com' + encodeURIComponent(targetUrl);
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

    // 3. Make fetch request intercepting server-side redirects manually
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      redirect: 'manual',
      compress: true
    });

    // 4. Handle Case-Insensitive Redirect Location Strings Safely
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get('location') || response.headers.get('Location');
      if (locationHeader) {
        const absoluteRedirectUrl = new URL(locationHeader, targetUrl).href;
        // Node Safe Buffer Conversion to avoid character breaking
        const encodedToken = Buffer.from(encodeURIComponent(absoluteRedirectUrl))
          .toString('base64')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
          
        const proxiedRedirect = `/service/${encodedToken}`;
        
        // Use manual redirect fallback structure if res.redirect is not natively provisioned
        if (typeof res.redirect === 'function') {
          return res.redirect(302, proxiedRedirect);
        } else {
          res.writeHead(302, { Location: proxiedRedirect });
          return res.end();
        }
      }
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('content-type', rawContentType); } catch (e) {}

    res.setHeader('x-proxied-by', 'onyx-ultraviolet-gateway');
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

    // Helper utility to convert relative/absolute assets seamlessly 
    function proxifyUrl(val) {
      try {
        if (!val || typeof val !== 'string') return val;
        let trimmed = val.trim();
        if (/^(data:|javascript:|#|mailto:|blob:|about:)/i.test(trimmed)) return val;
        if (trimmed.includes('/service/')) return val;
        
        const absUrl = new URL(trimmed, targetUrl).href;
        const encoded = Buffer.from(encodeURIComponent(absUrl))
          .toString('base64')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
        return `/service/${encoded}`;
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

    // 5. Inject Client-Side Dom Observers with URL-Safe Encoding Fallbacks
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
                if (trimmed.includes('/service/')) return url;
                
                const abs = new URL(trimmed, document.baseURI).href;
                // Binary and Unicode safe encoding implementation for client browser environments
                const encoded = btoa(encodeURIComponent(abs))
                  .replace(/=/g, '')
                  .replace(/\\+/g, '-')
                  .replace(/\\//g, '_');
                return '/service/' + encoded;
              } catch(e) { return url; }
            }

            // Capture clicks globally on anchors/buttons to ensure navigation redirects work smoothly
            document.addEventListener('click', function(e) {
              const anchor = e.target.closest('a, area');
              if (anchor && anchor.href && !anchor.href.startsWith('javascript:') && !anchor.href.startsWith('#')) {
                e.preventDefault();
                window.location.href = encodeProxyUrl(anchor.href);
              }
            }, true);

            // Intercept standard form postings
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
    return res.status(500).send('Internal Proxy Error: ' + error.message);
  }
}
