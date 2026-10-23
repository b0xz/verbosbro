if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

// Auto-assign unique verbosuser-<random> on first load
if (!localStorage.getItem('verbos_user_name')) {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem('verbos_user_name', 'verbosuser-' + randNum);
  localStorage.setItem('verbos_user_bio', 'Exploring the web with Verbos.');
  localStorage.setItem('verbos_user_pfp', '⭐');
  localStorage.setItem('verbos_user_color', '#6366f1');
  localStorage.setItem('verbos_chat_font', 'Inter, sans-serif');
}

let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let currentChatRoom = 'global';
let dmUsers = [];

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const gamesPageView = document.getElementById('games-page-view');
const settingsPageView = document.getElementById('settings-page-view');
const bottomNavWrapper = document.getElementById('bottom-nav-wrapper');
const proxyIframe1 = document.getElementById('proxy-iframe-1');
const loadingSpinner = document.getElementById('loading-spinner');
const swipeOverlay = document.getElementById('swipe-overlay');

function showSpinner() { loadingSpinner.classList.remove('hidden'); }
function hideSpinner() { loadingSpinner.classList.add('hidden'); }

proxyIframe1.addEventListener('load', hideSpinner);

function renderTabs() {
  tabBar.querySelectorAll('.tab-item').forEach(el => el.remove());
  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    tabEl.innerHTML = `
      <span style="overflow:hidden; text-overflow:ellipsis;">${tab.title}</span>
      <button class="tab-close" onclick="event.stopPropagation(); closeTab(${tab.id})">×</button>
    `;
    tabEl.addEventListener('click', () => switchTab(tab.id));
    tabBar.insertBefore(tabEl, addTabBtn);
  });
}

function switchTab(id) {
  activeTabId = id;
  const tab = tabs.find(t => t.id === id);
  if (tab) {
    proxyInput.value = tab.url;
    hideAllPages();
    bottomNavWrapper.classList.remove('hidden');
    document.getElementById('sb-home').classList.add('active');

    if (tab.src === 'about:blank' || !tab.url) {
      proxyViewer.classList.remove('active');
      homeView.classList.remove('hidden');
      proxyIframe1.src = 'about:blank';
    } else {
      homeView.classList.add('hidden');
      proxyViewer.classList.add('active');
      proxyIframe1.src = tab.src;
    }
  }
  renderTabs();
}

function addTab(url = '', src = 'about:blank', title = 'New Tab') {
  const newId = Date.now();
  tabs.push({ id: newId, title, url, src });
  switchTab(newId);
}

window.closeTab = function(id) {
  if (tabs.length === 1) {
    tabs[0] = { id: Date.now(), title: 'New Tab', url: '', src: 'about:blank' };
    switchTab(tabs[0].id);
    return;
  }
  tabs = tabs.filter(t => t.id !== id);
  if (activeTabId === id) switchTab(tabs[tabs.length - 1].id);
  else renderTabs();
};

addTabBtn.addEventListener('click', () => addTab());

function hideAllPages() {
  homeView.classList.add('hidden');
  proxyViewer.classList.remove('active');
  chatPageView.classList.remove('active');
  gamesPageView.classList.remove('active');
  settingsPageView.classList.remove('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
}

/* --- Animated Swipe Transitions --- */
function triggerSwipeTransition(callback) {
  swipeOverlay.className = 'swipe-overlay animate-left';
  setTimeout(() => {
    callback();
    swipeOverlay.className = 'swipe-overlay animate-exit';
    setTimeout(() => {
      swipeOverlay.className = 'swipe-overlay';
    }, 400);
  }, 350);
}

document.getElementById('sb-home').addEventListener('click', () => {
  stopChatPolling();
  triggerSwipeTransition(() => {
    hideAllPages();
    bottomNavWrapper.classList.remove('hidden');
    homeView.classList.remove('hidden');
    document.getElementById('sb-home').classList.add('active');
  });
});

document.getElementById('sb-chat').addEventListener('click', () => {
  triggerSwipeTransition(() => {
    hideAllPages();
    chatPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-chat').classList.add('active');
    fetchChat(true);
    startChatPolling();
  });
});

document.getElementById('sb-games').addEventListener('click', () => {
  stopChatPolling();
  triggerSwipeTransition(() => {
    hideAllPages();
    gamesPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-games').classList.add('active');
  });
});

document.getElementById('sb-settings').addEventListener('click', () => {
  stopChatPolling();
  triggerSwipeTransition(() => {
    hideAllPages();
    settingsPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-settings').classList.add('active');
  });
});

// Panic Key (\)
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    document.body.style.display = document.body.style.display === 'none' ? 'block' : 'none';
  }
});

