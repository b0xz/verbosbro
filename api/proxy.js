export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('access-control-expose-headers', '*');
  res.setHeader('timing-allow-origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'fast';
  const device = req.query.device || 'desktop';
  const customScript = req.query.us ? decodeURIComponent(req.query.us) : '';

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

    // Expanded professional browser header simulation for high site compatibility (e.g., bing, youtube, coolmathgames)
    const headers = {
      'user-agent': selectedUA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'referer': `${baseUrl}/`,
      'origin': baseUrl,
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': device === 'mobile' ? '?1' : '?0',
      'sec-ch-ua-platform': device === 'mobile' ? '"iOS"' : device === 'tablet' ? '"iPadOS"' : '"Windows"',
      'sec-ch-ua-platform-version': '"15.0.0"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'dnt': '1',
      'cache-control': 'max-age=0'
    };

    if (req.headers.cookie) headers.cookie = req.headers.cookie;
    if (req.headers['authorization']) headers.authorization = req.headers['authorization'];
    if (req.headers['range']) headers.range = req.headers['range'];

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'follow',
      compress: true
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
      if (req.body) fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('content-type', rawContentType); } catch (e) {}
    if (response.headers.get('content-range')) res.setHeader('content-range', response.headers.get('content-range'));
    if (response.headers.get('accept-ranges')) res.setHeader('accept-ranges', response.headers.get('accept-ranges'));

    res.setHeader('x-proxied-by', 'miksi-quantum-core');
    res.setHeader('x-target-url', targetUrl);
    res.setHeader('x-target-origin', baseUrl);

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
      'strict-transport-security',
      'expect-ct',
      'x-download-options',
      'x-permitted-cross-domain-policies'
    ];

    headersToRemove.forEach(h => {
      try { res.removeHeader(h); } catch (e) {}
    });

    function proxifyUrl(val) {
      try {
        if (!val || typeof val !== 'string') return val;
        const trimmed = val.trim();
        if (/^(data:|javascript:|#|mailto:|blob:|about:)/i.test(trimmed)) return val;
        if (trimmed.includes('/api/proxy?url=')) return val;
        if (trimmed.startsWith('//')) return `/api/proxy?url=${encodeURIComponent(parsedUrl.protocol + trimmed)}&mode=${mode}&device=${device}&us=${encodeURIComponent(customScript)}`;
        if (trimmed.startsWith('/')) return `/api/proxy?url=${encodeURIComponent(baseUrl + trimmed)}&mode=${mode}&device=${device}&us=${encodeURIComponent(customScript)}`;
        const absUrl = new URL(trimmed, parsedUrl.href).href;
        return `/api/proxy?url=${encodeURIComponent(absUrl)}&mode=${mode}&device=${device}&us=${encodeURIComponent(customScript)}`;
      } catch (e) {
        return val;
      }
    }

    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const isCSS = contentType.includes('text/css') || contentType.includes('css');
    const isJS = contentType.includes('javascript') || contentType.includes('application/ecmascript') || contentType.includes('module');
    const isText = contentType.startsWith('text/') || isHTML || isCSS || isJS || contentType.includes('json') || contentType.includes('xml') || contentType.includes('svg');

    if (!isText) {
      if (response.body && typeof response.body.pipe === 'function') {
        try { res.removeHeader('content-length'); } catch (e) {}
        return response.body.pipe(res);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(buffer);
    }

    const originalText = await response.text();
    let body = originalText;

    if (isCSS) {
      body = body.replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      body = body.replace(/@import\s+(['"])([^'"\)]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isJS) {
      body = body.replace(/(import\s+[^'\"]+?from\s+)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);
      body = body.replace(/(import\(\s*)(['"])([^'\"]+)\2(\s*\))/gi, (m, p1, q, val, p4) => `${p1}${q}${proxifyUrl(val)}${q}${p4}`);
      body = body.replace(/(fetch\(\s*)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isHTML) {
      body = body
        .replace(/integrity="[^"]*"/gi, '')
        .replace(/nonce="[^"]*"/gi, '')
        .replace(/crossorigin="[^"]*"/gi, '')
        .replace(/http:\/\//gi, 'https://');

      body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed|input|form|object|param|link|a|area)[^>]*?\s(?:src|poster|action|data|srcset|icon|href)=)[\"']([^\"']+)[\"']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
      body = body.replace(/url\((['"]?)([^'\")]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      body = body.replace(/@import\s+(['"])([^'\"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

      const injector = `
      <base href="${baseUrl}/">
      <script>
        (function() {
          const proxyBase = '/api/proxy?mode=${mode}&device=${device}&us=${encodeURIComponent(customScript)}&url=';
          function proxify(url) {
            try {
              if (!url || typeof url !== 'string') return url;
              if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('about:')) return url;
              if (url.includes('/api/proxy?url=')) return url;
              const abs = new URL(url, document.baseURI).href;
              return proxyBase + encodeURIComponent(abs);
            } catch(e) { return url; }
          }

          const origFetch = window.fetch;
          window.fetch = function(resource, init) {
            try {
              let url = resource instanceof Request ? resource.url : resource;
              let pUrl = proxify(url);
              if (resource instanceof Request) {
                return origFetch(new Request(pUrl, resource), init);
              }
              return origFetch(pUrl, init);
            } catch(e) { return origFetch(resource, init); }
          };

          try {
            const origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              try { arguments[1] = proxify(url); } catch(e) {}
              return origOpen.apply(this, arguments);
            };
          } catch(e) {}

          try {
            const origWorker = window.Worker;
            window.Worker = function(scriptURL, options) {
              return new origWorker(proxify(scriptURL), options);
            };
          } catch(e) {}

          document.addEventListener('click', function(e) {
            const el = e.target.closest('a, area');
            if (el && el.href && !el.href.startsWith('javascript:') && !el.href.startsWith('#')) {
              e.preventDefault();
              window.location.href = proxify(el.href);
            }
          }, true);

          document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form && form.action) {
              form.action = proxify(form.action);
            }
          }, true);

          try {
            ${customScript}
          } catch(err) {}
        })();
      </script>
    `;

      if (body.includes('<head')) {
        body = body.replace(/<head(.*?)>/i, (m, attrs) => `<head${attrs}>${injector}`);
      } else if (body.includes('<html')) {
        body = body.replace(/<html(.*?)>/i, (m, attrs) => `<html${attrs}><head>${injector}</head>`);
      } else {
        body = injector + body;
      }

      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (response.body && typeof response.body.pipe === 'function') {
      try { res.removeHeader('content-length'); } catch (e) {}
      return response.body.pipe(res);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    try { res.removeHeader('content-length'); } catch (e) {}
    return res.status(200).send(buf);

  } catch (error) {
    return res.status(500).send(`<h3>Proxy Pipeline Exception</h3><p>${error.message}</p><p><em>ill fix this after school maybe</em></p>`);
  }
}
