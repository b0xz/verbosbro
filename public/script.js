if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_DATA_VERSION = 'v17_satura';
if (localStorage.getItem('satura_data_version') !== CURRENT_DATA_VERSION) {
  localStorage.setItem('satura_data_version', CURRENT_DATA_VERSION);
}

if (!localStorage.getItem('satura_user_name')) {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  localStorage.setItem('satura_user_name', 'saturauser-' + randNum);
  localStorage.setItem('satura_user_bio', 'exploring the web with satura.');
  localStorage.setItem('satura_user_pfp', '⭐');
  localStorage.setItem('satura_user_color', '#ffffff');
  localStorage.setItem('satura_chat_font', 'Inter, sans-serif');
  localStorage.setItem('satura_username_anim', 'none');
  localStorage.setItem('satura_gui_scale', '1.15');
}

let tabs = [{ id: 1, title: 'new tab', url: '', src: 'about:blank' }];
let activeTabId = 1;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-iframe-1');
const proxyViewerContainer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const gamesPageView = document.getElementById('games-page-view');
const settingsPageView = document.getElementById('settings-page-view');
const bottomNavWrapper = document.getElementById('bottom-nav-wrapper');
const loadingSpinner = document.getElementById('loading-spinner');
const onlineCounterText = document.getElementById('online-counter-text');

function showSpinner() { if (loadingSpinner) loadingSpinner.classList.remove('hidden'); }
function hideSpinner() { if (loadingSpinner) loadingSpinner.classList.add('hidden'); }

if (proxyViewer) proxyViewer.addEventListener('load', hideSpinner);

// Online Users Counter Simulation
function updateOnlineCounter() {
  if (!onlineCounterText) return;
  const count = Math.floor(Math.random() * 5) + 1;
  onlineCounterText.textContent = count === 1 ? '1 person online' : `${count} people online`;
}
setInterval(updateOnlineCounter, 10000);
updateOnlineCounter();