let currentMode = 'fast';
let currentDevice = 'desktop';
let currentVpn = 'us-east';

const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const currentModeLabel = document.getElementById('current-mode-label');

const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const currentDeviceLabel = document.getElementById('current-device-label');

const vpnToggleBtn = document.getElementById('vpn-toggle-btn');
const vpnMenu = document.getElementById('vpn-menu');
const currentVpnLabel = document.getElementById('current-vpn-label');

modeToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); deviceMenu.classList.remove('active'); vpnMenu.classList.remove('active'); modeMenu.classList.toggle('active'); });
deviceToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); modeMenu.classList.remove('active'); vpnMenu.classList.remove('active'); deviceMenu.classList.toggle('active'); });
vpnToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); modeMenu.classList.remove('active'); deviceMenu.classList.remove('active'); vpnMenu.classList.toggle('active'); });

document.addEventListener('click', () => { modeMenu.classList.remove('active'); deviceMenu.classList.remove('active'); vpnMenu.classList.remove('active'); });

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (!query.includes('.') || query.includes(' ')) return 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  stopChatPolling();
  showSpinner();
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}&device=${currentDevice}&vpn=${currentVpn}`;
  
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  proxyInput.value = targetUrl;
  hideAllPages();
  bottomNavWrapper.classList.remove('hidden');
  proxyViewer.classList.add('active');

  proxyIframe1.src = proxyUrl;
  renderTabs();
};

document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); } });

/* --- Rock-Solid Stable Chat System --- */
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
let chatPoll = null;
let lastMessageCount = 0;

function startChatPolling() {
  if (chatPoll) clearInterval(chatPoll);
  chatPoll = setInterval(() => fetchChat(false), 2000);
}

function stopChatPolling() {
  if (chatPoll) {
    clearInterval(chatPoll);
    chatPoll = null;
  }
}

document.querySelectorAll('.room-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentChatRoom = btn.getAttribute('data-room');
    document.getElementById('current-room-title').textContent = currentChatRoom === 'global' ? '# global-chat' : `DM: @${currentChatRoom}`;
    lastMessageCount = 0; // Reset cache count for room switch
    fetchChat(true);
  });
});

async function fetchChat(forceScroll = false) {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    
    const filteredData = data.filter(m => {
      if (currentChatRoom === 'global') return m.recipient === 'global' || !m.recipient;
      return (m.recipient === currentChatRoom && m.user === localStorage.getItem('verbos_user_name')) ||
             (m.user === currentChatRoom && m.recipient === localStorage.getItem('verbos_user_name'));
    });

    if (filteredData.length !== lastMessageCount || forceScroll) {
      lastMessageCount = filteredData.length;

      chatMessages.innerHTML = '';
      if (filteredData.length === 0) {
        chatMessages.innerHTML = `<div style="text-align:center; color:var(--subtext); margin-top:auto; margin-bottom:auto;">No messages in this chat yet. Say hello! 👋</div>`;
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
        pfpDiv.onclick = () => openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'Exploring the web with Verbos.');

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-msg-content';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'chat-msg-header';

        const userSpan = document.createElement('span');
        userSpan.className = 'chat-msg-username';
        userSpan.style.color = m.color || '#ffffff';
        userSpan.textContent = m.user;
        userSpan.onclick = () => openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'Exploring the web with Verbos.');

        const timeSpan = document.createElement('span');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = m.time;

        headerDiv.appendChild(userSpan);
        headerDiv.appendChild(timeSpan);

        const textDiv = document.createElement('div');
        textDiv.className = 'chat-msg-text';
        textDiv.style.fontFamily = msgFont;
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

  const user = localStorage.getItem('verbos_user_name');
  const pfp = localStorage.getItem('verbos_user_pfp') || '⭐';
  const bio = localStorage.getItem('verbos_user_bio') || 'Exploring the web with Verbos.';
  const color = localStorage.getItem('verbos_user_color') || '#6366f1';
  const font = localStorage.getItem('verbos_chat_font') || 'Inter, sans-serif';

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

chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });

/* --- User Dashboard Modal & DMs --- */
const userDashboardModal = document.getElementById('user-dashboard-modal');
document.getElementById('close-user-dashboard').addEventListener('click', () => userDashboardModal.classList.add('hidden'));

let selectedDashboardUser = '';
window.openUserDashboard = function(username, pfp, bio) {
  selectedDashboardUser = username;
  document.getElementById('ud-username').textContent = username;
  document.getElementById('ud-bio').textContent = bio;

  const pfpContainer = document.getElementById('ud-pfp-container');
  const isImg = pfp && (pfp.startsWith('http') || pfp.startsWith('data:image'));
  if (isImg) {
    pfpContainer.innerHTML = `<img src="${pfp}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    pfpContainer.textContent = pfp || username.charAt(0).toUpperCase();
  }

  userDashboardModal.classList.remove('hidden');
};

