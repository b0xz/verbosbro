if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_VERSION = 'celest_v1.2';
if (localStorage.getItem('celest_version') !== CURRENT_VERSION) {
  localStorage.setItem('celest_version', CURRENT_VERSION);
}

if (!localStorage.getItem('celest_user_name')) {
  localStorage.setItem('celest_user_name', 'celestuser-' + Math.floor(1000 + Math.random() * 9000));
  localStorage.setItem('celest_user_bio', 'exploring the web with celest.');
  localStorage.setItem('celest_user_pfp', '🚀');
  localStorage.setItem('celest_user_color', '#ffffff');
  localStorage.setItem('celest_username_anim', 'none');
}

let tabs = [{ id: 1, title: 'new tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let historyLog = JSON.parse(localStorage.getItem('celest_history') || '[]');
let bookmarksList = JSON.parse(localStorage.getItem('celest_bookmarks') || '[]');

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const homeSearchInput = document.getElementById('home-search-bar');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const gamesPageView = document.getElementById('games-page-view');
const appsPageView = document.getElementById('apps-page-view');
const settingsPageView = document.getElementById('settings-page-view');
const liveTimeDisplay = document.getElementById('live-time-display');

function updateLiveTime() {
  if (!liveTimeDisplay) return;
  const now = new Date();
  liveTimeDisplay.textContent = now.toLocaleTimeString();
}
setInterval(updateLiveTime, 1000);
updateLiveTime();

function renderTabs() {
  if (!tabBar) return;
  tabBar.querySelectorAll('.tab-item').forEach(el => el.remove());
  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    tabEl.innerHTML = `
      <span>${tab.title}</span>
      <button class="tab-close" onclick="event.stopPropagation(); closeTab(${tab.id})">✕</button>
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
      if (proxyViewer) proxyViewer.classList.remove('active');
      if (homeView) homeView.classList.add('active');
      if (proxyViewer) proxyViewer.src = 'about:blank';
    } else {
      if (homeView) homeView.classList.remove('active');
      if (proxyViewer) proxyViewer.classList.add('active');
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
  if (homeView) homeView.classList.remove('active');
  if (proxyViewer) proxyViewer.classList.remove('active');
  if (chatPageView) chatPageView.classList.remove('active');
  if (gamesPageView) gamesPageView.classList.remove('active');
  if (appsPageView) appsPageView.classList.remove('active');
  if (settingsPageView) settingsPageView.classList.remove('active');
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
}

/* Dock Navigation */
document.getElementById('dock-home')?.addEventListener('click', () => {
  hideAllPages();
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab && currentTab.url) {
    if (proxyViewer) proxyViewer.classList.add('active');
  } else {
    if (homeView) homeView.classList.add('active');
  }
  document.getElementById('dock-home').classList.add('active');
});

document.getElementById('dock-chat')?.addEventListener('click', () => {
  hideAllPages();
  if (chatPageView) chatPageView.classList.add('active');
  document.getElementById('dock-chat').classList.add('active');
  if (window.initChat) window.initChat();
});

document.getElementById('dock-games')?.addEventListener('click', () => {
  hideAllPages();
  if (gamesPageView) gamesPageView.classList.add('active');
  document.getElementById('dock-games').classList.add('active');
});

document.getElementById('dock-settings')?.addEventListener('click', () => {
  hideAllPages();
  if (settingsPageView) settingsPageView.classList.add('active');
  document.getElementById('dock-settings').classList.add('active');
});

/* Home Grid Nav Actions */
document.getElementById('nav-games')?.addEventListener('click', () => {
  hideAllPages();
  if (gamesPageView) gamesPageView.classList.add('active');
  document.getElementById('dock-games').classList.add('active');
});
document.getElementById('nav-apps')?.addEventListener('click', () => {
  hideAllPages();
  if (appsPageView) appsPageView.classList.add('active');
});
document.getElementById('nav-music')?.addEventListener('click', () => launchProxy('https://soundcloud.com'));
document.getElementById('nav-chat')?.addEventListener('click', () => {
  hideAllPages();
  if (chatPageView) chatPageView.classList.add('active');
  document.getElementById('dock-chat').classList.add('active');
  if (window.initChat) window.initChat();
});
document.getElementById('nav-settings')?.addEventListener('click', () => {
  hideAllPages();
  if (settingsPageView) settingsPageView.classList.add('active');
  document.getElementById('dock-settings').classList.add('active');
});

/* Settings Tab Switching */
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`pane-${btn.getAttribute('data-tab')}`)?.classList.add('active');
  });
});

/* Cloaking / Stealth Handling */
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

document.getElementById('manual-cloak-btn')?.addEventListener('click', () => toggleCloak(true));
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    toggleCloak();
  }
});

const tabCloakPreset = document.getElementById('tab-cloak-preset');
if (tabCloakPreset) {
  tabCloakPreset.value = localStorage.getItem('celest_cloak_preset') || 'celest';
  tabCloakPreset.addEventListener('change', (e) => {
    const val = e.target.value;
    localStorage.setItem('celest_cloak_preset', val);
    const titleEl = document.getElementById('tab-title');
    const faviconEl = document.getElementById('tab-favicon');
    if (val === 'google') {
      if (titleEl) titleEl.textContent = 'google search';
      if (faviconEl) faviconEl.href = 'https://www.google.com/favicon.ico';
    } else if (val === 'khan') {
      if (titleEl) titleEl.textContent = 'dashboard | khan academy';
      if (faviconEl) faviconEl.href = 'https://cdn.kastatic.org/images/favicon.ico';
    } else {
      if (titleEl) titleEl.textContent = 'celest';
      if (faviconEl) faviconEl.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23000'/><text x='5' y='65' fill='%23fff' font-family='sans-serif' font-weight='bold' font-size='32'>celest</text></svg>";
    }
  });
}

/* Profile Settings with immediate live propagation */
const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');
const profileColorInput = document.getElementById('profile-color');
const profileAnimSelect = document.getElementById('profile-anim');

function loadProfileSettings() {
  if (profileNameInput) profileNameInput.value = localStorage.getItem('celest_user_name') || '';
  if (profileBioInput) profileBioInput.value = localStorage.getItem('celest_user_bio') || '';
  if (profilePfpInput) profilePfpInput.value = localStorage.getItem('celest_user_pfp') || '';
  if (profileColorInput) profileColorInput.value = localStorage.getItem('celest_user_color') || '#ffffff';
  if (profileAnimSelect) profileAnimSelect.value = localStorage.getItem('celest_username_anim') || 'none';
}
loadProfileSettings();

document.getElementById('save-profile')?.addEventListener('click', () => {
  localStorage.setItem('celest_user_name', profileNameInput.value.trim() || 'celestuser');
  localStorage.setItem('celest_user_bio', profileBioInput.value.trim());
  localStorage.setItem('celest_user_pfp', profilePfpInput.value.trim() || '🚀');
  localStorage.setItem('celest_user_color', profileColorInput.value);
  localStorage.setItem('celest_username_anim', profileAnimSelect.value);
  alert('profile settings saved and updated!');
  if (window.initChat) window.initChat();
});

/* Data JSON Export / Import & Deletion */
document.getElementById('export-json-btn')?.addEventListener('click', () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'celest_backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-json-file')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, data[key]);
      });
      alert('data successfully imported! reloading...');
      location.reload();
    } catch (err) {
      alert('invalid json backup file.');
    }
  };
  reader.readAsText(file);
});

document.getElementById('clear-local-data')?.addEventListener('click', () => {
  if (confirm('are you sure you want to delete all local data and preferences?')) {
    localStorage.clear();
    location.reload();
  }
});

/* Toolbar Actions & Proxy Execution using Ecosia Search Engine */
document.getElementById('btn-home')?.addEventListener('click', () => {
  hideAllPages();
  if (homeView) homeView.classList.add('active');
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = '';
    currentTab.src = 'about:blank';
    currentTab.title = 'new tab';
  }
  if (proxyInput) proxyInput.value = '';
  renderTabs();
});

document.getElementById('btn-reload')?.addEventListener('click', () => {
  if (proxyViewer && proxyViewer.src && proxyViewer.src !== 'about:blank') {
    proxyViewer.src = proxyViewer.src;
  }
});

document.getElementById('btn-back')?.addEventListener('click', () => {
  try { proxyViewer.contentWindow.history.back(); } catch (e) {}
});

document.getElementById('btn-forward')?.addEventListener('click', () => {
  try { proxyViewer.contentWindow.history.forward(); } catch (e) {}
});

document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (!query.includes('.') || query.includes(' ')) {
    return 'https://www.ecosia.org/search?q=' + encodeURIComponent(query);
  }
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const currentTab = tabs.find(t => t.id === activeTabId);
  const simIp = '192.168.1.102';
  
  const encodedToken = btoa(encodeURIComponent(targetUrl)).replace(/=/g, '');
  const proxyUrl = `/api/proxy?token=${encodedToken}&sim_ip=${simIp}`;
  
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  historyLog.unshift({ url: targetUrl, time: new Date().toLocaleTimeString() });
  if (historyLog.length > 50) historyLog.pop();
  localStorage.setItem('celest_history', JSON.stringify(historyLog));

  if (proxyInput) proxyInput.value = targetUrl;
  hideAllPages();
  if (proxyViewer) proxyViewer.classList.add('active');
  if (proxyViewer) proxyViewer.src = proxyUrl;
  renderTabs();
};

if (proxyInput) {
  proxyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      launchProxy(proxyInput.value);
    }
  });
}
if (homeSearchInput) {
  homeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      launchProxy(homeSearchInput.value);
    }
  });
}

/* Starring / Bookmarking */
document.getElementById('btn-star')?.addEventListener('click', () => {
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab && currentTab.url) {
    if (!bookmarksList.some(b => b.url === currentTab.url)) {
      bookmarksList.push({ title: currentTab.title, url: currentTab.url });
      localStorage.setItem('celest_bookmarks', JSON.stringify(bookmarksList));
      alert('page starred and bookmarked!');
    } else {
      alert('page is already bookmarked.');
    }
  } else {
    alert('no active website to star.');
  }
});

/* History Modal */
const historyModal = document.getElementById('history-modal');
document.getElementById('btn-history')?.addEventListener('click', () => {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = historyLog.map(h => `<div class="list-item" onclick="launchProxy('${h.url}'); historyModal.classList.add('hidden');"><span>${h.url}</span><span style="color:var(--subtext);font-size:0.75rem;">${h.time}</span></div>`).join('') || '<p style="color:var(--subtext);">no history yet.</p>';
  historyModal.classList.remove('hidden');
});
document.getElementById('close-history')?.addEventListener('click', () => historyModal.classList.add('hidden'));
document.getElementById('clear-history')?.addEventListener('click', () => {
  historyLog = [];
  localStorage.removeItem('celest_history');
  document.getElementById('history-list').innerHTML = '<p style="color:var(--subtext);">no history yet.</p>';
});

/* Bookmarks Modal */
const bookmarksModal = document.getElementById('bookmarks-modal');
document.getElementById('btn-bookmarks')?.addEventListener('click', () => {
  const listEl = document.getElementById('bookmarks-list');
  listEl.innerHTML = bookmarksList.map(b => `<div class="list-item" onclick="launchProxy('${b.url}'); bookmarksModal.classList.add('hidden');"><span>${b.title}</span><span style="color:var(--subtext);font-size:0.75rem;">${b.url}</span></div>`).join('') || '<p style="color:var(--subtext);">no starred bookmarks yet.</p>';
  bookmarksModal.classList.remove('hidden');
});
document.getElementById('close-bookmarks')?.addEventListener('click', () => bookmarksModal.classList.add('hidden'));

/* Themes & GUI Scaling */
const THEMES = {
  oled: { bg: '#000000', panel: '#050505', border: '#1f1f1f', text: '#f8fafc', subtext: '#888888', accent: '#ffffff', hover: '#121212' },
  charcoal: { bg: '#0f1115', panel: '#181b22', border: '#2b313b', text: '#e2e8f0', subtext: '#94a3b8', accent: '#38bdf8', hover: '#222731' },
  matrix: { bg: '#020b05', panel: '#051b0f', border: '#133a23', text: '#86efac', subtext: '#4ade80', accent: '#22c55e', hover: '#0d2e1a' },
  blossom: { bg: '#12050b', panel: '#210813', border: '#421226', text: '#fbcfe8', subtext: '#f472b6', accent: '#ec4899', hover: '#300b1b' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', text: '#fca5a5', subtext: '#f87171', accent: '#ef4444', hover: '#2f0c11' },
  aquatic: { bg: '#020d14', panel: '#051926', border: '#0e314a', text: '#7dd3fc', subtext: '#38bdf8', accent: '#0ea5e9', hover: '#092436' }
};

function applyTheme(key) {
  const t = THEMES[key] || THEMES.oled;
  const root = document.documentElement;
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--panel', t.panel);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--text', t.text);
  root.style.setProperty('--subtext', t.subtext);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--hover', t.hover);
  localStorage.setItem('celest_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('celest_theme') || 'oled');

const guiScaleSlider = document.getElementById('gui-scale-slider');
const guiScaleVal = document.getElementById('gui-scale-val');
if (guiScaleSlider) {
  const savedScale = localStorage.getItem('celest_gui_scale') || '1.0';
  guiScaleSlider.value = savedScale;
  document.documentElement.style.setProperty('--gui-scale', savedScale);
  if (guiScaleVal) guiScaleVal.textContent = savedScale;

  guiScaleSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    document.documentElement.style.setProperty('--gui-scale', val);
    if (guiScaleVal) guiScaleVal.textContent = val;
    localStorage.setItem('celest_gui_scale', val);
  });
}

renderTabs();
