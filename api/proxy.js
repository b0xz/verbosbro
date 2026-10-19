export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase();

  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('timing-allow-origin', '*');
  res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('pragma', 'no-cache');
  res.setHeader('expires', '0');

  if (method === 'OPTIONS') return res.status(200).end();

  let targetUrl = req.query.url || (req.body && req.body.url);
  const mode = String(req.query.mode || 'fast');
  const device = String(req.query.device || 'desktop');
  const customScript = typeof req.query.us === 'string' ? decodeURIComponent(req.query.us) : '';

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing target URL parameter.');
  }

  try {
    targetUrl = decodeURIComponent(targetUrl);
  } catch (e) {}

  if (targetUrl.includes('/api/proxy?url=')) {
    try {
      const parts = targetUrl.split('/api/proxy?url=');
      targetUrl = decodeURIComponent(parts[parts.length - 1]);
    } catch (e) {}
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
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  };

  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const incomingAcceptLanguage = req.headers['accept-language'] || 'en-US,en;q=0.9';
    const incomingAccept = req.headers.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    const defaultSecUA = '"Chromium";v="124", "Google Chrome";v="124", "Not.A.Brand";v="99"';
    const secUa = req.headers['sec-ch-ua'] || defaultSecUA;
    const secUaMobile = req.headers['sec-ch-ua-mobile'] || (device === 'mobile' ? '?1' : '?0');
    const secUaPlatform = req.headers['sec-ch-ua-platform'] || (device === 'mobile' ? '"iOS"' : device === 'tablet' ? '"iPadOS"' : '"Windows"');

    const headers = {
      'user-agent': selectedUA,
      'accept': incomingAccept,
      'accept-language': incomingAcceptLanguage,
      'accept-encoding': 'gzip, deflate, br',
      'referer': `${baseUrl}/`,
      'origin': baseUrl,
      'sec-ch-ua': secUa,
      'sec-ch-ua-mobile': secUaMobile,
      'sec-ch-ua-platform': secUaPlatform,
      'upgrade-insecure-requests': '1',
      'dnt': '1',
      'sec-fetch-dest': req.headers['sec-fetch-dest'] || 'document',
      'sec-fetch-mode': req.headers['sec-fetch-mode'] || 'navigate',
      'sec-fetch-site': req.headers['sec-fetch-site'] || 'cross-site',
      'sec-fetch-user': req.headers['sec-fetch-user'] || '?1',
      'cache-control': 'no-cache',
      'pragma': 'no-cache'
    };

    if (req.headers.cookie) headers.cookie = req.headers.cookie;
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers.range) headers.range = req.headers.range;
    if (req.headers['content-type'] && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers['content-type'] = req.headers['content-type'];
    }

    const fetchOptions = {
      method,
      headers,
      redirect: 'follow',
      compress: true,
      cache: 'no-store',
      credentials: 'include'
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (req.body) {
        fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body);
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('content-type', rawContentType); } catch (e) {}
    if (response.headers.get('content-range')) res.setHeader('content-range', response.headers.get('content-range'));
    if (response.headers.get('accept-ranges')) res.setHeader('accept-ranges', response.headers.get('accept-ranges'));
    if (response.headers.get('content-length')) {
      try { res.removeHeader('content-length'); } catch (e) {}
    }

    res.setHeader('x-proxied-by', 'miksi-quantum-core');
    res.setHeader('x-target-url', targetUrl);
    res.setHeader('x-target-origin', baseUrl);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      try {
        const sanitizedCookie = String(setCookie)
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
      'referrer-policy',
      'server',
      'x-powered-by'
    ];

    headersToRemove.forEach((h) => {
      try { res.removeHeader(h); } catch (e) {}
    });

    function normalizeUrl(val) {
      if (!val || typeof val !== 'string') return val;
      const trimmed = val.trim();
      if (!trimmed) return val;
      if (/^(?:data:|javascript:|blob:|about:|mailto:|tel:|#)/i.test(trimmed)) return val;

      try {
        if (trimmed.startsWith('//')) return new URL(trimmed, parsedUrl.href).href;
        if (trimmed.startsWith('/')) return new URL(trimmed, parsedUrl.href).href;
        if (!/^https?:\/\//i.test(trimmed)) return new URL(trimmed, parsedUrl.href).href;
        return new URL(trimmed).href;
      } catch (e) {
        return val;
      }
    }

    function proxifyUrl(val) {
      try {
        const raw = normalizeUrl(val);
        if (!raw || typeof raw !== 'string') return val;
        if (/^(?:data:|javascript:|blob:|about:|mailto:|tel:|#)/i.test(raw)) return raw;
        return `/api/proxy?url=${encodeURIComponent(raw)}&mode=${encodeURIComponent(mode)}&device=${encodeURIComponent(device)}&us=${encodeURIComponent(customScript)}`;
      } catch (e) {
        return val;
      }
    }

    function rewriteSrcset(value) {
      if (!value || typeof value !== 'string') return value;
      try {
        return value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const match = part.match(/^([^\s]+)(\s+.*)?$/);
            if (!match) return part;
            const url = match[1];
            const suffix = match[2] || '';
            return `${proxifyUrl(url)}${suffix}`;
          })
          .join(', ');
      } catch (e) {
        return value;
      }
    }

    function rewriteHtmlUrls(html) {
      if (!html || typeof html !== 'string') return html;

      let result = html
        .replace(/integrity="[^"]*"/gi, '')
        .replace(/nonce="[^"]*"/gi, '')
        .replace(/crossorigin="[^"]*"/gi, '')
        .replace(/<meta\s+http-equiv=["']content-security-policy["'][^>]*>/gi, '')
        .replace(/<meta\s+http-equiv=["']refresh["'][^>]*>/gi, '');

      result = result.replace(/(\b(?:src|href|action|poster|data|manifest)\s*=\s*)(["'])(.*?)\2/gi, (match, prefix, quote, value) => {
        if (!value || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('javascript:') || value.startsWith('about:') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('#')) {
          return match;
        }
        return `${prefix}${quote}${proxifyUrl(value)}${quote}`;
      });

      result = result.replace(/(\bsrcset\s*=\s*)(["'])(.*?)\2/gi, (match, prefix, quote, value) => {
        if (!value) return match;
        return `${prefix}${quote}${rewriteSrcset(value)}${quote}`;
      });

      result = result.replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      result = result.replace(/@import\s+(['"])([^'"\)]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

      return result;
    }

    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const isCSS = contentType.includes('text/css') || contentType.includes('css');
    const isJS = contentType.includes('javascript') || contentType.includes('ecmascript') || contentType.includes('module') || contentType.includes('x-javascript');
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
      body = body
        .replace(/(import\s+[^'\"]+?from\s+)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(import\(\s*)(['"])([^'\"]+)\2(\s*\))/gi, (m, p1, q, val, p4) => `${p1}${q}${proxifyUrl(val)}${q}${p4}`)
        .replace(/(fetch\(\s*)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(new\s+URL\(\s*)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isHTML) {
      body = rewriteHtmlUrls(body);

      const injector = `
        <base href="${baseUrl}/">
        <script>
          (() => {
            const proxyBase = '/api/proxy?mode=${mode}&device=${device}&us=${encodeURIComponent(customScript)}&url=';
            const customScript = ${JSON.stringify(customScript || '')};
            const blocked = /^(?:data:|blob:|javascript:|about:|mailto:|tel:)/i;

            function normalize(url) {
              try {
                if (!url || typeof url !== 'string') return url;
                const trimmed = url.trim();
                if (!trimmed || trimmed.startsWith('#') || blocked.test(trimmed)) return url;
                if (trimmed.startsWith('//')) return new URL(trimmed, document.baseURI).href;
                if (trimmed.startsWith('/')) return new URL(trimmed, document.baseURI).href;
                if (!/^https?:\/\//i.test(trimmed)) return new URL(trimmed, document.baseURI).href;
                return new URL(trimmed).href;
              } catch (e) {
                return url;
              }
            }

            function proxify(url) {
              try {
                const normalized = normalize(url);
                if (!normalized || typeof normalized !== 'string') return url;
                if (blocked.test(normalized)) return url;
                return proxyBase + encodeURIComponent(normalized);
              } catch (e) {
                return url;
              }
            }

            function proxifyAttribute(node, attrName) {
              try {
                if (!node || !node.hasAttribute(attrName)) return;
                const value = node.getAttribute(attrName);
                const proxied = proxify(value);
                if (proxied && proxied !== value) node.setAttribute(attrName, proxied);
              } catch (e) {}
            }

            function rewriteSubtree(root) {
              if (!root || typeof root.querySelectorAll !== 'function') return;
              const nodes = root.querySelectorAll('[src], [href], [action], [srcset], [poster], [data]');
              nodes.forEach((node) => {
                ['src', 'href', 'action', 'poster', 'data'].forEach((attr) => proxifyAttribute(node, attr));
                if (node.hasAttribute('srcset')) {
                  try {
                    const value = node.getAttribute('srcset');
                    if (value) {
                      const rewritten = value.split(',').map((part) => {
                        const trim = part.trim();
                        if (!trim) return part;
                        const match = trim.match(/^([^\s]+)(\s+.*)?$/);
                        if (!match) return part;
                        return `${proxify(match[1])}${match[2] || ''}`;
                      }).join(', ');
                      node.setAttribute('srcset', rewritten);
                    }
                  } catch (e) {}
                }
              });
            }

            const origFetch = window.fetch.bind(window);
            window.fetch = function(resource, init) {
              try {
                if (resource instanceof Request) {
                  return origFetch(new Request(proxify(resource.url), resource), init);
                }
                if (typeof resource === 'string') {
                  return origFetch(proxify(resource), init);
                }
              } catch (e) {}
              return origFetch.apply(this, arguments);
            };

            try {
              const origOpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url, ...args) {
                try {
                  if (typeof url === 'string') {
                    arguments[1] = proxify(url);
                  }
                } catch (e) {}
                return origOpen.apply(this, arguments);
              };
            } catch (e) {}

            document.addEventListener('click', function(event) {
              const el = event.target && event.target.closest ? event.target.closest('a, area') : null;
              if (!el || !el.href || el.href.startsWith('javascript:') || el.href.startsWith('#')) return;
              event.preventDefault();
              const finalUrl = proxify(el.href);
              if (finalUrl && finalUrl !== el.href) {
                window.location.href = finalUrl;
              }
            }, true);

            document.addEventListener('submit', function(event) {
              const form = event.target;
              if (form && form.action) {
                form.action = proxify(form.action);
              }
            }, true);

            rewriteSubtree(document);

            try {
              const observer = new MutationObserver(() => rewriteSubtree(document));
              observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'href', 'action', 'srcset', 'poster', 'data']
              });
            } catch (e) {}

            try {
              if (customScript) Function(customScript)();
            } catch (err) {}
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
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding-top:100px;">
        <h2>Proxy Pipeline Exception</h2>
        <p>${error.message || 'Unknown proxy error'}</p>
        <p><em>ill fix this after school maybe</em></p>
      </body>
      </html>
    `);
  }
}
