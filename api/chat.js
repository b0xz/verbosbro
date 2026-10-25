let globalMessages = [
  { 
    id: 'msg-1',
    user: 'satura-bot', 
    text: 'Welcome to Satura Chat!', 
    pfp: '⭐', 
    bio: 'Official Satura System Bot', 
    color: '#ffffff', 
    font: 'Inter, sans-serif',
    recipient: 'global',
    time: '12:00 PM' 
  }
];

let registeredUsers = new Set(['satura-bot']);

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      const type = req.query.type;
      if (type === 'users') {
        return res.status(200).json(Array.from(registeredUsers));
      }
      return res.status(200).json(globalMessages);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { user, text, pfp, bio, color, font, recipient } = body || {};

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const cleanUser = (user && typeof user === 'string' ? user.trim() : 'SaturaUser').slice(0, 20);
      registeredUsers.add(cleanUser);

      const cleanText = text.trim().slice(0, 500);
      if (!cleanText) {
        return res.status(400).json({ error: 'Empty message.' });
      }

      const cleanBio = (bio && typeof bio === 'string' ? bio.trim() : 'Exploring the web with Satura.').slice(0, 120);
      const cleanPfp = (pfp && typeof pfp === 'string' ? pfp.trim() : '⭐').slice(0, 200000);
      const cleanColor = (color && typeof color === 'string') ? color : '#ffffff';
      const cleanFont = (font && typeof font === 'string') ? font : 'Inter, sans-serif';
      const cleanRecipient = (recipient && typeof recipient === 'string') ? recipient.trim() : 'global';

      const newMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        user: cleanUser,
        text: cleanText,
        pfp: cleanPfp,
        bio: cleanBio,
        color: cleanColor,
        font: cleanFont,
        recipient: cleanRecipient,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      globalMessages.push(newMessage);
      if (globalMessages.length > 100) {
        globalMessages.shift();
      }

      return res.status(200).json({ success: true, message: newMessage });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error in api/chat.js:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