function renderTabs() {
  if (!tabBar) return;
  tabBar.querySelectorAll('.tab-item').forEach(el => el.remove());
  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    tabEl.innerHTML = `
      <span>${tab.title}</span>
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
    if (proxyInput) proxyInput.value = tab.url;
    hideAllPages();

    if (tab.src === 'about:blank' || !tab.url) {
      if (proxyViewerContainer) proxyViewerContainer.classList.remove('active');
      if (homeView) homeView.classList.remove('hidden');
      if (bottomNavWrapper) bottomNavWrapper.classList.remove('hidden');
      if (proxyViewer) proxyViewer.src = 'about:blank';
    } else {
      if (homeView) homeView.classList.add('hidden');
      if (proxyViewerContainer) proxyViewerContainer.classList.add('active');
      if (bottomNavWrapper) bottomNavWrapper.classList.remove('hidden');
      if (proxyViewer) proxyViewer.src = tab.src;
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

if (addTabBtn) addTabBtn.addEventListener('click', () => addTab());

function hideAllPages() {
  if (homeView) homeView.classList.add('hidden');
  if (proxyViewerContainer) proxyViewerContainer.classList.remove('active');
  if (chatPageView) chatPageView.classList.remove('active');
  if (gamesPageView) gamesPageView.classList.remove('active');
  if (settingsPageView) settingsPageView.classList.remove('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
}

/* Sidebar Navigation & Search Bar Visibility */
document.getElementById('sb-home')?.addEventListener('click', () => {
  hideAllPages();
  if (homeView) homeView.classList.remove('hidden');
  if (bottomNavWrapper) bottomNavWrapper.classList.remove('hidden');
  document.getElementById('sb-home').classList.add('active');
});

document.getElementById('sb-chat')?.addEventListener('click', () => {
  hideAllPages();
  if (chatPageView) chatPageView.classList.add('active');
  if (bottomNavWrapper) bottomNavWrapper.classList.add('hidden'); // Hides search bar in chat
  document.getElementById('sb-chat').classList.add('active');
  if (window.initChat) window.initChat();
});

document.getElementById('sb-games')?.addEventListener('click', () => {
  hideAllPages();
  if (gamesPageView) gamesPageView.classList.add('active');
  if (bottomNavWrapper) bottomNavWrapper.classList.add('hidden'); // Hides search bar in games
  document.getElementById('sb-games').classList.add('active');
});

document.getElementById('sb-settings')?.addEventListener('click', () => {
  hideAllPages();
  if (settingsPageView) settingsPageView.classList.add('active');
  if (bottomNavWrapper) bottomNavWrapper.classList.add('hidden'); // Hides search bar in settings
  document.getElementById('sb-settings').classList.add('active');
});

document.getElementById('sb-bookmarks')?.addEventListener('click', () => {
  document.getElementById('bookmarks-modal')?.classList.remove('hidden');
});

document.getElementById('close-bookmarks')?.addEventListener('click', () => {
  document.getElementById('bookmarks-modal')?.classList.add('hidden');
});

/* Navigation & Refresh Controls */
document.getElementById('btn-reload')?.addEventListener('click', () => {
  if (proxyViewer && proxyViewer.src && proxyViewer.src !== 'about:blank') {
    showSpinner();
    proxyViewer.src = proxyViewer.src;
  }
});

document.getElementById('btn-back')?.addEventListener('click', () => {
  try { proxyViewer.contentWindow.history.back(); } catch (e) {}
});

document.getElementById('btn-forward')?.addEventListener('click', () => {
  try { proxyViewer.contentWindow.history.forward(); } catch (e) {}
});

/* Proxy Execution */
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
  const currentTab = tabs.find(t => t.id === activeTabId);
  const simIp = localStorage.getItem('satura_simulated_ip') || '192.168.1.102';
  
  const encodedToken = btoa(encodeURIComponent(targetUrl)).replace(/=/g, '');
  const proxyUrl = `/api/proxy?token=${encodedToken}&sim_ip=${simIp}`;
  
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  if (proxyInput) proxyInput.value = targetUrl;
  hideAllPages();
  if (proxyViewerContainer) proxyViewerContainer.classList.add('active');
  if (bottomNavWrapper) bottomNavWrapper.classList.remove('hidden');
  if (proxyViewer) proxyViewer.src = proxyUrl;
  renderTabs();
};

if (document.getElementById('proxy-go')) {
  document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
}
if (proxyInput) {
  proxyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      launchProxy(proxyInput.value);
    }
  });
}

/* Themes & Preferences Settings */
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
  localStorage.setItem('satura_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('satura_theme') || 'obsidian');

/* Cloak & Stealth Handling */
let isCloaked = false;
const cloakNotice = document.getElementById('cloak-notice');

function toggleCloak(forceState) {
  isCloaked = typeof forceState === 'boolean' ? forceState : !isCloaked;
  if (isCloaked) {
    document.body.style.opacity = '0';
    if (cloakNotice) cloakNotice.style.display = 'block';
  } else {
    document.body.style.opacity = '1';
    if (cloakNotice) cloakNotice.style.display = 'none';
  }
}

document.getElementById('sb-cloak-btn')?.addEventListener('click', () => toggleCloak(true));
document.getElementById('manual-cloak-btn')?.addEventListener('click', () => toggleCloak(true));

document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    toggleCloak();
  }
});

const tabCloakPreset = document.getElementById('tab-cloak-preset');
if (tabCloakPreset) {
  tabCloakPreset.value = localStorage.getItem('satura_cloak_preset') || 'satura';
  tabCloakPreset.addEventListener('change', (e) => {
    const val = e.target.value;
    localStorage.setItem('satura_cloak_preset', val);
    const titleEl = document.getElementById('tab-title');
    const faviconEl = document.getElementById('tab-favicon');
    if (val === 'google') {
      if (titleEl) titleEl.textContent = 'Google';
      if (faviconEl) faviconEl.href = 'https://www.google.com/favicon.ico';
    } else if (val === 'khan') {
      if (titleEl) titleEl.textContent = 'Dashboard | Khan Academy';
      if (faviconEl) faviconEl.href = 'https://cdn.kastatic.org/images/favicon.ico';
    } else {
      if (titleEl) titleEl.textContent = 'satura';
    }
  });
}

const searchPosSelect = document.getElementById('search-pos-select');
if (searchPosSelect) {
  searchPosSelect.value = localStorage.getItem('satura_search_pos') || 'bottom';
  searchPosSelect.addEventListener('change', (e) => {
    const pos = e.target.value;
    localStorage.setItem('satura_search_pos', pos);
    if (pos === 'top') bottomNavWrapper?.classList.add('top-search-pos');
    else bottomNavWrapper?.classList.remove('top-search-pos');
  });
  if (searchPosSelect.value === 'top') bottomNavWrapper?.classList.add('top-search-pos');
}

const uiOutlinesSelect = document.getElementById('ui-outlines-select');
if (uiOutlinesSelect) {
  uiOutlinesSelect.value = localStorage.getItem('satura_ui_outlines') || 'enabled';
  uiOutlinesSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    localStorage.setItem('satura_ui_outlines', val);
    const root = document.documentElement;
    if (val === 'disabled') {
      root.style.setProperty('--panel-border', 'none');
      root.style.setProperty('--border-radius', '0px');
    } else {
      root.style.setProperty('--panel-border', '1px solid var(--border)');
      root.style.setProperty('--border-radius', '12px');
    }
  });
}

const guiScaleSlider = document.getElementById('gui-scale-slider');
const guiScaleVal = document.getElementById('gui-scale-val');
if (guiScaleSlider) {
  const savedScale = localStorage.getItem('satura_gui_scale') || '1.15';
  guiScaleSlider.value = savedScale;
  document.documentElement.style.setProperty('--gui-scale', savedScale);
  if (guiScaleVal) guiScaleVal.textContent = savedScale;

  guiScaleSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    document.documentElement.style.setProperty('--gui-scale', val);
    if (guiScaleVal) guiScaleVal.textContent = val;
    localStorage.setItem('satura_gui_scale', val);
  });
}

/* Profile Modal & Automatic Letter PFPs */
const profileModal = document.getElementById('profile-modal');
document.getElementById('sb-profile')?.addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile')?.addEventListener('click', () => profileModal.classList.add('hidden'));

const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');
const profileFontSelect = document.getElementById('profile-font');
const profileAnimSelect = document.getElementById('profile-anim');
const profileColorInput = document.getElementById('profile-color');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const name = localStorage.getItem('satura_user_name') || 'saturauser';
  const bio = localStorage.getItem('satura_user_bio') || 'exploring the web with satura.';
  const pfp = localStorage.getItem('satura_user_pfp') || '⭐';
  const font = localStorage.getItem('satura_chat_font') || 'Inter, sans-serif';
  const anim = localStorage.getItem('satura_username_anim') || 'none';
  const color = localStorage.getItem('satura_user_color') || '#ffffff';

  if (profileNameInput) profileNameInput.value = name;
  if (profileBioInput) profileBioInput.value = bio;
  if (profilePfpInput && !pfp.startsWith('data:')) profilePfpInput.value = pfp;
  if (profileFontSelect) profileFontSelect.value = font;
  if (profileAnimSelect) profileAnimSelect.value = anim;
  if (profileColorInput) profileColorInput.value = color;

  if (pfp && (pfp.startsWith('http') || pfp.startsWith('data:'))) {
    if (pfpImg) {
      pfpImg.src = pfp;
      pfpImg.classList.remove('hidden');
    }
    if (pfpInitial) pfpInitial.classList.add('hidden');
  } else {
    if (pfpInitial) {
      pfpInitial.textContent = name.charAt(0).toUpperCase(); // Automatic Letter PFP
      pfpInitial.classList.remove('hidden');
    }
    if (pfpImg) pfpImg.classList.add('hidden');
  }
}

document.getElementById('save-profile')?.addEventListener('click', () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    alert("display name cannot be empty!");
    return;
  }

  const bio = profileBioInput.value.trim() || 'exploring the web with satura.';
  const pfp = profilePfpInput.value.trim() || name.charAt(0).toUpperCase();
  const font = profileFontSelect.value;
  const anim = profileAnimSelect.value;
  const color = profileColorInput.value;

  localStorage.setItem('satura_user_name', name);
  localStorage.setItem('satura_user_bio', bio);
  localStorage.setItem('satura_user_pfp', pfp);
  localStorage.setItem('satura_chat_font', font);
  localStorage.setItem('satura_username_anim', anim);
  localStorage.setItem('satura_user_color', color);

  loadProfile();
  profileModal.classList.add('hidden');
});
loadProfile();

/* Star Background Engine */
const starCanvas = document.getElementById('star-canvas');
const starCtx = starCanvas ? starCanvas.getContext('2d') : null;
let angle = 0, floatTime = 0;

const backgroundStars = Array.from({ length: 90 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  radius: Math.random() * 2 + 1,
  speed: Math.random() * 1.5 + 0.5
}));

function drawStarEngine() {
  if (!starCanvas || !starCtx) return;

  if (starCanvas.width !== window.innerWidth || starCanvas.height !== window.innerHeight) {
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
  }

  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.save();

  floatTime += 0.012;
  const centerX = starCanvas.width * 0.5 + Math.sin(floatTime) * 8;
  const centerY = starCanvas.height * 0.5 + Math.cos(floatTime * 0.8) * 8;
  const starRadius = 54;

  backgroundStars.forEach(star => {
    star.x += star.speed;
    if (star.x > starCanvas.width) {
      star.x = 0;
      star.y = Math.random() * starCanvas.height;
    }

    const distToCenter = Math.hypot(star.x - centerX, star.y - centerY);
    const isInverted = distToCenter < starRadius;

    starCtx.fillStyle = isInverted ? '#000000' : '#ffffff';
    starCtx.beginPath();
    starCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    starCtx.fill();
  });

  starCtx.save();
  starCtx.translate(centerX, centerY);
  starCtx.rotate(angle);
  
  starCtx.fillStyle = '#ffffff';
  starCtx.beginPath();
  for (let i = 0; i < 4; i++) { 
    starCtx.lineTo(0, -135); 
    starCtx.rotate(Math.PI * 0.25); 
    starCtx.lineTo(0, -54); 
    starCtx.rotate(Math.PI * 0.25); 
  }
  starCtx.closePath(); 
  starCtx.fill();
  starCtx.restore();

  starCtx.restore();
  angle += 0.0015;
  requestAnimationFrame(drawStarEngine);
}
drawStarEngine();
renderTabs();
