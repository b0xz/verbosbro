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
      // Let the remote server decide compression; node-fetch will handle decoding
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
    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    // Forward selected response headers (but sanitize where necessary)
    // Do not forward content-length (we may change body size)
    try { res.setHeader('content-type', rawContentType); } catch (e) {}
    res.setHeader('x-proxied-by', 'miksi-engine');
    res.setHeader('x-target-url', targetUrl);

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      try {
        res.setHeader('set-cookie', setCookie.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=[^;]+/gi, '; SameSite=None'));
      } catch (e) {}
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

    // Helper: proxify absolute/relative urls so browser requests them back through this proxy
    function proxifyUrl(val) {
      try {
        if (!val || /^(data:|javascript:|#|mailto:|blob:)/i.test(val)) return val;
        if (val.includes('/api/proxy?url=')) return val;
        // handle protocol-relative //example.com/path
        if (val.startsWith('//')) return `/api/proxy?url=${encodeURIComponent(parsedUrl.protocol + val)}&mode=${mode}&device=${device}`;
        // handle root-relative /path
        if (val.startsWith('/')) return `/api/proxy?url=${encodeURIComponent(baseUrl + val)}&mode=${mode}&device=${device}`;
        // handle absolute and relative
        const absUrl = new URL(val, parsedUrl.href).href;
        return `/api/proxy?url=${encodeURIComponent(absUrl)}&mode=${mode}&device=${device}`;
      } catch (e) {
        return val;
      }
    }

    // Decide how to handle body based on content type
    // If binary (images, fonts, videos) => stream/pipe immediately
    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const isCSS = contentType.includes('text/css') || contentType.includes('css');
    const isJS = contentType.includes('javascript') || contentType.includes('application/ecmascript') || contentType.includes('module');
    const isText = contentType.startsWith('text/') || isHTML || isCSS || isJS || contentType.includes('json') || contentType.includes('xml') || contentType.includes('svg');

    // Fast-path: stream truly binary data (images, fonts) without converting to text to avoid corruption
    if (mode === 'fast' && !isText) {
      // try to pipe Node stream if available
      if (response.body && typeof response.body.pipe === 'function') {
        // remove content-length to avoid mismatch
        try { res.removeHeader('content-length'); } catch (e) {}
        return response.body.pipe(res);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(buffer);
    }

    // For HTML, CSS, and JS we fetch as text and perform rewriting so assets load correctly
    const originalText = await response.text();
    let body = originalText;

    if (isCSS) {
      // Rewrite url(...) and @import in CSS
      body = body.replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      body = body.replace(/@import\s+(['"])([^'"\)]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

      // respond with transformed CSS
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isJS) {
      // Rewrite static imports: import ... from '...'; and dynamic import('...')
      // This is a best-effort regex and won't cover every valid JS syntax case.
      body = body.replace(/(import\s+[^'\"]+?from\s+)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => {
        return `${p1}${q}${proxifyUrl(val)}${q}`;
      });
      // dynamic import('...')
      body = body.replace(/(import\(\s*)(['"])([^'\"]+)\2(\s*\))/gi, (m, p1, q, val, p4) => `${p1}${q}${proxifyUrl(val)}${q}${p4}`);
      // fetch('...') calls are caught by HTML injector but transforming here helps when JS is loaded standalone
      body = body.replace(/(fetch\(\s*)(['"])([^'\"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);

      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(body);
    }

    if (isHTML) {
      // Comprehensive DOM String Transformations for HTML
      body = body
        .replace(/integrity="[^"]*"/gi, '')
        .replace(/nonce="[^"]*"/gi, '')
        .replace(/crossorigin="[^"]*"/gi, '')
        .replace(/http:\/\//gi, 'https://');

      // Replace common attributes that point to resources
      body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed|input|form|object)[^>]*?\s(?:src|poster|action|data)=)[\"']([^\"']+)[\"']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
      body = body.replace(/(<(?:a|area|link|base)[^>]*?\shref=)[\"']([^\"']+)[\"']/gi, (m, p1, p2) => `${p1}"${proxifyUrl(p2)}"`);
      body = body.replace(/url\((['"]?)([^'\")]+)\1\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);
      body = body.replace(/@import\s+(['"])([^'\"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

      // Ensure <base> exists (so relative urls in the page resolve correctly). We inject base at top of <head>.
      const injector = `\n      <base href="${baseUrl}/">\n      <script>\n        (function() {\n          const proxyBase = '/api/proxy?mode=${mode}&device=${device}&url=';\n          function proxify(url) {\n            try {\n              if (!url || typeof url !== 'string') return url;\n              if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return url;\n              if (url.includes('/api/proxy?url=')) return url;\n              const abs = new URL(url, document.baseURI).href;\n              return proxyBase + encodeURIComponent(abs);\n            } catch(e) { return url; }\n          }\n\n          // Fetch interceptor\n          const origFetch = window.fetch;\n          window.fetch = function(resource, init) {\n            try {\n              let url = resource instanceof Request ? resource.url : resource;\n              let pUrl = proxify(url);\n              if (resource instanceof Request) {\n                return origFetch(new Request(pUrl, resource), init);\n              }\n              return origFetch(pUrl, init);\n            } catch(e) { return origFetch(resource, init); }\n          };\n\n          // XHR interceptor\n          try {\n            const origOpen = XMLHttpRequest.prototype.open;\n            XMLHttpRequest.prototype.open = function(method, url) {\n              try { arguments[1] = proxify(url); } catch(e) {}\n              return origOpen.apply(this, arguments);\n            };\n          } catch(e) {}\n\n          // DOM click handler for SPA links\n          document.addEventListener('click', function(e) {\n            const el = e.target.closest('a, area');\n            if (el && el.href && !el.href.startsWith('javascript:') && !el.href.startsWith('#')) {\n              e.preventDefault();\n              window.location.href = proxify(el.href);\n            }\n          }, true);\n\n          // SetAttribute trap for dynamic src/href changes\n          try {\n            const origSetAttribute = Element.prototype.setAttribute;\n            Element.prototype.setAttribute = function(name, value) {\n              if ((name === 'src' || name === 'href') && value && typeof value === 'string') {\n                if (!value.startsWith('data:') && !value.startsWith('blob:')) {\n                  value = proxify(value);\n                }\n              }\n              return origSetAttribute.call(this, name, value);\n            };\n          } catch(e) {}\n        })();\n      <\/script>\n    `;

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

    // Fallback: stream raw body if not handled above
    if (response.body && typeof response.body.pipe === 'function') {
      try { res.removeHeader('content-length'); } catch (e) {}
      return response.body.pipe(res);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    try { res.removeHeader('content-length'); } catch (e) {}
    return res.status(200).send(buf);

  } catch (error) {
    return res.status(500).send(`<h3>Proxy Pipeline Exception</h3><p>${error.message}</p>`);
  }
}
