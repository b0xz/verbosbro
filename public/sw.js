self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/service/')) {
    const encodedPart = url.pathname.replace('/service/', '');
    const targetUrl = decodeProxyPath(encodedPart);

    if (targetUrl) {
      const proxyApiUrl = `/api/proxy?token=${btoa(encodeURIComponent(targetUrl)).replace(/=/g, '')}`;
      event.respondWith(
        fetch(proxyApiUrl, {
          method: event.request.method,
          headers: event.request.headers,
          body: ['GET', 'HEAD'].includes(event.request.method) ? undefined : event.request.body,
          redirect: 'manual'
        }).catch(() => fetch(targetUrl))
      );
    }
  }
});

function decodeProxyPath(encoded) {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(atob(base64));
  } catch (e) {
    return null;
  }
}
