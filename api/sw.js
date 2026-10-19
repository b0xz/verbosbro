/* ===================================================
   MIKSI ULTRA-SCRAMJET SERVICE WORKER INTERCEPTOR
   =================================================== */

const PROXY_ROUTE = '/api/proxy';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip local requests, chrome-extension requests, or direct proxy routes
  if (url.pathname.startsWith(PROXY_ROUTE) || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(handleInterception(request));
});

async function handleInterception(request) {
  try {
    let targetUrl = request.url;

    // Fix potential duplicated proxy or malformed relative prefix bugs
    if (targetUrl.includes(PROXY_ROUTE + '?url=')) {
      return fetch(request);
    }

    const gatewayUrl = `${PROXY_ROUTE}?url=${encodeURIComponent(targetUrl)}`;

    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('X-Requested-With', 'MiksiEngine');

    const init = {
      method: request.method,
      headers: reqHeaders,
      credentials: 'include',
      redirect: 'follow'
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
      init.body = await request.blob();
    }

    const response = await fetch(gatewayUrl, init);
    
    const resHeaders = new Headers(response.headers);
    resHeaders.delete('content-security-policy');
    resHeaders.delete('x-frame-options');
    resHeaders.delete('cross-origin-opener-policy');
    resHeaders.delete('cross-origin-embedder-policy');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders
    });
  } catch (err) {
    return new Response(
      `<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:sans-serif;padding:40px;">
        <h2>Proxy Pipeline Exception</h2>
        <p>${err.message}</p>
        <p><em>ill fix this after school maybe</em></p>
      </body></html>`,
      { status: 500, headers: { 'content-type': 'text/html' } }
    );
  }
}
