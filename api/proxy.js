export default async function handler(req, res) {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    const requestOrigin = req.headers.origin;
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
    if (requestOrigin && allowedOriginsEnv) {
      const allowed = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);
      if (!allowed.includes(requestOrigin)) {
        return res.status(403).send('origin not allowed');
      }
      res.setHeader('access-control-allow-origin', requestOrigin);
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
    }
    return res.status(204).end();
  }

  const targetUrl = req.query.url;
  const mode = req.query.mode || 'desktop';

  if (!targetUrl) {
    return res.status(400).send('missing target url');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).send('invalid target url');
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).send('unsupported protocol');
  }

  const allowedHostsEnv = process.env.ALLOWED_HOSTS || '';
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  const allowCookieForward = process.env.ALLOW_COOKIE_FORWARDING === 'true';
  const allowSetCookie = process.env.ALLOW_SET_COOKIE === 'true';
  const allowInsecure = process.env.ALLOW_INSECURE_RENDERING === 'true';
  const timeoutMs = Number(process.env.PROXY_TIMEOUT_MS) || 10000;

  const hostname = parsedUrl.hostname;

  // If ALLOWED_HOSTS is set, only allow requests to those hosts (exact or subdomains)
  if (allowedHostsEnv) {
    const allowed = allowedHostsEnv.split(',').map(s => s.trim()).filter(Boolean);
    const allowedMatch = allowed.some(a => hostname === a || hostname.endsWith('.' + a));
    if (!allowedMatch) {
      return res.status(403).send('host not allowed');
    }
  }

  // Reject direct IPs or resolved private IPs to prevent SSRF to internal addresses
  const dns = require('dns').promises;
  const net = require('net');

  function ipIsPrivate(ip) {
    if (net.isIPv4(ip)) {
      // 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16
      if (/^10\./.test(ip)) return true;
      if (/^127\./.test(ip)) return true;
      if (/^169\.254\./.test(ip)) return true;
      if (/^192\.168\./.test(ip)) return true;
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
      return false;
    }
    if (net.isIPv6(ip)) {
      // ::1, fc00::/7 (unique local), fe80::/10 (link-local)
      if (ip === '::1' || ip === '::ffff:127.0.0.1') return true;
      if (/^fc[0-9a-f]:/i.test(ip)) return true;
      if (/^fe80:/i.test(ip)) return true;
      return false;
    }
    return false;
  }

  try {
    // If hostname is an IP literal, check it directly. Otherwise resolve DNS and check addresses.
    if (net.isIP(hostname)) {
      if (ipIsPrivate(hostname)) return res.status(403).send('host resolves to a disallowed IP');
    } else {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        if (ipIsPrivate(addr.address)) {
          return res.status(403).send('host resolves to a disallowed IP');
        }
      }
    }
  } catch (err) {
    // DNS resolution failed - be conservative and block
    return res.status(403).send('failed to resolve host');
  }

  // Sanitize and choose user agent
  const safeModes = ['desktop', 'mobile', 'stealth'];
  const safeMode = safeModes.includes(mode) ? mode : 'desktop';

  let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  if (safeMode === 'mobile') {
    userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
  } else if (safeMode === 'stealth') {
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15';
  }

  // Build fetch headers with minimal forwarding of client headers
  const headers = {
    'user-agent': userAgent,
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'referer': `${parsedUrl.protocol}//${parsedUrl.host}/`
  };

  if (allowCookieForward && req.headers.cookie) {
    headers.cookie = req.headers.cookie;
  }

  // Timeout control for fetch
  const AbortController = globalThis.AbortController || require('abort-controller');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    const contentType = (response.headers.get('content-type') || 'application/octet-stream').toLowerCase();

    const setCookie = response.headers.get('set-cookie');
    if (setCookie && allowSetCookie) {
      // Mirror Set-Cookie only when explicitly enabled (dangerous)
      res.setHeader('set-cookie', setCookie);
    }

    // CORS handling: only allow the request origin, and only if allowed by ALLOWED_ORIGINS when set
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
      if (allowedOriginsEnv) {
        const allowedOrigins = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);
        if (!allowedOrigins.includes(requestOrigin)) {
          return res.status(403).send('origin not allowed');
        }
      }
      res.setHeader('access-control-allow-origin', requestOrigin);
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
    }

    res.setHeader('content-type', contentType);

    // By default keep security headers from the response. Only strip them when explicitly allowed via env.
    if (allowInsecure) {
      try {
        res.removeHeader('x-frame-options');
        res.removeHeader('content-security-policy');
        res.removeHeader('x-content-type-options');
      } catch (e) {
        // ignore if running in environments that don't allow removeHeader
      }
    }

    if (contentType.includes('text/html')) {
      let body = await response.text();
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      function escapeHtml(str) {
        return String(str).replace(/[&<>\"']/g, function (s) {
          return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          })[s];
        });
      }

      const injectionScript = `\n<base href="${escapeHtml(baseUrl)}/">\n<script>(function(){\n  const BASE = ${JSON.stringify(baseUrl)};\n  const MODE = ${JSON.stringify(safeMode)};\n  function proxyNavigate(url){\n    window.location.href = '/api/proxy?url=' + encodeURIComponent(url) + '&mode=' + encodeURIComponent(MODE);\n  }\n  document.addEventListener('click', function(e){\n    const anchor = e.target.closest('a');\n    if (anchor && anchor.getAttribute) {\n      const href = anchor.getAttribute('href');\n      if (href && !href.startsWith('javascript:') && !href.startsWith('#')){\n        e.preventDefault();\n        try{\n          const absoluteUrl = new URL(href, document.baseURI).href;\n          proxyNavigate(absoluteUrl);\n        }catch(err){}\n      }\n    }\n  }, true);\n  document.addEventListener('submit', function(e){\n    const form = e.target.closest('form');\n    if (!form) return;\n    e.preventDefault();\n    try{\n      const actionUrl = new URL(form.getAttribute('action') || window.location.href, document.baseURI).href;\n      const formData = new FormData(form);\n      const params = new URLSearchParams(formData).toString();\n      let finalUrl = actionUrl;\n      const method = (form.method || 'get').toLowerCase();\n      if (method === 'get' && params) finalUrl += (finalUrl.includes('?') ? '&' : '?') + params;\n      proxyNavigate(finalUrl);\n    }catch(err){}\n  }, true);\n})();</script>\n`;

      // Insert the injection script right after the first <head...> tag when present (case-insensitive)
      if (/\<head(\s[^>]*)?\>/i.test(body)) {
        body = body.replace(/\<head(\s[^>]*)?\>/i, match => match + injectionScript);
      } else {
        body = injectionScript + body;
      }

      return res.status(200).send(body);
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.status(200).send(buffer);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).send('upstream request timed out');
    }
    return res.status(502).send('failed to retrieve resource');
  }
}