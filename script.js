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

// Panic key (\)
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    document.body.style.display = document.body.style.display === 'none' ? 'block' : 'none';
  }
});

// Navigation listener from proxy iframe
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

// Toggles for Modes, Devices, VPN
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
  proxyViewer.classList.add('active');

  proxyIframe1.src = proxyUrl;
  renderTabs();
};

document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); } });

/* --- Integrated Global Chat System --- */
const sbChat = document.getElementById('sb-chat');
const chatModal = document.getElementById('chat-modal');
const closeChat = document.getElementById('close-chat');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
let chatPoll = null;

sbChat.addEventListener('click', () => {
  chatModal.classList.remove('hidden');
  fetchChat();
  if (!chatPoll) chatPoll = setInterval(fetchChat, 3000);
});
closeChat.addEventListener('click', () => { chatModal.classList.add('hidden'); clearInterval(chatPoll); chatPoll = null; });

async function fetchChat() {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    chatMessages.innerHTML = data.map(m => `
      <div style="background:var(--hover); padding:6px 10px; border-radius:6px; font-size:0.85rem;">
        <div style="display:flex; justify-content:space-between; color:var(--subtext); font-size:0.75rem;">
          <span style="color:${m.color || '#fff'}; font-weight:bold;">${escapeHtml(m.user)}</span>
          <span>${m.time}</span>
        </div>
        <div style="margin-top:2px; word-break:break-word;">${escapeHtml(m.text)}</div>
      </div>
    `).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (e) {}
}

async function sendChat() {
  const text = chatInput.value.trim();
  const user = localStorage.getItem('pryra_user_name') || 'PryraUser';
  if (!text) return;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, text, color: '#3b82f6' })
    });
    if (res.ok) { chatInput.value = ''; fetchChat(); }
  } catch (e) {}
}
chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* --- Themes & Customization --- */
const DARK_THEMES = {
  obsidian: { bg: '#000000', panel: '#0a0a0a', border: '#262626', accent: '#3b82f6', hover: '#1a1a1a' },
  cyber: { bg: '#050b14', panel: '#0c1524', border: '#1e293b', accent: '#06b6d4', hover: '#111e36' },
  emerald: { bg: '#02120d', panel: '#082119', border: '#133a2d', accent: '#10b981', hover: '#0f3327' },
  amethyst: { bg: '#0b0614', panel: '#150c26', border: '#2d1b4d', accent: '#8b5cf6', hover: '#22133d' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', accent: '#ef4444', hover: '#2f0c11' }
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

// Background style switcher
const bgSelect = document.getElementById('bg-style-select');
bgSelect.value = localStorage.getItem('pryra_bg_style') || 'stars';
bgSelect.addEventListener('change', () => {
  localStorage.setItem('pryra_bg_style', bgSelect.value);
  initBackground(bgSelect.value);
});

// Search bar style switcher
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

document.getElementById('sb-settings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('save-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));

document.getElementById('sb-profile').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

// Profile Logic
const profileNameInput = document.getElementById('profile-name');
const profilePfpInput = document.getElementById('profile-pfp');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const name = localStorage.getItem('pryra_user_name') || '';
  const pfp = localStorage.getItem('pryra_user_pfp') || '';
  profileNameInput.value = name;
  profilePfpInput.value = pfp;

  if (pfp && pfp.startsWith('http')) {
    pfpImg.src = pfp; pfpImg.classList.remove('hidden'); pfpInitial.classList.add('hidden');
  } else if (name) {
    pfpInitial.textContent = name.charAt(0).toUpperCase();
    pfpImg.classList.add('hidden'); pfpInitial.classList.remove('hidden');
  }
}
document.getElementById('save-profile').addEventListener('click', () => {
  localStorage.setItem('pryra_user_name', profileNameInput.value.trim());
  localStorage.setItem('pryra_user_pfp', profilePfpInput.value.trim());
  loadProfile();
  profileModal.classList.add('hidden');
});
loadProfile();

/* --- Dynamic Background Canvas Rendering --- */
const bgCanvas = document.getElementById('bg-canvas');
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
      bgCtx.fillStyle = '#3b82f6';
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
    // Starfield default
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
