export default async function handler(req, res) {
  // Enhanced CORS Headers
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'fast';
  const device = req.query.device || 'desktop';

  if (!targetUrl) return res.status(400).send('Missing target URL parameter.');

  const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    tablet: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  };

  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    
    // Comprehensive Request Header Configuration
    const headers = {
      'user-agent': selectedUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'referer': `${baseUrl}/`,
      'origin': baseUrl,
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': device === 'mobile' ? '?1' : '?0',
      'sec-ch-ua-platform': device === 'mobile' ? '"iOS"' : '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    };

    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    const fetchOptions = { method: req.method, headers, redirect: 'follow' };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
      if (req.body) fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Set headers
    res.setHeader('content-type', contentType);
    res.setHeader('x-proxied-by', 'miksi-engine');
    res.setHeader('x-target-url', targetUrl);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('set-cookie', setCookie.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=[^;]+/gi, '; SameSite=None'));
    }

    // Extended Security Strip List
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

    // Stream Non-HTML Files Immediately
    if (mode === 'fast' && !contentType.includes('text/html')) {
      if (response.body && typeof response.body.pipe === 'function') {
        return response.body.pipe(res);
      }
      return res.status(200).send(Buffer.from(await response.arrayBuffer()));
    }

    let body = await response.text();

    // Comprehensive DOM String Transformations
    body = body
      .replace(/integrity="[^"]*"/gi, '')
      .replace(/nonce="[^"]*"/gi, '')
      .replace(/crossorigin="[^"]*"/gi, '')
      .replace(/http:\/\//gi, 'https://');

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

    // Extended Tag & Attribute URL Proxification
    body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed|input|form|object)[^>]*?\s(?:src|poster|action|data)=)["']([^"']+)["']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
    body = body.replace(/(<(?:a|area|link|base)[^>]*?\shref=)["']([^"']+)["']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
    body = body.replace(/url\((['"]?)([^'")]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
    body = body.replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

    // Advanced Client Injector for SPAs, Fetch, XHR, and Dynamic Imports
    const injector = `
      <base href="${baseUrl}/">
      <script>
        (function() {
          const proxyBase = '/api/proxy?mode=${mode}&device=${device}&url=';
          const targetOrigin = '${baseUrl}';

          function proxify(url) {
            try {
              if (!url || typeof url !== 'string') return url;
              if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return url;
              if (url.includes('/api/proxy?url=')) return url;
              const abs = new URL(url, document.baseURI).href;
              return proxyBase + encodeURIComponent(abs);
            } catch(e) { return url; }
          }

          // Fetch Interceptor
          const origFetch = window.fetch;
          window.fetch = function(resource, init) {
            let url = resource instanceof Request ? resource.url : resource;
            let pUrl = proxify(url);
            if (resource instanceof Request) {
              return origFetch(new Request(pUrl, resource), init);
            }
            return origFetch(pUrl, init);
          };

          // XHR Interceptor
          const origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            arguments[1] = proxify(url);
            return origOpen.apply(this, arguments);
          };

          // DOM Click Event Trap
          document.addEventListener('click', function(e) {
            const el = e.target.closest('a, area');
            if (el && el.href && !el.href.startsWith('javascript:') && !el.href.startsWith('#')) {
              e.preventDefault();
              window.location.href = proxify(el.href);
            }
          }, true);

          // Dynamic Element Src Trap
          const origSetAttribute = Element.prototype.setAttribute;
          Element.prototype.setAttribute = function(name, value) {
            if ((name === 'src' || name === 'href') && value && typeof value === 'string') {
              if (!value.startsWith('data:') && !value.startsWith('blob:')) {
                value = proxify(value);
              }
            }
            return origSetAttribute.call(this, name, value);
          };
        })();
      </script>
    `;

    if (body.includes('<head>')) {
      body = body.replace('<head>', `<head>${injector}`);
    } else if (body.includes('<html>')) {
      body = body.replace('<html>', `<html><head>${injector}</head>`);
    } else {
      body = injector + body;
    }

    return res.status(200).send(body);

  } catch (error) {
    return res.status(500).send(`<h3>Proxy Pipeline Exception</h3><p>${error.message}</p>`);
  }
}
