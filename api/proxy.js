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

    if (speed === 'strong' || mode === 'stealth') {
      headers['sec-ch-ua'] = '"Chromium";v="122", "Not(A:Brand";v="8"';
      headers['sec-ch-ua-platform'] = '"macOS"';
      headers['sec-fetch-dest'] = 'document';
      headers['sec-fetch-mode'] = 'navigate';
      headers['sec-fetch-site'] = 'cross-site';
      headers['upgrade-insecure-requests'] = '1';
    }

    if (req.headers.cookie) {
      headers.cookie = req.headers.cookie;
    }

    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase().startsWith('x-proxy-header-')) {
        const realName = key.slice('x-proxy-header-'.length);
        headers[realName] = value;
      }
    }

    return headers;
  }

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

    const setCookie = [];
    try {
      if (response.headers.raw && typeof response.headers.raw === 'function') {
        const raw = response.headers.raw();
        if (raw && raw['set-cookie']) {
          setCookie.push(...raw['set-cookie']);
        }
      } else {
        const sc = response.headers.get('set-cookie');
        if (sc) {
          setCookie.push(sc);
        }
      }
    } catch (err) {
      // ignore
    }

    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'no-store');

    if (setCookie.length) {
      res.setHeader('set-cookie', setCookie);
    }

    try { res.removeHeader('x-frame-options'); } catch (err) {}
    try { res.removeHeader('content-security-policy'); } catch (err) {}
    try { res.removeHeader('x-content-type-options'); } catch (err) {}

    if (contentType.includes('text/html')) {
      let body = await response.text();
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      if (speed === 'strong') {
        body = body.replace(/integrity="[^"]*"/gi, '');
        body = body.replace(/nonce="[^"]*"/gi, '');
        body = body.replace(/crossorigin="[^"]*"/gi, '');
      }

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

      const injectionScript = `
        <base href="${baseUrl}/">
        <script>
        (function(){
          function proxify(url) {
            try {
              return '/api/proxy?url=' + encodeURIComponent(new URL(url, document.baseURI).href) + '&mode=${mode}&speed=${speed}';
            } catch (err) {
              return url;
            }
          }

          document.addEventListener('click', function(e) {
            const clickable = e.target.closest('a, area');
            if (clickable && clickable.href && !clickable.href.startsWith('javascript:') && !clickable.href.startsWith('#')) {
              e.preventDefault();
              window.location.href = proxify(clickable.getAttribute('href') || clickable.href);
              return;
            }
            const dataLink = e.target.closest('[data-href]');
            if (dataLink) {
              e.preventDefault();
              window.location.href = proxify(dataLink.getAttribute('data-href'));
            }
          }, true);

          document.addEventListener('submit', function(e) {
            const form = e.target.closest('form');
            if (!form) return;
            e.preventDefault();
            try {
              const method = (form.method || 'get').toLowerCase();
              const action = form.getAttribute('action') || window.location.href;
              const actionUrl = new URL(action, document.baseURI).href;
              if (method === 'get') {
                const formData = new FormData(form);
                const params = new URLSearchParams(formData).toString();
                const finalUrl = actionUrl + (actionUrl.includes('?') ? '&' : '?') + params;
                window.location.href = proxify(finalUrl);
                return;
              }
              const body = new FormData(form);
              fetch('/api/proxy?url=' + encodeURIComponent(actionUrl) + '&mode=${mode}&speed=${speed}', {
                method: method.toUpperCase(),
                body,
                credentials: 'omit'
              }).then((r) => r.text()).then((text) => {
                document.open();
                document.write(text);
                document.close();
              }).catch(() => {
                window.location.href = proxify(actionUrl);
              });
            } catch (err) {}
          }, true);
        })();
        </script>
      `;

      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${injectionScript}`);
      } else {
        body = injectionScript + body;
      }

      return res.status(200).send(body);
    }

    try {
      if (response.body && typeof response.body.pipe === 'function') {
        response.body.pipe(res);
        return;
      }
    } catch (err) {}

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
