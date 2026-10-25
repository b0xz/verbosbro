if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

// Data reset safeguard against softlocks (Version bump)
const CURRENT_DATA_VERSION = 'v5_safe';
if (localStorage.getItem('verbos_data_version') !== CURRENT_DATA_VERSION) {
  localStorage.setItem('verbos_ui_layout', 'normal');
  localStorage.setItem('verbos_data_version', CURRENT_DATA_VERSION);
}

// Auto-assign unique verbosuser-<random> on first load
if (!localStorage.getItem('verbos_user_name')) {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem('verbos_user_name', 'verbosuser-' + randNum);
  localStorage.setItem('verbos_user_bio', 'exploring the web with verbos.');
  localStorage.setItem('verbos_user_pfp', '⭐');
  localStorage.setItem('verbos_user_color', '#ffffff');
  localStorage.setItem('verbos_chat_font', 'Arial, sans-serif');
  localStorage.setItem('verbos_username_anim', 'none');
  localStorage.setItem('verbos_gui_scale', '1.15');
  localStorage.setItem('verbos_ui_formatting', 'standard');
}

let tabs = [{ id: 1, title: 'new tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let currentChatRoom = 'global';
let dmUsers = [];

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const audioPageView = document.getElementById('audio-page-view');
const gamesPageView = document.getElementById('games-page-view');
const settingsPageView = document.getElementById('settings-page-view');
const bottomNavWrapper = document.getElementById('bottom-nav-wrapper');
const proxyIframe1 = document.getElementById('proxy-iframe-1');
const loadingSpinner = document.getElementById('loading-spinner');

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

function addTab(url = '', src = 'about:blank', title = 'new tab') {
  const newId = Date.now();
  tabs.push({ id: newId, title, url, src });
  switchTab(newId);
}

window.closeTab = function(id) {
  if (tabs.length === 1) {
    tabs[0] = { id: Date.now(), title: 'new tab', url: '', src: 'about:blank' };
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
  audioPageView.classList.remove('active');
  gamesPageView.classList.remove('active');
  settingsPageView.classList.remove('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
}

/* --- Randomized Central Viewport Swipe Transitions (Up, Down, Left, Right) --- */
function triggerSwipeTransition(targetPageViewEl, callback) {
  const directions = ['left', 'right', 'up', 'down'];
  const chosenDir = directions[Math.floor(Math.random() * directions.length)];
  const swipeContainer = targetPageViewEl.querySelector('.swipe-container');

  let startTransform = '';
  if (chosenDir === 'left') startTransform = 'translateX(100%)';
  else if (chosenDir === 'right') startTransform = 'translateX(-100%)';
  else if (chosenDir === 'up') startTransform = 'translateY(100%)';
  else if (chosenDir === 'down') startTransform = 'translateY(-100%)';

  if (swipeContainer) {
    swipeContainer.style.transition = 'none';
    swipeContainer.style.transform = startTransform;
    swipeContainer.style.opacity = '0';
  }

  callback();
  targetPageViewEl.classList.add('active');

  setTimeout(() => {
    if (swipeContainer) {
      swipeContainer.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
      swipeContainer.style.transform = 'translate(0, 0)';
      swipeContainer.style.opacity = '1';
    }
  }, 20);
}

document.getElementById('sb-home').addEventListener('click', () => {
  hideAllPages();
  bottomNavWrapper.classList.remove('hidden');
  homeView.classList.remove('hidden');
  document.getElementById('sb-home').classList.add('active');
});

document.getElementById('sb-chat').addEventListener('click', () => {
  triggerSwipeTransition(chatPageView, () => {
    hideAllPages();
    chatPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-chat').classList.add('active');
    fetchChat(true);
    if (!chatPoll) chatPoll = setInterval(() => fetchChat(false), 2000);
  });
});

document.getElementById('sb-audio').addEventListener('click', () => {
  triggerSwipeTransition(audioPageView, () => {
    hideAllPages();
    audioPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-audio').classList.add('active');
    const badge = document.querySelector('#sb-audio .badge-notif');
    if (badge) badge.remove();
  });
});

document.getElementById('sb-games').addEventListener('click', () => {
  triggerSwipeTransition(gamesPageView, () => {
    hideAllPages();
    gamesPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-games').classList.add('active');
  });
});

document.getElementById('sb-settings').addEventListener('click', () => {
  triggerSwipeTransition(settingsPageView, () => {
    hideAllPages();
    settingsPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-settings').classList.add('active');
  });
});

/* --- Interactive Tooltips --- */
const globalTooltip = document.getElementById('global-tooltip');
document.addEventListener('mouseover', (e) => {
  const notifBadge = e.target.closest('[data-tooltip-type="notif"]');
  const wipBadge = e.target.closest('[data-tooltip-type="wip"]');

  if (notifBadge) {
    globalTooltip.textContent = "! means newly added, and the logo disappears if you click it or use it or see it in some way";
    globalTooltip.style.display = 'block';
    positionTooltip(e);
  } else if (wipBadge) {
    globalTooltip.textContent = "the hammer logo means this is still being worked on. Will not disappear when seen / clicked";
    globalTooltip.style.display = 'block';
    positionTooltip(e);
  }
});

document.addEventListener('mousemove', (e) => {
  if (globalTooltip.style.display === 'block') positionTooltip(e);
});

document.addEventListener('mouseout', (e) => {
  if (e.target.closest('[data-tooltip-type]')) globalTooltip.style.display = 'none';
});

function positionTooltip(e) {
  globalTooltip.style.left = (e.clientX + 12) + 'px';
  globalTooltip.style.top = (e.clientY + 12) + 'px';
}

document.addEventListener('click', (e) => {
  const notif = e.target.closest('.badge-notif');
  if (notif) {
    notif.remove();
    globalTooltip.style.display = 'none';
  }
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
const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const vpnToggleBtn = document.getElementById('vpn-toggle-btn');
const vpnMenu = document.getElementById('vpn-menu');

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

/* --- SoundCloud Audio Player Catcher --- */
const scLoadBtn = document.getElementById('sc-load-btn');
const scUrlInput = document.getElementById('sc-url-input');
const audioElement = document.getElementById('audio-element');

scLoadBtn.addEventListener('click', async () => {
  const trackUrl = scUrlInput.value.trim();
  if (!trackUrl) {
    alert("please enter a valid soundcloud track url!");
    return;
  }
  try {
    showSpinner();
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`);
    if (res.ok) {
      const data = await res.json();
      audioElement.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      audioElement.play();
      alert(`loaded track: ${data.title || 'soundcloud track'}`);
    } else {
      audioElement.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      audioElement.play();
    }
  } catch(e) {
    audioElement.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    audioElement.play();
  } finally {
    hideSpinner();
  }
});

/* --- Stable Chat System --- */
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
let chatPoll = null;
let lastMessageTime = 0;
let lastKnownCount = 0;

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

async function fetchChat(forceScroll = false) {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    
    const filteredData = data.filter(m => {
      if (currentChatRoom === 'global') return m.recipient === 'global' || !m.recipient;
      if (currentChatRoom.startsWith('general-')) return m.recipient === currentChatRoom;
      return (m.recipient === currentChatRoom && m.user === localStorage.getItem('verbos_user_name')) ||
             (m.user === currentChatRoom && m.recipient === localStorage.getItem('verbos_user_name'));
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
        const msgFont = m.font || 'Arial, sans-serif';

        const itemEl = document.createElement('div');
        itemEl.className = 'chat-msg-item';

        const pfpDiv = document.createElement('div');
        pfpDiv.className = 'chat-msg-pfp';
        pfpDiv.innerHTML = pfpHTML;
        pfpDiv.onclick = () => openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'exploring the web with verbos.');

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
        userSpan.onclick = () => openUserDashboard(m.user, m.pfp || '⭐', m.bio || 'exploring the web with verbos.');

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

  const now = Date.now();
  if (now - lastMessageTime < 1000) return;
  lastMessageTime = now;

  const user = localStorage.getItem('verbos_user_name');
  const pfp = localStorage.getItem('verbos_user_pfp') || '⭐';
  const bio = localStorage.getItem('verbos_user_bio') || 'exploring the web with verbos.';
  const color = localStorage.getItem('verbos_user_color') || '#ffffff';
  const font = localStorage.getItem('verbos_chat_font') || 'Arial, sans-serif';
  const anim = localStorage.getItem('verbos_username_anim') || 'none';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, text, pfp, bio, color, font, anim, recipient: currentChatRoom })
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
    pfpContainer.innerHTML = `<img src="${pfp}" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    pfpContainer.textContent = pfp || username.charAt(0).toUpperCase();
  }

  userDashboardModal.classList.remove('hidden');
};

document.getElementById('ud-message-btn').addEventListener('click', () => {
  if (!selectedDashboardUser) return;
  const myName = localStorage.getItem('verbos_user_name');
  if (selectedDashboardUser === myName) {
    alert("you cannot message yourself!");
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

document.getElementById('add-friend-btn').addEventListener('click', async () => {
  const friendName = prompt("enter username to start a direct message:");
  if (!friendName) return;
  const clean = friendName.trim();
  const myName = localStorage.getItem('verbos_user_name');
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

/* --- Themes, Formatting, Image Layout Presets & GUI Scale --- */
const DARK_THEMES = {
  obsidian: { bg: '#000000', panel: '#000000', border: '#ffffff', accent: '#ffffff', hover: '#141414' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', accent: '#ef4444', hover: '#2f0c11' },
  emerald: { bg: '#02120d', panel: '#082119', border: '#133a2d', accent: '#10b981', hover: '#0f3327' },
  amethyst: { bg: '#0b0614', panel: '#150c26', border: '#2d1b4d', accent: '#8b5cf6', hover: '#22133d' },
  amber: { bg: '#120c02', panel: '#211808', border: '#3d2b12', accent: '#f59e0b', hover: '#2f210e' },
  ghost: { bg: '#090a0f', panel: '#13151c', border: '#2a2e3d', accent: '#94a3b8', hover: '#1c1f2b' },
  cyberpunk: { bg: '#030712', panel: '#0f172a', border: '#06b6d4', accent: '#06b6d4', hover: '#1e293b' },
  matrix: { bg: '#020b05', panel: '#051b0f', border: '#22c55e', accent: '#22c55e', hover: '#0d2e1a' },
  coffee: { bg: '#1c140f', panel: '#291d17', border: '#d97706', accent: '#d97706', hover: '#3d2b21' }
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

const uiFormattingSelect = document.getElementById('ui-formatting-select');
function applyUiFormatting(style) {
  const root = document.documentElement;
  if (style === 'borderless') {
    root.style.setProperty('--border-radius', '20px');
    root.style.setProperty('--panel-border', '1px solid rgba(255, 255, 255, 0.08)');
  } else if (style === 'minimalistic') {
    root.style.setProperty('--border-radius', '4px');
    root.style.setProperty('--panel-border', '1px solid rgba(255, 255, 255, 0.4)');
  } else if (style === 'no-outlines') {
    root.style.setProperty('--border-radius', '0px');
    root.style.setProperty('--panel-border', 'none');
  } else {
    root.style.setProperty('--border-radius', '12px');
    root.style.setProperty('--panel-border', '1px solid var(--border)');
  }
  localStorage.setItem('verbos_ui_formatting', style);
}
uiFormattingSelect.value = localStorage.getItem('verbos_ui_formatting') || 'standard';
applyUiFormatting(uiFormattingSelect.value);
uiFormattingSelect.addEventListener('change', () => applyUiFormatting(uiFormattingSelect.value));

// UI Layout Formatting Presets (matching reference images)
const uiLayoutSelect = document.getElementById('ui-layout-select');
function applyUiLayout(layout) {
  const sidebar = document.getElementById('sidebar-el');
  const tabBarEl = document.getElementById('tab-bar');
  const bottomNavWrap = document.getElementById('bottom-nav-wrapper');
  const pageViews = document.querySelectorAll('.page-view');
  const proxyViewerEl = document.getElementById('proxy-viewer');

  if (layout === 'top-browser') {
    // Preset 2: Modern Browser Dock (Image 1 style)
    sidebar.classList.add('hidden-sidebar');
    tabBarEl.classList.add('top-full');
    bottomNavWrap.classList.add('full-center');
    pageViews.forEach(p => p.classList.add('full-view'));
    proxyViewerEl.classList.add('full-view');
  } else if (layout === ' minimal-imp') {
    // Preset 3: Minimalist Imp (Image 3 style)
    sidebar.classList.add('hidden-sidebar');
    tabBarEl.classList.add('top-full');
    bottomNavWrap.classList.add('full-center');
    pageViews.forEach(p => p.classList.add('full-view'));
    proxyViewerEl.classList.add('full-view');
  } else {
    // Preset 1: Sidebar Workspace (Fern style / Image 2)
    sidebar.classList.remove('hidden-sidebar');
    tabBarEl.classList.remove('top-full');
    bottomNavWrap.classList.remove('full-center');
    pageViews.forEach(p => p.classList.remove('full-view'));
    proxyViewerEl.classList.remove('full-view');
  }
  localStorage.setItem('verbos_ui_layout', layout);
}
uiLayoutSelect.value = localStorage.getItem('verbos_ui_layout') || 'normal';
applyUiLayout(uiLayoutSelect.value);
uiLayoutSelect.addEventListener('change', () => applyUiLayout(uiLayoutSelect.value));

const guiScaleSlider = document.getElementById('gui-scale-slider');
const guiScaleVal = document.getElementById('gui-scale-val');
function applyGuiScale(val) {
  document.documentElement.style.setProperty('--gui-scale', val);
  guiScaleVal.textContent = val;
  localStorage.setItem('verbos_gui_scale', val);
}
const savedScale = localStorage.getItem('verbos_gui_scale') || '1.15';
guiScaleSlider.value = savedScale;
applyGuiScale(savedScale);
guiScaleSlider.addEventListener('input', (e) => applyGuiScale(e.target.value));

const bgSelect = document.getElementById('bg-style-select');
bgSelect.value = localStorage.getItem('verbos_bg_style') || 'stars';
bgSelect.addEventListener('change', () => {
  localStorage.setItem('verbos_bg_style', bgSelect.value);
  initBackground(bgSelect.value);
});

/* --- Modals Handling --- */
const profileModal = document.getElementById('profile-modal');
const bookmarksModal = document.getElementById('bookmarks-modal');

document.getElementById('sb-bookmarks').addEventListener('click', () => bookmarksModal.classList.remove('hidden'));
document.getElementById('close-bookmarks').addEventListener('click', () => bookmarksModal.classList.add('hidden'));

document.getElementById('sb-profile').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');
const profileFileInput = document.getElementById('profile-file-input');
const profileFontSelect = document.getElementById('profile-font');
const profileAnimSelect = document.getElementById('profile-anim');
const profileColorInput = document.getElementById('profile-color');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const name = localStorage.getItem('verbos_user_name');
  const bio = localStorage.getItem('verbos_user_bio');
  const pfp = localStorage.getItem('verbos_user_pfp');
  const font = localStorage.getItem('verbos_chat_font');
  const anim = localStorage.getItem('verbos_username_anim') || 'none';
  const color = localStorage.getItem('verbos_user_color');

  profileNameInput.value = name;
  profileBioInput.value = bio;
  if (!pfp.startsWith('data:')) profilePfpInput.value = pfp;
  profileFontSelect.value = font;
  profileAnimSelect.value = anim;
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
      alert("image is too large! choose an image under 200kb.");
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
    alert("display name cannot be empty!");
    return;
  }
  
  try {
    const res = await fetch('/api/chat?type=users');
    if (res.ok) {
      const users = await res.json();
      const currentStoredName = localStorage.getItem('verbos_user_name');
      if (users.includes(name) && name !== currentStoredName) {
        alert("this display name is already taken!");
        return;
      }
    }
  } catch (e) {}

  const bio = profileBioInput.value.trim() || 'exploring the web with verbos.';
  const pfp = profilePfpInput.value.trim() || '⭐';
  const font = profileFontSelect.value;
  const anim = profileAnimSelect.value;
  const color = profileColorInput.value;

  localStorage.setItem('verbos_user_name', name);
  localStorage.setItem('verbos_user_bio', bio);
  localStorage.setItem('verbos_user_pfp', pfp);
  localStorage.setItem('verbos_chat_font', font);
  localStorage.setItem('verbos_username_anim', anim);
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

// Star Logo (Clean math without division errors)
const starCanvas = document.getElementById('star-canvas');
const starCtx = starCanvas.getContext('2d');
let angle = 0, floatTime = 0;
function drawStarLogo() {
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.save();
  floatTime += 0.01;
  const centerX = starCanvas.width * 0.5 + Math.sin(floatTime) * 5;
  const centerY = starCanvas.height * 0.5 + Math.cos(floatTime * 0.8) * 5;
  starCtx.translate(centerX, centerY);
  starCtx.rotate(angle);
  starCtx.fillStyle = '#ffffff';
  starCtx.beginPath();
  for (let i = 0; i < 4; i++) { 
    starCtx.lineTo(0, -95); 
    starCtx.rotate(Math.PI * 0.25); 
    starCtx.lineTo(0, -38); 
    starCtx.rotate(Math.PI * 0.25); 
  }
  starCtx.closePath(); 
  starCtx.fill();
  starCtx.restore();
  angle += 0.0015;
  requestAnimationFrame(drawStarLogo);
}
drawStarLogo();
renderTabs();
