let globalMessages = [
  { 
    user: 'verbos-bot', 
    text: 'Welcome to Verbos Chat!', 
    pfp: '⭐', 
    bio: 'Official Verbos System Bot', 
    color: '#ffffff', 
    font: 'Arial, sans-serif',
    time: '12:00 PM' 
  }
];

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

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

      const { user, text, pfp, bio, color, font } = body || {};

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const cleanText = text.trim().slice(0, 400).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!cleanText) {
        return res.status(400).json({ error: 'Empty message.' });
      }

      const cleanUser = (user && typeof user === 'string' ? user.trim() : 'Anonymous')
        .slice(0, 20)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const cleanBio = (bio && typeof bio === 'string' ? bio.trim() : 'Exploring the web with Verbos.')
        .slice(0, 120)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Limit payload size to under 200KB to avoid memory crashes
      const cleanPfp = (pfp && typeof pfp === 'string' ? pfp.trim() : '⭐').slice(0, 200000);
      const cleanColor = (color && typeof color === 'string') ? color : '#ffffff';
      const cleanFont = (font && typeof font === 'string') ? font : 'Arial, sans-serif';

      const newMessage = {
        user: cleanUser,
        text: cleanText,
        pfp: cleanPfp,
        bio: cleanBio,
        color: cleanColor,
        font: cleanFont,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      globalMessages.push(newMessage);
      if (globalMessages.length > 80) {
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