document.getElementById('ud-message-btn').addEventListener('click', () => {
  if (!selectedDashboardUser) return;
  const myName = localStorage.getItem('verbos_user_name');
  if (selectedDashboardUser === myName) {
    alert("You cannot message yourself!");
    return;
  }

  if (!dmUsers.includes(selectedDashboardUser)) {
    dmUsers.push(selectedDashboardUser);
    renderDmList();
  }

  userDashboardModal.classList.add('hidden');
  document.querySelector(`.room-btn[data-room="${selectedDashboardUser}"]`)?.click();
});

function renderDmList() {
  const container = document.getElementById('dm-rooms-list');
  container.innerHTML = dmUsers.map(user => `
    <button class="room-btn ${currentChatRoom === user ? 'active' : ''}" data-room="${user}"><span>@${user}</span></button>
  `).join('');

  container.querySelectorAll('.room-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChatRoom = btn.getAttribute('data-room');
      document.getElementById('current-room-title').textContent = `DM: @${currentChatRoom}`;
      lastMessageCount = 0;
      fetchChat(true);
    });
  });
}

document.getElementById('add-friend-btn').addEventListener('click', async () => {
  const friendName = prompt("Enter username to start a Direct Message:");
  if (!friendName) return;
  const clean = friendName.trim();
  const myName = localStorage.getItem('verbos_user_name');
  if (clean === myName) {
    alert("That's you!");
    return;
  }
  if (!dmUsers.includes(clean)) {
    dmUsers.push(clean);
    renderDmList();
  }
  document.querySelector(`.room-btn[data-room="${clean}"]`)?.click();
});

/* --- Themes & Customization --- */
const DARK_THEMES = {
  obsidian: { bg: '#070709', panel: '#111116', border: '#24242c', accent: '#6366f1', hover: '#1b1b22' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', accent: '#ef4444', hover: '#2f0c11' },
  emerald: { bg: '#02120d', panel: '#082119', border: '#133a2d', accent: '#10b981', hover: '#0f3327' },
  amethyst: { bg: '#0b0614', panel: '#150c26', border: '#2d1b4d', accent: '#8b5cf6', hover: '#22133d' },
  amber: { bg: '#120c02', panel: '#211808', border: '#3d2b12', accent: '#f59e0b', hover: '#2f210e' },
  ghost: { bg: '#090a0f', panel: '#13151c', border: '#2a2e3d', accent: '#94a3b8', hover: '#1c1f2b' }
};

function applyTheme(key) {
  const t = DARK_THEMES[key] || DARK_THEMES.obsidian;
  const root = document.documentElement;
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--panel', t.panel);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--hover', t.hover);
  localStorage.setItem('verbos_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('verbos_theme') || 'obsidian');

const bgSelect = document.getElementById('bg-style-select');
bgSelect.value = localStorage.getItem('verbos_bg_style') || 'stars';
bgSelect.addEventListener('change', () => {
  localStorage.setItem('verbos_bg_style', bgSelect.value);
  initBackground(bgSelect.value);
});

const searchSelect = document.getElementById('search-style-select');
const searchContainer = document.getElementById('search-pill-container');
searchSelect.value = localStorage.getItem('verbos_search_style') || 'pill';
function applySearchStyle(style) {
  searchContainer.className = 'bottom-nav-pill style-' + style;
}
searchSelect.addEventListener('change', () => {
  localStorage.setItem('verbos_search_style', searchSelect.value);
  applySearchStyle(searchSelect.value);
});
applySearchStyle(localStorage.getItem('verbos_search_style') || 'pill');

/* --- Modals Handling --- */
const profileModal = document.getElementById('profile-modal');
const bookmarksModal = document.getElementById('bookmarks-modal');

document.getElementById('sb-bookmarks').addEventListener('click', () => bookmarksModal.classList.remove('hidden'));
document.getElementById('close-bookmarks').addEventListener('click', () => bookmarksModal.classList.add('hidden'));

document.getElementById('sb-profile').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

// Profile Logic
const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');
const profileFileInput = document.getElementById('profile-file-input');
const profileFontSelect = document.getElementById('profile-font');
const profileColorInput = document.getElementById('profile-color');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const name = localStorage.getItem('verbos_user_name');
  const bio = localStorage.getItem('verbos_user_bio');
  const pfp = localStorage.getItem('verbos_user_pfp');
  const font = localStorage.getItem('verbos_chat_font');
  const color = localStorage.getItem('verbos_user_color');

  profileNameInput.value = name;
  profileBioInput.value = bio;
  if (!pfp.startsWith('data:')) profilePfpInput.value = pfp;
  profileFontSelect.value = font;
  profileColorInput.value = color;

  if (pfp && (pfp.startsWith('http') || pfp.startsWith('data:'))) {
    pfpImg.src = pfp;
    pfpImg.classList.remove('hidden');
    pfpInitial.classList.add('hidden');
  } else {
    pfpInitial.textContent = name.charAt(0).toUpperCase();
    pfpImg.classList.add('hidden');
    pfpInitial.classList.remove('hidden');
  }
}

profileFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 200 * 1024) {
      alert("Image is too large! Please choose an image smaller than 200KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
      profilePfpInput.value = uploadEvent.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('save-profile').addEventListener('click', async () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    alert("Display name cannot be empty!");
    return;
  }
  
  try {
    const res = await fetch('/api/chat?type=users');
    if (res.ok) {
      const users = await res.json();
      const currentStoredName = localStorage.getItem('verbos_user_name');
      if (users.includes(name) && name !== currentStoredName) {
        alert("This display name is already taken! Please choose another.");
        return;
      }
    }
  } catch (e) {}

  const bio = profileBioInput.value.trim() || 'Exploring the web with Verbos.';
  const pfp = profilePfpInput.value.trim() || '⭐';
  const font = profileFontSelect.value;
  const color = profileColorInput.value;

  localStorage.setItem('verbos_user_name', name);
  localStorage.setItem('verbos_user_bio', bio);
  localStorage.setItem('verbos_user_pfp', pfp);
  localStorage.setItem('verbos_chat_font', font);
  localStorage.setItem('verbos_user_color', color);

  loadProfile();
  profileModal.classList.add('hidden');
});
loadProfile();

