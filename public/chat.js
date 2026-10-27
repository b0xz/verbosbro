let currentChatRoom = 'global';
let dmUsers = [];
let chatPoll = null;
let heartbeatInterval = null;
let lastMessageTime = 0;
let lastKnownCount = 0;

window.initChat = function() {
  initRoomButtons();
  bindModalActions();
  fetchChat(true);
  fetchUserStatuses();

  if (!chatPoll) {
    chatPoll = setInterval(() => {
      fetchChat(false);
      fetchUserStatuses();
    }, 2000);
  }

  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(sendHeartbeat, 5000);
  }
};

function bindModalActions() {
  const closeDashboardBtn = document.getElementById('close-user-dashboard');
  if (closeDashboardBtn) {
    closeDashboardBtn.onclick = () => {
      document.getElementById('user-dashboard-modal').classList.add('hidden');
    };
  }

  const udMessageBtn = document.getElementById('ud-message-btn');
  if (udMessageBtn) {
    udMessageBtn.onclick = () => {
      if (!window.selectedDashboardUser) return;
      const myName = localStorage.getItem('celest_user_name');
      if (window.selectedDashboardUser === myName) {
        alert("you cannot DM yourself!");
        return;
      }

      if (!dmUsers.includes(window.selectedDashboardUser)) {
        dmUsers.push(window.selectedDashboardUser);
        renderDmList();
      }

      document.getElementById('user-dashboard-modal').classList.add('hidden');
      document.getElementById('sb-chat').click();
      setTimeout(() => {
        document.querySelector(`.room-btn[data-room="${window.selectedDashboardUser}"]`)?.click();
      }, 100);
    };
  }
}

async function sendHeartbeat() {
  const user = localStorage.getItem('celest_user_name') || 'celestuser-1000';
  const bio = localStorage.getItem('celest_user_bio') || 'exploring the web with celest.';
  const pfp = localStorage.getItem('celest_user_pfp') || '⭐';

  try {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'heartbeat', user, bio, pfp })
    });
  } catch (e) {}
}

function initRoomButtons() {
  document.querySelectorAll('.room-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChatRoom = btn.getAttribute('data-room');
      const titleEl = document.getElementById('current-room-title');
      if (titleEl) {
        titleEl.textContent = currentChatRoom.startsWith('general-') ? `# ${currentChatRoom}` : currentChatRoom === 'global' ? '# global-chat' : `dm: @${currentChatRoom}`;
      }
      fetchChat(true);
    };
  });
}

function renderDmList() {
  const container = document.getElementById('dm-rooms-list');
  if (!container) return;
  container.innerHTML = dmUsers.map(user => `
    <button class="room-btn ${currentChatRoom === user ? 'active' : ''}" data-room="${user}">@${user}</button>
  `).join('');

  initRoomButtons();
}

async function fetchChat(forceScroll = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    const myName = localStorage.getItem('celest_user_name');

    const filteredData = data.filter(m => {
      if (currentChatRoom === 'global') return m.recipient === 'global' || !m.recipient;
      if (currentChatRoom.startsWith('general-')) return m.recipient === currentChatRoom;
      return (m.recipient === currentChatRoom && m.user === myName) ||
             (m.user === currentChatRoom && m.recipient === myName);
    });

    if (filteredData.length !== lastKnownCount || forceScroll) {
      lastKnownCount = filteredData.length;
      chatMessages.innerHTML = '';

      if (filteredData.length === 0) {
        chatMessages.innerHTML = `<div style="text-align:center; color:var(--subtext); margin-top:40px; text-transform:lowercase;">no messages here yet. say something!</div>`;
        return;
      }

      filteredData.forEach(m => {
        const isImg = m.pfp && (m.pfp.startsWith('http') || m.pfp.startsWith('data:image'));
        const pfpHTML = isImg ? `<img src="${m.pfp}" alt="pfp" />` : (m.pfp || '⭐');

        const itemEl = document.createElement('div');
        itemEl.className = 'chat-msg-item';

        const pfpDiv = document.createElement('div');
        pfpDiv.className = 'chat-msg-pfp';
        pfpDiv.innerHTML = pfpHTML;
        pfpDiv.onclick = () => window.openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'exploring the web with celest.');

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-msg-content';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'chat-msg-header';

        const userSpan = document.createElement('span');
        userSpan.className = 'chat-msg-username';
        userSpan.textContent = m.user;
        userSpan.style.color = m.color || '#ffffff';
        userSpan.onclick = () => window.openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'exploring the web with celest.');

        const timeSpan = document.createElement('span');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = m.time;

        headerDiv.appendChild(userSpan);
        headerDiv.appendChild(timeSpan);

        const textDiv = document.createElement('div');
        textDiv.className = 'chat-msg-text';
        textDiv.style.fontFamily = m.font || 'Share Tech Mono, monospace';
        textDiv.style.whiteSpace = 'pre-wrap';
        textDiv.textContent = m.text;

        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(textDiv);
        itemEl.appendChild(pfpDiv);
        itemEl.appendChild(contentDiv);

        chatMessages.appendChild(itemEl);
      });

      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (e) {}
}

