let globalMessages = [
  { user: 'miksi-bot', text: 'Welcome to the global chat! Say hi.', time: new Date().toLocaleTimeString() }
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
    const { user, text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const cleanUser = (user && typeof user === 'string' ? user.trim() : 'Anonymous').slice(0, 20);
    const cleanText = text.trim().slice(0, 300);

    if (!cleanText) return res.status(400).json({ error: 'Empty message.' });

    const newMessage = {
      user: cleanUser,
      text: cleanText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    globalMessages.push(newMessage);
    if (globalMessages.length > 50) globalMessages.shift();

    return res.status(200).json({ success: true, message: newMessage });
  }

  return res.status(405).send('Method not allowed');
}
