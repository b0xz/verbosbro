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
let isHidden = false;
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    isHidden = !isHidden;
    document.body.style.display = isHidden ? 'none' : 'block';
  }
});

// Mode, Device & VPN Toggles
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

modeToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  deviceMenu.classList.remove('active');
  vpnMenu.classList.remove('active');
  modeMenu.classList.toggle('active');
});

deviceToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  modeMenu.classList.remove('active');
  vpnMenu.classList.remove('active');
  deviceMenu.classList.toggle('active');
});

vpnToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  modeMenu.classList.remove('active');
  deviceMenu.classList.remove('active');
  vpnMenu.classList.toggle('active');
});

document.addEventListener('click', () => {
  modeMenu.classList.remove('active');
  deviceMenu.classList.remove('active');
  vpnMenu.classList.remove('active');
});

document.querySelectorAll('#mode-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = btn.getAttribute('data-mode');
    currentModeLabel.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    modeMenu.classList.remove('active');
  });
});

document.querySelectorAll('#device-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentDevice = btn.getAttribute('data-device');
    currentDeviceLabel.textContent = btn.querySelector('span').textContent.split(' ')[0];
    deviceMenu.classList.remove('active');
  });
});

document.querySelectorAll('#vpn-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentVpn = btn.getAttribute('data-vpn');
    currentVpnLabel.textContent = btn.querySelector('span').textContent.split(' ')[0];
    vpnMenu.classList.remove('active');
  });
});

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (!query.includes('.') || query.includes(' ')) return 'https://www.google.com/search?q=' + encodeURIComponent(query);
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
proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); }
});

/* --- Dark Color Preset Themes --- */
const DARK_THEMES = {
  obsidian: { bg: '#000000', panel: '#0a0a0a', border: '#262626', accent: '#3b82f6', hover: '#1a1a1a' },
  cyber: { bg: '#050b14', panel: '#0c1524', border: '#1e293b', accent: '#06b6d4', hover: '#111e36' },
  emerald: { bg: '#02120d', panel: '#082119', border: '#133a2d', accent: '#10b981', hover: '#0f3327' },
  amethyst: { bg: '#0b0614', panel: '#150c26', border: '#2d1b4d', accent: '#8b5cf6', hover: '#22133d' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', accent: '#ef4444', hover: '#2f0c11' }
};

function applyTheme(themeKey) {
  const theme = DARK_THEMES[themeKey] || DARK_THEMES.obsidian;
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--panel', theme.panel);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--hover', theme.hover);

  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-theme') === themeKey);
  });
  localStorage.setItem('verbos_theme', themeKey);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => applyTheme(card.getAttribute('data-theme')));
});

const savedTheme = localStorage.getItem('verbos_theme') || 'obsidian';
applyTheme(savedTheme);

/* --- Modals Handling --- */
const settingsModal = document.getElementById('settings-modal');
const bookmarksModal = document.getElementById('bookmarks-modal');
const profileModal = document.getElementById('profile-modal');

document.getElementById('sb-settings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('close-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));

document.getElementById('sb-bookmarks').addEventListener('click', () => bookmarksModal.classList.remove('hidden'));
document.getElementById('close-bookmarks').addEventListener('click', () => bookmarksModal.classList.add('hidden'));

document.getElementById('sb-profile').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

/* --- Profile & Custom PFP Sign-In Logic --- */
const profileNameInput = document.getElementById('profile-name');
const profilePfpInput = document.getElementById('profile-pfp');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const savedName = localStorage.getItem('verbos_user_name') || '';
  const savedPfp = localStorage.getItem('verbos_user_pfp') || '';

  profileNameInput.value = savedName;
  profilePfpInput.value = savedPfp;

  if (savedPfp && (savedPfp.startsWith('http://') || savedPfp.startsWith('https://'))) {
    pfpImg.src = savedPfp;
    pfpImg.classList.remove('hidden');
    pfpInitial.classList.add('hidden');
  } else if (savedName) {
    pfpInitial.textContent = savedName.charAt(0).toUpperCase();
    pfpImg.classList.add('hidden');
    pfpInitial.classList.remove('hidden');
  } else {
    pfpInitial.textContent = '?';
    pfpImg.classList.add('hidden');
    pfpInitial.classList.remove('hidden');
  }
}

document.getElementById('save-profile').addEventListener('click', () => {
  localStorage.setItem('verbos_user_name', profileNameInput.value.trim());
  localStorage.setItem('verbos_user_pfp', profilePfpInput.value.trim());
  loadProfile();
  profileModal.classList.add('hidden');
});

loadProfile();

/* --- Notes Scratchpad --- */
const notesArea = document.getElementById('notes-textarea');
notesArea.value = localStorage.getItem('verbos_notes') || '';
document.getElementById('save-notes').addEventListener('click', () => {
  localStorage.setItem('verbos_notes', notesArea.value);
  bookmarksModal.classList.add('hidden');
});

/* --- Star Background Canvas --- */
const bgCanvas = document.getElementById('bg-stars');
const bgCtx = bgCanvas.getContext('2d');
let stars = [];
window.addEventListener('resize', () => { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; });
for (let i = 0; i < 120; i++) {
  stars.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, size: Math.random() * 2.5 + 0.8, speed: Math.random() * 0.3 + 0.05, rot: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 0.02 });
}
function drawBgStars() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgCtx.fillStyle = '#ffffff';
  stars.forEach(s => {
    s.x += s.speed; s.rot += s.rotSpeed;
    if (s.x > bgCanvas.width) s.x = 0;
    bgCtx.save(); bgCtx.translate(s.x, s.y); bgCtx.rotate(s.rot);
    bgCtx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    bgCtx.restore();
  });
  requestAnimationFrame(drawBgStars);
}
drawBgStars();
bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;

// Star Canvas
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let angle = 0, floatTime = 0;
function drawStarCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  floatTime += 0.01;
  ctx.translate(canvas.width / 2 + Math.sin(floatTime) * 5, canvas.height / 2 + Math.cos(floatTime * 0.8) * 5);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.lineTo(0, -95); ctx.rotate(Math.PI / 4); ctx.lineTo(0, -38); ctx.rotate(Math.PI / 4); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  angle += 0.0015;
  requestAnimationFrame(drawStarCanvas);
}
drawStarCanvas();
renderTabs();
