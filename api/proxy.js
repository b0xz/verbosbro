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

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        const absoluteRedirectUrl = new URL(locationHeader, baseUrl).href;
        const proxiedRedirect = `/api/proxy?url=${encodeURIComponent(absoluteRedirectUrl)}&mode=${mode}&device=${device}&vpn=${vpn}`;
        return res.redirect(302, proxiedRedirect);
      }
    }

    const rawContentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentType = rawContentType.toLowerCase();

    try { res.setHeader('content-type', rawContentType); } catch (e) {}
    if (response.headers.get('content-range')) res.setHeader('content-range', response.headers.get('content-range'));
    if (response.headers.get('accept-ranges')) res.setHeader('accept-ranges', response.headers.get('accept-ranges'));

    res.setHeader('x-proxied-by', 'verbo-quantum-core');
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

        const absUrl = new URL(trimmed, baseUrl).href;
        return `/api/proxy?url=` + encodeURIComponent(absUrl) + `&mode=${mode}&device=${device}&vpn=${vpn}`;
      } catch (e) {
        return val;
      }
    }

    if (!isHTML && !isCSS && !isJS) {
      if (response.body && typeof response.body.pipe === 'function') {
        try { res.removeHeader('content-length'); } catch (e) {}
        return response.body.pipe(res);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      try { res.removeHeader('content-length'); } catch (e) {}
      return res.status(200).send(buffer);
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
            const targetBase = "${baseUrl}";
            const proxyBase = '/api/proxy?mode=${mode}&device=${device}&vpn=${vpn}&url=';

            function proxify(url) {
              try {
                if (!url || typeof url !== 'string') return url;
                const trimmed = url.trim();
                if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:') || trimmed.startsWith('about:') || trimmed.startsWith('#')) return url;
                if (trimmed.includes('/api/proxy?url=')) return url;
                const abs = new URL(trimmed, targetBase).href;
                return proxyBase + encodeURIComponent(abs);
              } catch (e) { return url; }
            }

            function rewriteNavigationTargets() {
              const nodes = document.querySelectorAll('a[href], area[href], form[action], button[formaction], input[formaction], [data-href], [data-url]');
              nodes.forEach((node) => {
                try {
                  const tag = (node.tagName || '').toLowerCase();
                  if (tag === 'form') {
                    const action = node.getAttribute('action') || node.action;
                    const proxied = proxify(action);
                    if (proxied && proxied !== action) node.setAttribute('action', proxied);
                    return;
                  }

                  if (tag === 'button' || tag === 'input') {
                    const action = node.getAttribute('formaction');
                    const proxied = proxify(action);
                    if (proxied && proxied !== action) node.setAttribute('formaction', proxied);
                    return;
                  }

                  const candidate = node.getAttribute('href') || node.getAttribute('data-href') || node.getAttribute('data-url');
                  const proxied = proxify(candidate);
                  if (proxied && proxied !== candidate) {
                    if (node.hasAttribute('href')) node.setAttribute('href', proxied);
                    else if (node.hasAttribute('data-href')) node.setAttribute('data-href', proxied);
                    else if (node.hasAttribute('data-url')) node.setAttribute('data-url', proxied);
                  }
                } catch (e) {}
              });
            }

            document.addEventListener('click', function(e) {
              const target = e.target && e.target.closest ? e.target.closest('a[href], area[href], button[formaction], input[formaction], form[action], [data-href], [data-url], [role="button"]') : null;
              if (!target) return;

              let candidate = null;
              const tag = (target.tagName || '').toLowerCase();

              if (tag === 'form') {
                candidate = target.getAttribute('action') || target.action;
              } else if (tag === 'button' || tag === 'input') {
                candidate = target.getAttribute('formaction') || (target.form ? (target.form.getAttribute('action') || target.form.action) : null);
              } else {
                candidate = target.getAttribute('href') || target.getAttribute('data-href') || target.getAttribute('data-url') || target.href;
              }

              if (!candidate || candidate.startsWith('javascript:') || candidate.startsWith('#')) return;
              const proxied = proxify(candidate);
              if (!proxied || proxied === candidate) return;

              e.preventDefault();
              e.stopPropagation();
              window.location.assign(proxied);
            }, true);

            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (!form || form.nodeName !== 'FORM') return;
              const action = form.getAttribute('action') || form.action;
              if (!action || action.startsWith('javascript:') || action.startsWith('#')) return;
              const proxied = proxify(action);
              if (!proxied || proxied === action) return;
              e.preventDefault();
              window.location.assign(proxied);
            }, true);

            const originalAssign = window.location.assign.bind(window.location);
            const originalReplace = window.location.replace.bind(window.location);

            window.location.assign = function(url) {
              const proxied = proxify(url);
              return originalAssign(proxied || url);
            };

            window.location.replace = function(url) {
              const proxied = proxify(url);
              return originalReplace(proxied || url);
            };

            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function(state, title, url) {
              if (url) {
                const proxied = proxify(url);
                return originalPushState.call(this, state, title, proxied || url);
              }
              return originalPushState.call(this, state, title, url);
            };

            history.replaceState = function(state, title, url) {
              if (url) {
                const proxied = proxify(url);
                return originalReplaceState.call(this, state, title, proxied || url);
              }
              return originalReplaceState.call(this, state, title, url);
            };

            rewriteNavigationTargets();

            const observer = new MutationObserver(function() {
              rewriteNavigationTargets();
            });
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['href', 'action', 'formaction', 'data-href', 'data-url']
            });
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
