import fetch from 'node-fetch';

export default async function handler(req, res) {
  const targetUrlStr = req.query.url;
  if (!targetUrlStr) {
    return res.status(400).send('Missing target URL');
  }

  let targetUrl;
  try {
    targetUrl = new URL(targetUrlStr);
  } catch (e) {
    return res.status(400).send('Invalid URL');
  }

  // Handle YouTube embed transformations for full video loading
  if (targetUrl.hostname.includes('youtube.com') && targetUrl.pathname === '/watch') {
    const videoId = targetUrl.searchParams.get('v');
    if (videoId) {
      targetUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&raw=1`);
    }
  }

  const userAgentMap = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    tablet: 'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    xbox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edge/44.18363.8131'
  };

  const headers = {
    'User-Agent': userAgentMap[req.query.device] || userAgentMap.desktop,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Forwarded-For': req.query.sim_ip || '192.168.1.102',
    'Referer': targetUrl.origin
  };

  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  try {
    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    
    // Forward status and media range headers
    res.status(response.status);
    if (response.headers.get('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range'));
    }
    if (response.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', response.headers.get('accept-ranges'));
    }
    res.setHeader('Content-Type', contentType);

    // If document is HTML, inject base URL to resolve nested relative assets
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const baseTag = `<base href="${targetUrl.href}">`;
      html = html.replace('<head>', `<head>${baseTag}`);
      return res.send(html);
    }

    // Stream video buffers and binary streams directly
    const buffer = await response.buffer();
    return res.send(buffer);

  } catch (err) {
    console.error('Proxy Error:', err);
    return res.status(500).send('Error fetching proxy content');
  }
}
