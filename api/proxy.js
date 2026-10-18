export default async function handler(req, res) {
  // ─── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300');
  res.setHeader('Timing-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = (req.query.mode || 'fast').toLowerCase();
  const device = (req.query.device || 'desktop').toLowerCase();

  if (!targetUrl) return res.status(400).send('Missing target URL parameter.');

  // ─── SSRF Protection ───────────────────────────────────────────────────────
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return res.status(400).send('Invalid target URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).send('Only http and https protocols are allowed.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    return res.status(403).send('Access to local/private addresses is blocked.');
  }

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

  // ─── User-Agent ────────────────────────────────────────────────────────────
  const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    tablet:  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    mobile:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  };
  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  // ─── Outgoing headers ──────────────────────────────────────────────────────
  const headers = {
    'User-Agent': selectedUA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': `${baseUrl}/`,
    'Origin': baseUrl,
    'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-CH-UA-Mobile': device === 'mobile' ? '?1' : '?0',
    'Sec-CH-UA-Platform': device === 'mobile' ? '"iOS"' : device === 'tablet' ? '"iPadOS"' : '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
  };

  if (req.headers.cookie) headers['Cookie'] = req.headers.cookie;
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;

  const fetchOptions = {
    method: req.method,
    headers,
    redirect: 'manual', // important so we can rewrite Location
    compress: true
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.body) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    // ─── Redirects ───────────────────────────────────────────────────────────
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        const absolute = new URL(location, targetUrl).href;
        const proxied = `/api/proxy?url=${encodeURIComponent(absolute)}&mode=${mode}&device=${device}`;
        res.setHeader('Location', proxied);
        return res.status(response.status).end();
      }
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('Content-Type', rawContentType); } catch {}
    res.setHeader('X-Proxied-By', 'miksi-ultra-engine');
    res.setHeader('X-Target-Url', targetUrl);
    res.setHeader('X-Target-Origin', baseUrl);

    // ─── Multi-cookie support ────────────────────────────────────────────────
    let setCookies = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookies = response.headers.getSetCookie();
    } else if (response.headers.raw) {
      setCookies = response.headers.raw()['set-cookie'] || [];
    } else {
      const single = response.headers.get('set-cookie');
      if (single) setCookies = [single];
    }

    if (setCookies.length) {
      const sanitized = setCookies.map(c =>
        c
          .replace(/;\s*Domain=[^;]+/gi, '')
          .replace(/;\s*Secure/gi, '')
          .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=None')
      );
      res.setHeader('Set-Cookie', sanitized);
    }

    // ─── Strip restrictive headers ───────────────────────────────────────────
    [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-content-type-options',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'permissions-policy',
      'strict-transport-security',
      'expect-ct',
      'x-download-options',
      'x-permitted-cross-domain-policies'
    ].forEach(h => {
      try { res.removeHeader(h); } catch {}
    });

    // ─── Proxify helper ──────────────────────────────────────────────────────
    function proxifyUrl(val) {
      try {
        if (!val || typeof val !== 'string') return val;
        const trimmed = val.trim();
        if (/^(data:|javascript:|#|mailto:|blob:|about:)/i.test(trimmed)) return val;
        if (trimmed.includes('/api/proxy?url=')) return val;
        if (trimmed.startsWith('//')) {
          return `/api/proxy?url=${encodeURIComponent(parsedUrl.protocol + trimmed)}&mode=${mode}&device=${device}`;
        }
        if (trimmed.startsWith('/')) {
          return `/api/proxy?url=${encodeURIComponent(baseUrl + trimmed)}&mode=${mode}&device=${device}`;
        }
        const abs = new URL(trimmed, parsedUrl.href).href;
        return `/api/proxy?url=${encodeURIComponent(abs)}&mode=${mode}&device=${device}`;
      } catch {
        return val;
      }
    }

    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const isCSS  = contentType.includes('text/css');
    const isJS   = contentType.includes('javascript') || contentType.includes('ecmascript') || contentType.includes('module');
    const isText = contentType.startsWith('text/') || isHTML || isCSS || isJS ||
                   contentType.includes('json') || contentType.includes('xml') || contentType.includes('svg');

    // ─── Fast binary path ────────────────────────────────────────────────────
    if (mode === 'fast' && !isText) {
      try { res.removeHeader('content-length'); } catch {}
      if (response.body && typeof response.body.pipe === 'function') {
        return response.body.pipe(res);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return res.status(response.status).send(buffer);
    }

    let body = await response.text();

    // ─── CSS ─────────────────────────────────────────────────────────────────
    if (isCSS) {
      body = body
        .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`)
        .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch {}
      return res.status(response.status).send(body);
    }

    // ─── JavaScript ──────────────────────────────────────────────────────────
    if (isJS) {
      body = body
        .replace(/(import\s+[^'"]+?\s+from\s+)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/gi, (m, p1, q, val, p4) => `${p1}${q}${proxifyUrl(val)}${q}${p4}`)
        .replace(/(fetch\s*\(\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(location\.href\s*=\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(new\s+Worker\s*\(\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(navigator\.serviceWorker\.register\s*\(\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch {}
      return res.status(response.status).send(body);
    }

    // ─── HTML ────────────────────────────────────────────────────────────────
    if (isHTML) {
      // Clean integrity / nonce / crossorigin
      body = body
        .replace(/\s+integrity=(["'])[^"']*\1/gi, '')
        .replace(/\s+nonce=(["'])[^"']*\1/gi, '')
        .replace(/\s+crossorigin=(["'])[^"']*\1/gi, '');

      // Common attributes
      body = body.replace(
        /(<(?:img|script|iframe|audio|video|source|track|embed|input|form|object|param|link|a|area)[^>]*?\s(?:src|href|poster|action|data|icon)=)(["'])([^"']+)\2/gi,
        (m, p1, q, p2) => `${p1}"${proxifyUrl(p2)}"`
      );

      // Proper srcset handling
      body = body.replace(/\s(srcset)=(["'])([^"']+)\2/gi, (m, attr, q, val) => {
        const rewritten = val.split(',').map(part => {
          const bits = part.trim().split(/\s+/);
          const url = bits.shift();
          return proxifyUrl(url) + (bits.length ? ' ' + bits.join(' ') : '');
        }).join(', ');
        return ` ${attr}="${rewritten}"`;
      });

      // Lazy-load / data attributes
      body = body.replace(
        /\s(data-src|data-srcset|data-background|data-bg|data-lazy-src|data-original)=(["'])([^"']+)\2/gi,
        (m, attr, q, val) => ` ${attr}="${proxifyUrl(val)}"`
      );

      // Inline CSS
      body = body.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      body = body.replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

      // ─── Injected client interceptor (best of both) ───────────────────────
      const injector = `
        <base href="${baseUrl}/">
        <script>
          (function () {
            const proxyBase = '/api/proxy?mode=${mode}&device=${device}&url=';

            function proxify(url) {
              try {
                if (!url || typeof url !== 'string') return url;
                if (/^(data:|blob:|javascript:|about:|#|mailto:)/i.test(url)) return url;
                if (url.includes('/api/proxy?url=')) return url;
                const abs = new URL(url, document.baseURI).href;
                return proxyBase + encodeURIComponent(abs);
              } catch (e) {
                return url;
              }
            }

            // fetch
            const origFetch = window.fetch;
            window.fetch = function (resource, init) {
              try {
                let url = resource instanceof Request ? resource.url : resource;
                const pUrl = proxify(url);
                if (resource instanceof Request) {
                  return origFetch(new Request(pUrl, resource), init);
                }
                return origFetch(pUrl, init);
              } catch (e) {
                return origFetch(resource, init);
              }
            };

            // XMLHttpRequest
            const origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url) {
              try { arguments[1] = proxify(url); } catch (e) {}
              return origOpen.apply(this, arguments);
            };

            // History API (important for SPAs)
            const origPush = history.pushState;
            const origReplace = history.replaceState;
            history.pushState = function (state, title, url) {
              if (url) arguments[2] = proxify(url);
              return origPush.apply(this, arguments);
            };
            history.replaceState = function (state, title, url) {
              if (url) arguments[2] = proxify(url);
              return origReplace.apply(this, arguments);
            };

            // WebSocket
            const OrigWS = window.WebSocket;
            window.WebSocket = function (url, protocols) {
              return new OrigWS(proxify(url), protocols);
            };
            window.WebSocket.prototype = OrigWS.prototype;

            // Worker
            try {
              const OrigWorker = window.Worker;
              window.Worker = function (scriptURL, options) {
                return new OrigWorker(proxify(scriptURL), options);
              };
            } catch (e) {}

            // setAttribute (catches a lot of dynamic DOM changes)
            try {
              const origSetAttribute = Element.prototype.setAttribute;
              Element.prototype.setAttribute = function (name, value) {
                if (
                  (name === 'src' || name === 'href' || name === 'action' || name === 'poster' || name === 'data-src') &&
                  typeof value === 'string' &&
                  !/^(data:|blob:|javascript:|#)/i.test(value)
                ) {
                  value = proxify(value);
                }
                return origSetAttribute.call(this, name, value);
              };
            } catch (e) {}

            // Click navigation
            document.addEventListener('click', function (e) {
              const el = e.target.closest('a[href], area[href]');
              if (el && el.href && !/^(javascript:|#|mailto:)/i.test(el.getAttribute('href') || '')) {
                e.preventDefault();
                window.location.href = proxify(el.href);
              }
            }, true);

            // Form submit
            document.addEventListener('submit', function (e) {
              const form = e.target;
              if (form && form.action) {
                form.action = proxify(form.action);
              }
            }, true);
          })();
        </script>
      `;

      if (/<head[\s>]/i.test(body)) {
        body = body.replace(/<head([^>]*)>/i, (m, attrs) => `<head${attrs}>${injector}`);
      } else if (/<html[\s>]/i.test(body)) {
        body = body.replace(/<html([^>]*)>/i, (m, attrs) => `<html${attrs}><head>${injector}</head>`);
      } else {
        body = injector + body;
      }

      try { res.removeHeader('content-length'); } catch {}
      return res.status(response.status).send(body);
    }

    // Fallback
    try { res.removeHeader('content-length'); } catch {}
    return res.status(response.status).send(body);

  } catch (error) {
    console.error('[Proxy Error]', error);
    return res.status(500).send(
      `<h3>Proxy Pipeline Exception</h3><p>${error.message}</p>`
    );
  }
}
