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

let usersDb = {
  'satura-bot': {
    bio: 'Official Satura System Bot',
    pfp: '⭐',
    lastSeen: Date.now()
  }
};

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
      const now = Date.now();

      if (type === 'users_status') {
        const registered = Object.keys(usersDb).map(username => {
          const user = usersDb[username];
          const isOnline = (now - user.lastSeen) < 12000;
          return {
            username,
            bio: user.bio,
            pfp: user.pfp,
            isOnline,
            lastSeenFormatted: isOnline ? 'Online now' : new Date(user.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        });
        return res.status(200).json(registered);
      }

      return res.status(200).json(globalMessages);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { type, user, text, pfp, bio, color, font, anim, recipient } = body || {};
      const cleanUser = (user && typeof user === 'string' ? user.trim() : 'SaturaUser').slice(0, 20);

      if (type === 'heartbeat') {
        if (!usersDb[cleanUser]) {
          usersDb[cleanUser] = { 
            bio: (bio && typeof bio === 'string' ? bio.trim() : 'Exploring the web with Satura.').slice(0, 120), 
            pfp: (pfp && typeof pfp === 'string' ? pfp.trim() : '⭐').slice(0, 200000), 
            lastSeen: Date.now() 
          };
        } else {
          usersDb[cleanUser].lastSeen = Date.now();
        }
        return res.status(200).json({ success: true });
      }

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const cleanText = text.trim().slice(0, 500);
      if (!cleanText) {
        return res.status(400).json({ error: 'Empty message.' });
      }

      usersDb[cleanUser] = {
        bio: (bio && typeof bio === 'string' ? bio.trim() : 'Exploring the web with Satura.').slice(0, 120),
        pfp: (pfp && typeof pfp === 'string' ? pfp.trim() : '⭐').slice(0, 200000),
        lastSeen: Date.now()
      };

      const newMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        user: cleanUser,
        text: cleanText,
        pfp: usersDb[cleanUser].pfp,
        bio: usersDb[cleanUser].bio,
        color: (color && typeof color === 'string') ? color : '#ffffff',
        font: (font && typeof font === 'string') ? font : 'Inter, sans-serif',
        anim: (anim && typeof anim === 'string') ? anim : 'none',
        recipient: (recipient && typeof recipient === 'string') ? recipient.trim() : 'global',
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
