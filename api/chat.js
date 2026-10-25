let currentChatRoom = 'global';
let dmUsers = [];
let dmSentCounts = {}; // One-message limit until reply
let chatPoll = null;
let lastMessageTime = 0;
let lastKnownCount = 0;

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const userDashboardModal = document.getElementById('user-dashboard-modal');

document.querySelectorAll('.room-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentChatRoom = btn.getAttribute('data-room');
    document.getElementById('current-room-title').textContent = currentChatRoom.startsWith('general-') ? `# ${currentChatRoom}` : currentChatRoom === 'global' ? '# global-chat' : `dm: @${currentChatRoom}`;
    fetchChat(true);
  });
});

function createWavySpan(text) {
  const container = document.createElement('span');
  container.className = 'chat-msg-username';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.className = 'wavy-letter';
    span.textContent = text[i];
    span.style.animationDelay = `${i * 0.08}s`;
    container.appendChild(span);
  }
  return container;
}

window.initChat = function() {
  fetchChat(true);
  if (!chatPoll) chatPoll = setInterval(() => fetchChat(false), 2000);
};

async function fetchChat(forceScroll = false) {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    
    const myName = localStorage.getItem('satura_user_name');
    
    if (!currentChatRoom.startsWith('#') && currentChatRoom !== 'global') {
      const recipientHasReplied = data.some(m => m.user === currentChatRoom && m.recipient === myName);
      if (recipientHasReplied) {
        dmSentCounts[currentChatRoom] = 0;
      }
    }

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
        const msgFont = m.font || 'Inter, sans-serif';

        const itemEl = document.createElement('div');
        itemEl.className = 'chat-msg-item';

        const pfpDiv = document.createElement('div');
        pfpDiv.className = 'chat-msg-pfp';
        pfpDiv.innerHTML = pfpHTML;
        pfpDiv.onclick = () => openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'exploring the web with satura.');

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-msg-content';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'chat-msg-header';

        let userSpan;
        if (m.anim === 'wavy') {
          userSpan = createWavySpan(m.user);
        } else {
          userSpan = document.createElement('span');
          userSpan.className = 'chat-msg-username';
          userSpan.textContent = m.user;
        }
        userSpan.style.color = m.color || '#ffffff';
        userSpan.onclick = () => openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'exploring the web with satura.');

        const timeSpan = document.createElement('span');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = m.time;

        headerDiv.appendChild(userSpan);
        headerDiv.appendChild(timeSpan);

        const textDiv = document.createElement('div');
        textDiv.className = 'chat-msg-text';
        textDiv.style.fontFamily = msgFont;
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

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  if (!currentChatRoom.startsWith('general-') && currentChatRoom !== 'global') {
    const sentCount = dmSentCounts[currentChatRoom] || 0;
    if (sentCount >= 1) {
      alert("you can only send 1 message until they reply back!");
      return;
    }
  }

  const now = Date.now();
  if (now - lastMessageTime < 1000) return;
  lastMessageTime = now;

  const user = localStorage.getItem('satura_user_name');
  const pfp = localStorage.getItem('satura_user_pfp') || '⭐';
  const bio = localStorage.getItem('satura_user_bio') || 'exploring the web with satura.';
  const color = localStorage.getItem('satura_user_color') || '#ffffff';
  const font = localStorage.getItem('satura_chat_font') || 'Inter, sans-serif';
  const anim = localStorage.getItem('satura_username_anim') || 'none';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, text, pfp, bio, color, font, anim, recipient: currentChatRoom })
    });
    if (res.ok) { 
      chatInput.value = ''; 
      if (!currentChatRoom.startsWith('general-') && currentChatRoom !== 'global') {
        dmSentCounts[currentChatRoom] = (dmSentCounts[currentChatRoom] || 0) + 1;
      }
      fetchChat(true); 
    }
  } catch (e) {}
}

if (chatSend) chatSend.addEventListener('click', sendChat);
if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });

/* --- User Dashboard & White "Dm" Button --- */
const closeUserDashboardBtn = document.getElementById('close-user-dashboard');
if (closeUserDashboardBtn) {
  closeUserDashboardBtn.addEventListener('click', () => userDashboardModal.classList.add('hidden'));
}

let selectedDashboardUser = '';
window.openUserDashboard = function(username, pfp, bio) {
  selectedDashboardUser = username;
  document.getElementById('ud-username').textContent = username;
  document.getElementById('ud-bio').textContent = bio;

  const pfpContainer = document.getElementById('ud-pfp-container');
  const isImg = pfp && (pfp.startsWith('http') || pfp.startsWith('data:image'));
  if (isImg) {
    pfpContainer.innerHTML = `<img src="${pfp}" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    pfpContainer.textContent = pfp || username.charAt(0).toUpperCase();
  }

  userDashboardModal.classList.remove('hidden');
};

const udMessageBtn = document.getElementById('ud-message-btn');
if (udMessageBtn) {
  udMessageBtn.addEventListener('click', () => {
    if (!selectedDashboardUser) return;
    const myName = localStorage.getItem('satura_user_name');
    if (selectedDashboardUser === myName) {
      alert("you cannot message yourself!");
      return;
    }

    if (!dmUsers.includes(selectedDashboardUser)) {
      dmUsers.push(selectedDashboardUser);
      renderDmList();
    }

    userDashboardModal.classList.add('hidden');
    document.getElementById('sb-chat').click();
    setTimeout(() => {
      document.querySelector(`.room-btn[data-room="${selectedDashboardUser}"]`)?.click();
    }, 100);
  });
}

function renderDmList() {
  const container = document.getElementById('dm-rooms-list');
  if (!container) return;
  container.innerHTML = dmUsers.map(user => `
    <button class="room-btn ${currentChatRoom === user ? 'active' : ''}" data-room="${user}">@${user}</button>
  `).join('');

  container.querySelectorAll('.room-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChatRoom = btn.getAttribute('data-room');
      document.getElementById('current-room-title').textContent = `dm: @${currentChatRoom}`;
      fetchChat(true);
    });
  });
}

const addFriendBtn = document.getElementById('add-friend-btn');
if (addFriendBtn) {
  addFriendBtn.addEventListener('click', async () => {
    const friendName = prompt("enter username to start a direct message:");
    if (!friendName) return;
    const clean = friendName.trim();
    const myName = localStorage.getItem('satura_user_name');
    if (clean === myName) {
      alert("that's you!");
      return;
    }
    if (!dmUsers.includes(clean)) {
      dmUsers.push(clean);
      renderDmList();
    }
    document.querySelector(`.room-btn[data-room="${clean}"]`)?.click();
  });
}
