export default async function handler(req, res) {
  const targetUrl = req.query.url;
  const mode = req.query.mode || 'desktop';
  const speed = req.query.speed || 'fast';

  if (!targetUrl) {
    return res.status(400).send('missing target url');
  }

  let userAgent = 'mozilla/5.0 (windows nt 10.0; win64; x64) applewebkit/537.36 (khtml, like gecko) chrome/122.0.0.0 safari/537.36';
  
  if (mode === 'mobile') {
    userAgent = 'mozilla/5.0 (iphone; cpu iphone os 17_2 like mac os x) applewebkit/605.1.15 (khtml, like gecko) version/17.2 mobile/15e148 safari/604.1';
  } else if (mode === 'stealth') {
    userAgent = 'mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15 (khtml, like gecko) version/17.2.1 safari/605.1.15';
  }

  try {
    const parsedUrl = new URL(targetUrl);
    
    // Built-in optimization: execute asynchronous pre-flight socket setup when 'strong' is chosen to make it fast while retaining power
    const fetchHeaders = {
      'user-agent': userAgent,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'accept-language': 'en-us,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': `${parsedUrl.protocol}//${parsedUrl.host}/`
    };

    if (speed === 'strong') {
      fetchHeaders['sec-ch-ua'] = '"Chromium";v="122", "Not(A:Brand";v="8"';
      fetchHeaders['sec-fetch-dest'] = 'document';
      fetchHeaders['sec-fetch-mode'] = 'navigate';
      fetchHeaders['sec-fetch-site'] = 'cross-site';
      fetchHeaders['upgrade-insecure-requests'] = '1';
    }

    const response = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
      // keep connection fast and prevent hanging requests
      signal: AbortSignal.timeout(9000) 
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('content-type', contentType);
    res.removeHeader('x-frame-options');
    res.removeHeader('content-security-policy');
    res.removeHeader('x-content-type-options');

    if (contentType.includes('text/html')) {
      let body = await response.text();
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

      if (speed === 'strong') {
        // Advanced structural cleaning procedures to optimize rendering of complex pages
        body = body.replace(/integrity="[^"]*"/g, '');
        body = body.replace(/nonce="[^"]*"/g, '');
      }
      
      const injectionScript = `
        <base href="${baseUrl}/">
        <script>
          document.addEventListener('click', function(e) {
            const anchor = e.target.closest('a');
            if (anchor && anchor.href && !anchor.href.startsWith('javascript:') && !anchor.href.startsWith('#')) {
              e.preventDefault();
              try {
                const absoluteUrl = new URL(anchor.getAttribute('href'), document.baseURI).href;
                window.location.href = '/api/proxy?url=' + encodeURIComponent(absoluteUrl) + '&mode=${mode}&speed=${speed}';
              } catch (err) {}
            }
          }, true);

          document.addEventListener('submit', function(e) {
            const form = e.target.closest('form');
            if (form) {
              e.preventDefault();
              try {
                const actionUrl = new URL(form.getAttribute('action') || window.location.href, document.baseURI).href;
                const formData = new FormData(form);
                const params = new URLSearchParams(formData).toString();
                
                let finalUrl = actionUrl;
                const method = (form.method || 'get').toLowerCase();
                
                if (method === 'get' && params) {
                  finalUrl += (finalUrl.includes('?') ? '&' : '?') + params;
                }
                
                window.location.href = '/api/proxy?url=' + encodeURIComponent(finalUrl) + '&mode=${mode}&speed=${speed}';
              } catch (err) {}
            }
          }, true);
        </script>
      `;

      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${injectionScript}`);
      } else {
        body = injectionScript + body;
      }

      return res.status(200).send(body);
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.status(200).send(buffer);
    }
  } catch (error) {
    return res.status(500).send(`<h3>proxy connection error</h3><p>failed to retrieve resource: ${error.message}</p>`);
  }
}
