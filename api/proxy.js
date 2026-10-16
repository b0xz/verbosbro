export default async function handler(req, res) {
  const targetUrl = req.query.url || (req.body && req.body.url);
  const mode = req.query.mode || 'desktop';
  const speed = req.query.speed || 'fast';
  const debug = req.query.debug === '1' || req.headers['x-proxy-debug'] === '1';

  if (!targetUrl) {
    return res.status(400).send('missing target url');
  }

  const UA_POOLS = {
    desktop: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15'
    ],
    mobile: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
    ],
    stealth: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
    ]
  };

  function pickUserAgent(modeName) {
    const pool = UA_POOLS[modeName] || UA_POOLS.desktop;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildFetchHeaders(parsedUrl) {
    const headers = {
      'user-agent': pickUserAgent(mode),
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': `${parsedUrl.protocol}//${parsedUrl.host}/`
    };

    // Strong/stealth tries to mimic a real browser more closely
    if (speed === 'strong' || mode === 'stealth') {
      headers['sec-ch-ua'] = '"Chromium";v="122", "Not(A:Brand";v="8"';
      headers['sec-ch-ua-platform'] = '"macOS"';
      headers['sec-fetch-dest'] = 'document';
      headers['sec-fetch-mode'] = 'navigate';
      headers['sec-fetch-site'] = 'cross-site';
      headers['upgrade-insecure-requests'] = '1';
      // Ask for a wider range of types (videos/images) when strong
      headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,video/*,*/*;q=0.8';
    }

    // Forward cookies from the original client to the target
    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie;
    }

    // Allow callers to pass arbitrary headers via x-proxy-header-*
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase().startsWith('x-proxy-header-')) {
        const realName = key.slice('x-proxy-header-'.length);
        headers[realName] = value;
      }
    }

    // If the client requests a byte range (video), forward it so the origin can respond with 206
    if (req.headers.range) {
      headers.range = req.headers.range;
    }

    return headers;
  }

  const HOP_BY_HOP = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'
  ]);

  async function retryFetch(url, options = {}, attempts = 3) {
    let lastErr;

    for (let i = 0; i < attempts; i += 1) {
      try {
        const timeout = Math.min(30000, 9000 + i * 5000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
        clearTimeout(timer);

        if (!response.ok && (response.status >= 500 || response.status === 429)) {
          lastErr = new Error(`bad status ${response.status}`);
          await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 800 * (i + 1)));
          continue;
        }

        return response;
      } catch (err) {
        lastErr = err;
        await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** i) + Math.random() * 300));
      }
    }

    throw lastErr;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const fetchOptions = { headers: buildFetchHeaders(parsedUrl) };

    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      const method = req.method.toUpperCase();
      fetchOptions.method = method;

      if (req.headers['content-type']) {
        fetchOptions.headers['content-type'] = req.headers['content-type'];
      }

      if (req.rawBody) {
        fetchOptions.body = req.rawBody;
      } else if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    if (debug) {
      console.log('[proxy] fetching', targetUrl, 'with headers', fetchOptions.headers);
    }

    const response = await retryFetch(targetUrl, fetchOptions, 3);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Collect set-cookie values robustly
    const setCookie = [];
    try {
      if (response.headers.raw && typeof response.headers.raw === 'function') {
        const raw = response.headers.raw();
        if (raw && raw['set-cookie']) {
          setCookie.push(...raw['set-cookie']);
        }
      } else {
        const sc = response.headers.get('set-cookie');
        if (sc) setCookie.push(sc);
      }
    } catch (err) {
      // ignore
    }

    // Copy most response headers back to the client, filtering hop-by-hop and rewriting some values
    function copyResponseHeaders(srcHeaders) {
      const headers = {};
      for (const [key, value] of srcHeaders.entries()) {
        const keyLower = key.toLowerCase();
        if (HOP_BY_HOP.has(keyLower)) continue;
        // Location header needs to be proxied so redirects stay inside the proxy
        if (keyLower === 'location') {
          try {
            const loc = new URL(value, parsedUrl.href).href;
            headers['location'] = '/api/proxy?url=' + encodeURIComponent(loc) + `&mode=${mode}&speed=${speed}`;
            continue;
          } catch (err) {
            // fallthrough
          }
        }
        headers[key] = value;
      }
      return headers;
    }

    const respHeadersToSend = copyResponseHeaders(response.headers);

    // Set base headers
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('cache-control', 'no-store');

    // Forward content-type and other important headers
    if (respHeadersToSend['content-type'] || contentType) {
      res.setHeader('content-type', respHeadersToSend['content-type'] || contentType);
    }

    if (respHeadersToSend['content-length']) res.setHeader('content-length', respHeadersToSend['content-length']);
    if (respHeadersToSend['accept-ranges']) res.setHeader('accept-ranges', respHeadersToSend['accept-ranges']);
    if (respHeadersToSend['content-range']) res.setHeader('content-range', respHeadersToSend['content-range']);

    // Set cookies
    if (setCookie.length) {
      res.setHeader('set-cookie', setCookie);
    }

    // Try to remove framing / CSP headers from the proxied response so the content can run inside the iframe
    try { res.removeHeader('x-frame-options'); } catch (err) {}
    try { res.removeHeader('content-security-policy'); } catch (err) {}
    try { res.removeHeader('x-content-type-options'); } catch (err) {}

    // If the origin returned a 206 (partial content), forward that status and stream data
    if (response.status === 206) {
      res.statusCode = 206;
      for (const [k, v] of Object.entries(respHeadersToSend)) {
        try { res.setHeader(k, v); } catch (e) {}
      }
      // Stream the body directly
      try {
        if (response.body && typeof response.body.pipe === 'function') {
          response.body.pipe(res);
          return;
        }
        // Node fetch might expose a web ReadableStream
        if (typeof response.body?.getReader === 'function') {
          const { pipeline } = require('stream');
          const { Readable } = require('stream');
          const nodeStream = Readable.fromWeb(response.body);
          await new Promise((resolve, reject) => pipeline(nodeStream, res, (err) => err ? reject(err) : resolve()));
          return;
        }
      } catch (err) {
        if (debug) console.error('[proxy] streaming 206 failed', err);
      }
    }

    // Handle HTML specially: inject script and rewrite resource urls so images/videos/scripts load through proxy
    if ((respHeadersToSend['content-type'] || contentType).includes('text/html')) {
      let body = await response.text();
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      if (speed === 'strong') {
        body = body.replace(/integrity="[^"]*"/gi, '');
        body = body.replace(/nonce="[^"]*"/gi, '');
        body = body.replace(/crossorigin="[^"]*"/gi, '');
      }

      // Fix meta refresh to absolute URLs
      body = body.replace(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*>/gi, (match) => {
        return match.replace(/url=([^"'>\s]+)/i, (sub, value) => {
          try {
            const abs = new URL(value.replace(/["']/g, ''), baseUrl).href;
            return `url=${abs}`;
          } catch (err) {
            return sub;
          }
        });
      });

      // Rewrite resource attributes (src, href, srcset, poster, data-src, action for forms) to use the proxy
      function proxifyAttrUrl(val) {
        try {
          if (!val || /^(data:|javascript:|#|mailto:)/i.test(val)) return val;
          // Already proxied
          if (val.includes('/api/proxy?url=')) return val;
          const abs = new URL(val, baseUrl).href;
          return `/api/proxy?url=${encodeURIComponent(abs)}&mode=${mode}&speed=${speed}`;
        } catch (err) {
          return val;
        }
      }

      // src and href
      body = body.replace(/(<(?:img|script|iframe|audio|video|source|track|embed|iframe)[^>]*?\s(?:src|poster)=)["']([^"']+)["']/gi, (m, p1, p2) => {
        return `${p1}"${proxifyAttrUrl(p2)}"`;
      });

      // href on link/a/area
      body = body.replace(/(<(?:a|area|link)[^>]*?\shref=)["']([^"']+)["']/gi, (m, p1, p2) => {
        return `${p1}"${proxifyAttrUrl(p2)}"`;
      });

      // srcset (multiple candidates)
      body = body.replace(/(<[^>]+\ssrcset=)["']([^"']+)["']/gi, (m, p1, p2) => {
        try {
          const parts = p2.split(',').map(s => {
            const [urlPart, descriptor] = s.trim().split(/\s+/, 2);
            return `${proxifyAttrUrl(urlPart)}${descriptor ? ' ' + descriptor : ''}`;
          });
          return `${p1}"${parts.join(', ')}"`;
        } catch (err) { return m; }
      });

      // CSS url() in inline styles
      body = body.replace(/url\(([^)]+)\)/gi, (m, p1) => {
        const cleaned = p1.replace(/["'\s]/g, '');
        const prox = proxifyAttrUrl(cleaned);
        return `url(${prox})`;
      });

      // Inject base + runtime script that also rewrites dynamically added elements and intercepts clicks/forms
      const injectionScript = `\n        <base href="${baseUrl}/">\n        <script>\n        (function(){\n          function proxify(url) {\n            try { return '/api/proxy?url=' + encodeURIComponent(new URL(url, document.baseURI).href) + '&mode=${mode}&speed=${speed}'; } catch (err) { return url; }\n          }\n\n          // Walk the DOM and rewrite known attributes so they load through the proxy\n          function rewriteExisting() {\n            const attrTargets = [ ['src', 'img,script,iframe,audio,video,source,track,embed'], ['href', 'a,area,link'], ['poster', 'video'] ];\n            attrTargets.forEach(([attr, selector]) => {\n              document.querySelectorAll(selector).forEach((el) => {\n                try { const v = el.getAttribute(attr); if (v && !/^(data:|javascript:|#|mailto:)/i.test(v) && !v.includes('/api/proxy?url=')) el.setAttribute(attr, proxify(v)); } catch(e){}\n              });\n            });\n            // srcset\n            document.querySelectorAll('[srcset]').forEach((el) => { try { const ss = el.getAttribute('srcset'); if (!ss.includes('/api/proxy?url=')) { const parts = ss.split(',').map(s => { const [u, d] = s.trim().split(/\\s+/,2); return proxify(u) + (d? ' '+d : ''); }); el.setAttribute('srcset', parts.join(', ')); } } catch(e){} });\n            // inline styles url()\n            document.querySelectorAll('[style]').forEach((el) => { try { const s = el.getAttribute('style'); const replaced = s.replace(/url\\(([^)]+)\\)/gi, function(m, p1){ const cleaned = p1.replace(/["'\\s]/g, ''); if (/^(data:)/i.test(cleaned)) return 'url('+cleaned+')'; return 'url('+proxify(cleaned)+')'; }); if (replaced !== s) el.setAttribute('style', replaced); } catch(e){} });\n          }\n\n          rewriteExisting();\n\n          // Observe DOM changes and rewrite inserted nodes\n          const obs = new MutationObserver((mutations) => { rewriteExisting(); });\n          obs.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','href','srcset','style','poster'] });\n\n          document.addEventListener('click', function(e) {\n            const clickable = e.target.closest('a, area');\n            if (clickable && clickable.href && !clickable.href.startsWith('javascript:') && !clickable.href.startsWith('#')) {\n              e.preventDefault();\n              window.location.href = proxify(clickable.getAttribute('href') || clickable.href);\n              return;\n            }\n            const dataLink = e.target.closest('[data-href]');\n            if (dataLink) { e.preventDefault(); window.location.href = proxify(dataLink.getAttribute('data-href')); }\n          }, true);\n\n          document.addEventListener('submit', function(e) {\n            const form = e.target.closest('form'); if (!form) return; e.preventDefault(); try { const method = (form.method || 'get').toLowerCase(); const action = form.getAttribute('action') || window.location.href; const actionUrl = new URL(action, document.baseURI).href; if (method === 'get') { const formData = new FormData(form); const params = new URLSearchParams(formData).toString(); const finalUrl = actionUrl + (actionUrl.includes('?') ? '&' : '?') + params; window.location.href = proxify(finalUrl); return; } const body = new FormData(form); fetch('/api/proxy?url=' + encodeURIComponent(actionUrl) + '&mode=${mode}&speed=${speed}', { method: method.toUpperCase(), body, credentials: 'omit' }).then((r) => r.text()).then((text) => { document.open(); document.write(text); document.close(); }).catch(() => { window.location.href = proxify(actionUrl); }); } catch (err) {} }, true);\n\n        })();\n        <\/script>\n      `;

      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${injectionScript}`);
      } else {
        body = injectionScript + body;
      }

      res.status(200).send(body);
      return;
    }

    // For non-HTML responses, stream binary content (images, video, etc.) and forward ranges
    try {
      // Copy any response headers
      for (const [k, v] of Object.entries(respHeadersToSend)) {
        try { res.setHeader(k, v); } catch (e) {}
      }

      // If node-style stream is available
      if (response.body && typeof response.body.pipe === 'function') {
        response.body.pipe(res);
        return;
      }

      // If web ReadableStream, convert to node stream
      if (typeof response.body?.getReader === 'function') {
        const { pipeline } = require('stream');
        const { Readable } = require('stream');
        const nodeStream = Readable.fromWeb(response.body);
        await new Promise((resolve, reject) => pipeline(nodeStream, res, (err) => err ? reject(err) : resolve()));
        return;
      }
    } catch (err) {
      if (debug) console.error('[proxy] stream fallback error', err);
    }

    // Last resort: buffer and send
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);
  } catch (error) {
    if (debug) {
      console.error('[proxy] error', error);
    }
    return res.status(500).send(`<h3>proxy connection error</h3><p>failed to retrieve resource: ${error.message}</p>`);
  }
}
