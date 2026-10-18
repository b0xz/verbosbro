export default async function handler(req, res) {
  // ─── CORS (simple + permissive) ──────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ─── Input ───────────────────────────────────────────────────────────────
  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = (req.query.mode || 'full').toLowerCase(); // default to full now
  const device = (req.query.device || 'desktop').toLowerCase();

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing target URL parameter.');
  }

  // ─── Basic SSRF Protection ───────────────────────────────────────────────
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
    hostname.endsWith('.localhost') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    hostname === 'metadata.google.internal'
  ) {
    return res.status(403).send('Access to local/private addresses is blocked.');
  }

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

  // ─── User-Agent ──────────────────────────────────────────────────────────
  const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    tablet:  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    mobile:  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  };
  const selectedUA = UA_MAP[device] || UA_MAP.desktop;

  // ─── Outgoing headers ────────────────────────────────────────────────────
  const headers = {
    'User-Agent': selectedUA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': `${baseUrl}/`,
    'Origin': baseUrl,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  if (req.headers.cookie) headers['Cookie'] = req.headers.cookie;
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  const fetchOptions = {
    method: req.method,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(18000) // a bit longer
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    if (req.body) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    // ─── Redirects ─────────────────────────────────────────────────────────
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        const absoluteLocation = new URL(location, targetUrl).href;
        const proxiedLocation = `/api/proxy?url=${encodeURIComponent(absoluteLocation)}&mode=${mode}&device=${device}`;
        res.setHeader('Location', proxiedLocation);
        return res.status(response.status).end();
      }
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('Content-Type', rawContentType); } catch {}
    res.setHeader('X-Proxied-By', 'sheldon-proxy');
    res.setHeader('X-Target-Url', targetUrl);

    // ─── Cookies ───────────────────────────────────────────────────────────
    let setCookies = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookies = response.headers.getSetCookie();
    } else {
      const single = response.headers.get('set-cookie');
      if (single) setCookies = [single];
    }

    if (setCookies.length > 0) {
      const sanitized = setCookies.map(cookie =>
        cookie
          .replace(/;\s*Domain=[^;]+/gi, '')
          .replace(/;\s*Secure/gi, '')
          .replace(/;\s*SameSite=[^;]+/gi, '; SameSite=Lax')
      );
      res.setHeader('Set-Cookie', sanitized);
    }

    // Strip framing / security headers that break proxying
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'content-security-policy-report-only',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'permissions-policy',
      'strict-transport-security'
    ];
    headersToRemove.forEach(h => {
      try { res.removeHeader(h); } catch {}
    });

    // ─── Proxify helper ────────────────────────────────────────────────────
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
        const absUrl = new URL(trimmed, parsedUrl.href).href;
        return `/api/proxy?url=${encodeURIComponent(absUrl)}&mode=${mode}&device=${device}`;
      } catch {
        return val;
      }
    }

    const isHTML = contentType.includes('text/html') || contentType.includes('application/xhtml');
    const isCSS  = contentType.includes('text/css');
    const isJS   = contentType.includes('javascript') || contentType.includes('ecmascript') || contentType.includes('module');
    const isText = contentType.startsWith('text/') || isHTML || isCSS || isJS ||
                   contentType.includes('json') || contentType.includes('xml') || contentType.includes('svg');

    // ─── Fast path for images / fonts / media / binary ─────────────────────
    if ((mode === 'fast' || mode === 'full') && !isText) {
      try { res.removeHeader('content-length'); } catch {}
      // Prefer streaming when possible
      if (response.body && typeof response.body.pipe === 'function') {
        return response.body.pipe(res);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return res.status(response.status).send(buffer);
    }

    // ─── Text body ─────────────────────────────────────────────────────────
    let body = await response.text();

    // ─── CSS ───────────────────────────────────────────────────────────────
    if (isCSS) {
      body = body
        .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`)
        .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`)
        .replace(/@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, val) => `@import url(${q}${proxifyUrl(val)}${q})`);
      try { res.removeHeader('content-length'); } catch {}
      return res.status(response.status).send(body);
    }

    // ─── JavaScript (basic static rewrite) ─────────────────────────────────
    if (isJS) {
      body = body
        .replace(/(import\s+[^'"]+?\s+from\s+)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/gi, (m, p1, q, val, p4) => `${p1}${q}${proxifyUrl(val)}${q}${p4}`)
        .replace(/(fetch\s*\(\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(new\s+Worker\s*\(\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`)
        .replace(/(navigator\.serviceWorker\.register\s*\(\s*)(['"])([^'"]+)\2/gi, (m, p1, q, val) => `${p1}${q}${proxifyUrl(val)}${q}`);
      try { res.removeHeader('content-length'); } catch {}
      return res.status(response.status).send(body);
    }

    // ─── HTML – heavy rewriting + powerful client interceptor ──────────────
    if (isHTML) {
      // Remove things that break under proxy
      body = body
        .replace(/\s+integrity=(["'])[^"']*\1/gi, '')
        .replace(/\s+nonce=(["'])[^"']*\1/gi, '')
        .replace(/\s+crossorigin=(["'])[^"']*\1/gi, '');

      // Common URL-bearing attributes
      body = body.replace(
        /(<(?:img|script|iframe|audio|video|source|track|embed|input|form|object|param|link|area|a|use)[^>]*?\s(?:src|href|poster|action|data|xlink:href)=)(["'])([^"']+)\2/gi,
        (m, p1, q, p2) => `${p1}"${proxifyUrl(p2)}"`
      );

      // srcset + imagesrcset
      body = body.replace(/\s(srcset|imagesrcset)=(["'])([^"']+)\2/gi, (m, attr, q, val) => {
        const rewritten = val.split(',').map(part => {
          const bits = part.trim().split(/\s+/);
          const url = bits.shift();
          return proxifyUrl(url) + (bits.length ? ' ' + bits.join(' ') : '');
        }).join(', ');
        return ` ${attr}="${rewritten}"`;
      });

      // Lazy / data attributes
      body = body.replace(
        /\s(data-src|data-srcset|data-background|data-bg|data-lazy-src|data-original|data-url|data-image)=(["'])([^"']+)\2/gi,
        (m, attr, q, val) => ` ${attr}="${proxifyUrl(val)}"`
      );

      // Inline style url()
      body = body.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, val) => `url(${q}${proxifyUrl(val)}${q})`);

      // @import
      body = body.replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, val) => `@import ${q}${proxifyUrl(val)}${q}`);

      // ─── Powerful client-side backup interceptor ─────────────────────────
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
              const abs = new URL(url, document.baseURI || '${baseUrl}/').href;
              return proxyBase + encodeURIComponent(abs);
            } catch (e) {
              return url;
            }
          }

          // 1. fetch
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

          // 2. XMLHttpRequest
          const origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function (method, url) {
            try { arguments[1] = proxify(url); } catch (e) {}
            return origOpen.apply(this, arguments);
          };

          // 3. History API
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

          // 4. WebSocket
          const OrigWS = window.WebSocket;
          window.WebSocket = function (url, protocols) {
            return new OrigWS(proxify(url), protocols);
          };
          window.WebSocket.prototype = OrigWS.prototype;

          // 5. Image constructor
          const OrigImage = window.Image;
          window.Image = function () {
            const img = new OrigImage(...arguments);
            const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') ||
                         Object.getOwnPropertyDescriptor(Image.prototype, 'src');
            if (desc && desc.set) {
              Object.defineProperty(img, 'src', {
                set(v) { desc.set.call(this, proxify(v)); },
                get() { return desc.get.call(this); }
              });
            }
            return img;
          };
          window.Image.prototype = OrigImage.prototype;

          // 6. Override src / href setters on elements
          function patchProperty(proto, prop) {
            const desc = Object.getOwnPropertyDescriptor(proto, prop);
            if (!desc || !desc.set) return;
            Object.defineProperty(proto, prop, {
              set(value) {
                desc.set.call(this, proxify(value));
              },
              get() {
                return desc.get.call(this);
              },
              configurable: true
            });
          }

          patchProperty(HTMLImageElement.prototype, 'src');
          patchProperty(HTMLScriptElement.prototype, 'src');
          patchProperty(HTMLIFrameElement.prototype, 'src');
          patchProperty(HTMLMediaElement.prototype, 'src');
          patchProperty(HTMLSourceElement.prototype, 'src');
          patchProperty(HTMLEmbedElement.prototype, 'src');
          patchProperty(HTMLLinkElement.prototype, 'href');
          patchProperty(HTMLAnchorElement.prototype, 'href');
          patchProperty(HTMLFormElement.prototype, 'action');

          // 7. srcset special handling
          const srcsetDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset') ||
                             Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset');
          if (srcsetDesc && srcsetDesc.set) {
            function rewriteSrcset(val) {
              if (!val) return val;
              return val.split(',').map(part => {
                const bits = part.trim().split(/\\s+/);
                const url = bits.shift();
                return proxify(url) + (bits.length ? ' ' + bits.join(' ') : '');
              }).join(', ');
            }
            Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
              set(v) { srcsetDesc.set.call(this, rewriteSrcset(v)); },
              get() { return srcsetDesc.get.call(this); },
              configurable: true
            });
            Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
              set(v) { srcsetDesc.set.call(this, rewriteSrcset(v)); },
              get() { return srcsetDesc.get.call(this); },
              configurable: true
            });
          }

          // 8. createElement backup
          const origCreate = Document.prototype.createElement;
          Document.prototype.createElement = function (tag, options) {
            const el = origCreate.call(this, tag, options);
            // already covered by prototype patches above
            return el;
          };

          // 9. MutationObserver – catch late-added elements
          const observer = new MutationObserver(mutations => {
            for (const mut of mutations) {
              for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                // re-apply on common attributes if they still look external
                ['src', 'href', 'poster', 'data-src', 'data-background'].forEach(attr => {
                  if (node.hasAttribute && node.hasAttribute(attr)) {
                    const val = node.getAttribute(attr);
                    if (val && !val.includes('/api/proxy?url=') && !/^(data:|javascript:|#)/i.test(val)) {
                      node.setAttribute(attr, proxify(val));
                    }
                  }
                });
                if (node.querySelectorAll) {
                  node.querySelectorAll('[src], [href], [poster], [data-src]').forEach(child => {
                    ['src', 'href', 'poster', 'data-src'].forEach(attr => {
                      if (child.hasAttribute(attr)) {
                        const val = child.getAttribute(attr);
                        if (val && !val.includes('/api/proxy?url=') && !/^(data:|javascript:|#)/i.test(val)) {
                          child.setAttribute(attr, proxify(val));
                        }
                      }
                    });
                  });
                }
              }
            }
          });
          observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
          });

          // 10. Click + form
          document.addEventListener('click', function (e) {
            const el = e.target.closest('a[href], area[href]');
            if (el && el.href && !/^(javascript:|#|mailto:)/i.test(el.getAttribute('href') || '')) {
              e.preventDefault();
              location.href = proxify(el.href);
            }
          }, true);

          document.addEventListener('submit', function (e) {
            const form = e.target;
            if (form && form.action) {
              form.action = proxify(form.action);
            }
          }, true);

          // 11. Background images set via style
          const origSetProperty = CSSStyleDeclaration.prototype.setProperty;
          CSSStyleDeclaration.prototype.setProperty = function (prop, value, priority) {
            if (typeof value === 'string' && value.includes('url(')) {
              value = value.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
                return 'url(' + q + proxify(u) + q + ')';
              });
            }
            return origSetProperty.call(this, prop, value, priority);
          };
        })();
        </script>
      `;

      if (/<head[\\s>]/i.test(body)) {
        body = body.replace(/<head([^>]*)>/i, (m, attrs) => `<head${attrs}>${injector}`);
      } else if (/<html[\\s>]/i.test(body)) {
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
    console.error('[Proxy Error]', error.message);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).send('Upstream request timed out');
    }
    return res.status(502).send('Failed to fetch target resource');
  }
}