/* --- Dynamic Background --- */
const bgCanvas = document.getElementById('bg-stars');
const bgCtx = bgCanvas.getContext('2d');
let animationFrameId = null;

function initBackground(style) {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;

  if (style === 'matrix') {
    const letters = 'VERBOS010101XYZ';
    const fontSize = 14;
    const columns = Math.floor(bgCanvas.width / fontSize);
    const drops = Array(columns).fill(1);

    function drawMatrix() {
      bgCtx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.fillStyle = '#ffffff';
      bgCtx.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = letters.charAt(Math.floor(Math.random() * letters.length));
        bgCtx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > bgCanvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(drawMatrix);
    }
    drawMatrix();
  } else if (style === 'void') {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  } else {
    let stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, size: Math.random() * 2.5 + 0.8, speed: Math.random() * 0.3 + 0.05, rot: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.02 });
    }
    function drawStars() {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.fillStyle = '#ffffff';
      stars.forEach(s => {
        s.x += s.speed; s.rot += s.rotSpeed;
        if (s.x > bgCanvas.width) s.x = 0;
        bgCtx.save(); bgCtx.translate(s.x, s.y); bgCtx.rotate(s.rot);
        bgCtx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
        bgCtx.restore();
      });
      animationFrameId = requestAnimationFrame(drawStars);
    }
    drawStars();
  }
}
initBackground(localStorage.getItem('verbos_bg_style') || 'stars');

// Star Logo
const starCanvas = document.getElementById('star-canvas');
const starCtx = starCanvas.getContext('2d');
let angle = 0, floatTime = 0;
function drawStarLogo() {
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.save();
  floatTime += 0.01;
  starCtx.translate(starCanvas.width / 2 + Math.sin(floatTime) * 5, starCanvas.height / 2 + Math.cos(floatTime * 0.8) * 5);
  starCtx.rotate(angle);
  starCtx.fillStyle = '#ffffff';
  starCtx.beginPath();
  for (let i = 0; i < 4; i++) { starCtx.lineTo(0, -95); starCtx.rotate(Math.PI / 4); starCtx.lineTo(0, -38); starCtx.rotate(Math.PI / 4); }
  starCtx.closePath(); starCtx.fill();
  starCtx.restore();
  angle += 0.0015;
  requestAnimationFrame(drawStarLogo);
}
drawStarLogo();
renderTabs();
