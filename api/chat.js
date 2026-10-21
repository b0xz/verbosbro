let globalMessages = [
  { user: 'verbos-bot', text: 'Welcome to Verbo Chat!', pfp: '⭐', color: '#ffffff', time: '12:00 PM' }
];

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(globalMessages);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const { user, text, pfp, color } = body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const cleanUser = (user && typeof user === 'string' ? user.trim() : 'Anonymous').slice(0, 20);
    const cleanText = text.trim().slice(0, 400);
    const cleanPfp = (pfp && typeof pfp === 'string' ? pfp.trim() : '⭐').slice(0, 500);
    const cleanColor = color || '#ffffff';

    if (!cleanText) return res.status(400).json({ error: 'Empty message.' });

    const newMessage = {
      user: cleanUser,
      text: cleanText,
      pfp: cleanPfp,
      color: cleanColor,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    globalMessages.push(newMessage);
    if (globalMessages.length > 80) globalMessages.shift();

    return res.status(200).json({ success: true, message: newMessage });
  }

  return res.status(405).send('Method not allowed');
}