async function fetchUserStatuses() {
  const onlineListContainer = document.getElementById('online-users-list');
  const registeredListContainer = document.getElementById('registered-users-list');
  if (!onlineListContainer || !registeredListContainer) return;

  try {
    const res = await fetch('/api/chat?type=users_status');
    if (!res.ok) return;
    const users = await res.json();

    onlineListContainer.innerHTML = '';
    registeredListContainer.innerHTML = '';

    users.forEach(u => {
      const userEl = document.createElement('div');
      userEl.className = 'user-status-card';
      userEl.onclick = () => window.openUserDashboard(u.username, u.pfp, u.bio, u.lastSeenFormatted);
      
      userEl.innerHTML = `
        <span class="status-indicator ${u.isOnline ? 'online' : 'offline'}"></span>
        <span style="font-weight:600; font-size:0.85rem;">${u.username}</span>
      `;

      if (u.isOnline) {
        onlineListContainer.appendChild(userEl);
      } else {
        registeredListContainer.appendChild(userEl.cloneNode(true));
      }
    });
  } catch (e) {}
}

async function sendChat() {
  const chatInput = document.getElementById('chat-input');
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  const now = Date.now();
  if (now - lastMessageTime < 1000) return;
  lastMessageTime = now;

  const user = localStorage.getItem('celest_user_name') || 'celestuser-1000';
  const pfp = localStorage.getItem('celest_user_pfp') || '⭐';
  const bio = localStorage.getItem('celest_user_bio') || 'exploring the web with celest.';
  const color = localStorage.getItem('celest_user_color') || '#ffffff';
  const font = localStorage.getItem('celest_chat_font') || 'Share Tech Mono, monospace';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, text, pfp, bio, color, font, recipient: currentChatRoom })
    });

    if (res.ok) { 
      chatInput.value = ''; 
      fetchChat(true); 
    }
  } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
  initRoomButtons();
  bindModalActions();

  const chatSend = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');

  if (chatSend) chatSend.onclick = sendChat;
  if (chatInput) {
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendChat();
      }
    };
  }
});

window.openUserDashboard = function(username, pfp, bio, lastOnlineText = 'Online now') {
  window.selectedDashboardUser = username;
  document.getElementById('ud-username').textContent = username;
  document.getElementById('ud-bio').textContent = bio;
  
  const lastOnlineEl = document.getElementById('ud-last-online');
  if (lastOnlineEl) {
    lastOnlineEl.textContent = `last online: ${lastOnlineText}`;
  }

  const pfpContainer = document.getElementById('ud-pfp-container');
  const isImg = pfp && (pfp.startsWith('http') || pfp.startsWith('data:image'));
  if (isImg) {
    pfpContainer.innerHTML = `<img src="${pfp}" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    pfpContainer.textContent = pfp || username.charAt(0).toUpperCase();
  }

  document.getElementById('user-dashboard-modal').classList.remove('hidden');
};
