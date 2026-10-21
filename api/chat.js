let globalMessages = [
  { user: 'miksi-bot', text: 'Welcome.', color: '#ffffff', font: 'sans-serif', pfp: '⭐', time: '12:00 PM' }
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
    const { user, text, color, font, pfp } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const cleanUser = (user && typeof user === 'string' ? user.trim() : 'Anonymous').slice(0, 20);
    const cleanText = text.trim().slice(0, 400);
    const cleanColor = color || '#ffffff';
    const cleanFont = font || 'sans-serif';
    const cleanPfp = pfp || '⭐';

    if (!cleanText) return res.status(400).json({ error: 'Empty message.' });

    const newMessage = {
      user: cleanUser,
      text: cleanText,
      color: cleanColor,
      font: cleanFont,
      pfp: cleanPfp,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    globalMessages.push(newMessage);
    if (globalMessages.length > 70) globalMessages.shift();

    return res.status(200).json({ success: true, message: newMessage });
  }

  return res.status(405).send('Method not allowed');
}
