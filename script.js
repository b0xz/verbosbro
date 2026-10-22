if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
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
    chatPageView.classList.remove('active');
    bottomNavWrapper.classList.remove('hidden');
    document.getElementById('sb-chat').classList.remove('active');
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

document.getElementById('sb-home').addEventListener('click', () => {
  chatPageView.classList.remove('active');
  bottomNavWrapper.classList.remove('hidden');
  proxyViewer.classList.remove('active');
  homeView.classList.remove('hidden');
  document.getElementById('sb-home').classList.add('active');
  document.getElementById('sb-chat').classList.remove('active');
});

// Panic key (\)
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    document.body.style.display = document.body.style.display === 'none' ? 'block' : 'none';
  }
});

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'pryra-navigate') {
    const targetUrl = event.data.url;
    if (targetUrl && !targetUrl.includes('/api/proxy?url=')) {
      proxyInput.value = targetUrl;
      const currentTab = tabs.find(t => t.id === activeTabId);
      if (currentTab) {
        currentTab.url = targetUrl;
        try { currentTab.title = new URL(targetUrl).hostname; } catch(e) {}
        renderTabs();
      }
    }
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

document.querySelectorAll('#mode-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); currentMode = btn.getAttribute('data-mode'); currentModeLabel.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1); modeMenu.classList.remove('active'); });
});
document.querySelectorAll('#device-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); currentDevice = btn.getAttribute('data-device'); currentDeviceLabel.textContent = btn.querySelector('span').textContent.split(' ')[0]; deviceMenu.classList.remove('active'); });
});
document.querySelectorAll('#vpn-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); currentVpn = btn.getAttribute('data-vpn'); currentVpnLabel.textContent = btn.querySelector('span').textContent.split(' ')[0]; vpnMenu.classList.remove('active'); });
});

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
  homeView.classList.add('hidden');
  chatPageView.classList.remove('active');
  bottomNavWrapper.classList.remove('hidden');
  proxyViewer.classList.add('active');

  proxyIframe1.src = proxyUrl;
  renderTabs();
};

document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); } });

/* --- Full Page Chat System --- */
const sbChat = document.getElementById('sb-chat');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
let chatPoll = null;
let lastMessageTime = 0;
let lastKnownCount = 0;

sbChat.addEventListener('click', () => {
  homeView.classList.add('hidden');
  proxyViewer.classList.remove('active');
  chatPageView.classList.add('active');
  bottomNavWrapper.classList.add('hidden'); // Hide search on chat view
  document.getElementById('sb-home').classList.remove('active');
  sbChat.classList.add('active');
  fetchChat(true);
  
  // Refresh chat every 3 seconds while on chat view
  if (!chatPoll) chatPoll = setInterval(() => fetchChat(false), 3000);
});

async function fetchChat(forceScroll = false) {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.length !== lastKnownCount || forceScroll) {
      lastKnownCount = data.length;

      chatMessages.innerHTML = data.map(m => {
        const isImg = m.pfp && (m.pfp.startsWith('http') || m.pfp.startsWith('data:image'));
        const pfpHTML = isImg ? `<img src="${m.pfp}" alt="pfp" />` : (m.pfp || '⭐');
        const msgFont = m.font || 'Arial, sans-serif';

        return `
          <div class="chat-msg-item">
            <div class="chat-msg-pfp" onclick="openUserDashboard('${encodeURIComponent(m.user)}', '${encodeURIComponent(m.pfp || '⭐')}', '${encodeURIComponent(m.bio || 'Exploring the web with Pryra.')}')">${pfpHTML}</div>
            <div class="chat-msg-content">
              <div class="chat-msg-header">
                <span class="chat-msg-username" style="color: ${m.color || '#ffffff'};" onclick="openUserDashboard('${encodeURIComponent(m.user)}', '${encodeURIComponent(m.pfp || '⭐')}', '${encodeURIComponent(m.bio || 'Exploring the web with Pryra.')}')">${escapeHtml(m.user)}</span>
                <span class="chat-msg-time">${m.time}</span>
              </div>
              <div class="chat-msg-text" style="font-family: ${msgFont};">${escapeHtml(m.text)}</div>
            </div>
          </div>
        `;
      }).join('');

      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (e) {}
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Anti-spam check (2 second cooldown)
  const now = Date.now();
  if (now - lastMessageTime < 2000) {
    alert('Please wait 2 seconds before sending another message (Anti-Spam).');
    return;
  }
  lastMessageTime = now;

  const user = localStorage.getItem('pryra_user_name') || 'PryraUser';
  const pfp = localStorage.getItem('pryra_user_pfp') || '⭐';
  const bio = localStorage.getItem('pryra_user_bio') || 'Exploring the web with Pryra.';
  const color = localStorage.getItem('pryra_user_color') || '#ffffff';
  const font = localStorage.getItem('pryra_chat_font') || 'Arial, sans-serif';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, text, pfp, bio, color, font })
    });
    if (res.ok) { 
      chatInput.value = ''; 
      fetchChat(true); 
    }
  } catch (e) {}
}

chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* --- User Dashboard Modal --- */
const userDashboardModal = document.getElementById('user-dashboard-modal');
document.getElementById('close-user-dashboard').addEventListener('click', () => userDashboardModal.classList.add('hidden'));

window.openUserDashboard = function(encodedUser, encodedPfp, encodedBio) {
  const username = decodeURIComponent(encodedUser);
  const pfp = decodeURIComponent(encodedPfp);
  const bio = decodeURIComponent(encodedBio);

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

/* --- Themes & Customization --- */
const DARK_THEMES = {
  obsidian: { bg: '#000000', panel: '#0a0a0a', border: '#262626', accent: '#ffffff', hover: '#1a1a1a' },
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
  localStorage.setItem('pryra_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('pryra_theme') || 'obsidian');

const bgSelect = document.getElementById('bg-style-select');
bgSelect.value = localStorage.getItem('pryra_bg_style') || 'stars';
bgSelect.addEventListener('change', () => {
  localStorage.setItem('pryra_bg_style', bgSelect.value);
  initBackground(bgSelect.value);
});

const searchSelect = document.getElementById('search-style-select');
const searchContainer = document.getElementById('search-pill-container');
searchSelect.value = localStorage.getItem('pryra_search_style') || 'pill';
function applySearchStyle(style) {
  searchContainer.className = 'bottom-nav-pill style-' + style;
}
searchSelect.addEventListener('change', () => {
  localStorage.setItem('pryra_search_style', searchSelect.value);
  applySearchStyle(searchSelect.value);
});
applySearchStyle(localStorage.getItem('pryra_search_style') || 'pill');

/* --- Modals Handling --- */
const settingsModal = document.getElementById('settings-modal');
const profileModal = document.getElementById('profile-modal');
const bookmarksModal = document.getElementById('bookmarks-modal');

document.getElementById('sb-settings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('close-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));

document.getElementById('sb-bookmarks').addEventListener('click', () => bookmarksModal.classList.remove('hidden'));
document.getElementById('close-bookmarks').addEventListener('click', () => bookmarksModal.classList.add('hidden'));

document.getElementById('sb-profile').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

// Profile & Customization Logic
const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');
const profileFileInput = document.getElementById('profile-file-input');
const profileFontSelect = document.getElementById('profile-font');
const profileColorInput = document.getElementById('profile-color');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const name = localStorage.getItem('pryra_user_name') || 'PryraUser';
  const bio = localStorage.getItem('pryra_user_bio') || 'Exploring the web with Pryra.';
  const pfp = localStorage.getItem('pryra_user_pfp') || '⭐';
  const font = localStorage.getItem('pryra_chat_font') || 'Arial, sans-serif';
  const color = localStorage.getItem('pryra_user_color') || '#ffffff';

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
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
      profilePfpInput.value = uploadEvent.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('save-profile').addEventListener('click', () => {
  const name = profileNameInput.value.trim() || 'PryraUser';
  const bio = profileBioInput.value.trim() || 'Exploring the web with Pryra.';
  const pfp = profilePfpInput.value.trim() || '⭐';
  const font = profileFontSelect.value;
  const color = profileColorInput.value;

  localStorage.setItem('pryra_user_name', name);
  localStorage.setItem('pryra_user_bio', bio);
  localStorage.setItem('pryra_user_pfp', pfp);
  localStorage.setItem('pryra_chat_font', font);
  localStorage.setItem('pryra_user_color', color);

  loadProfile();
  profileModal.classList.add('hidden');
});
loadProfile();

/* --- Dynamic Background Canvas Rendering --- */
const bgCanvas = document.getElementById('bg-stars');
const bgCtx = bgCanvas.getContext('2d');
let animationFrameId = null;

function initBackground(style) {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;

  if (style === 'matrix') {
    const letters = 'PRYRA010101XYZ';
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
initBackground(localStorage.getItem('pryra_bg_style') || 'stars');

// Center Star Canvas Logo
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
