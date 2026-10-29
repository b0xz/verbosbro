if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_VERSION = 'onyx_v1.9';
if (localStorage.getItem('onyx_version') !== CURRENT_VERSION) {
  localStorage.setItem('onyx_version', CURRENT_VERSION);
}

if (!localStorage.getItem('onyx_user_name')) {
  localStorage.setItem('onyx_user_name', 'onyxuser-' + Math.floor(1000 + Math.random() * 9000));
  localStorage.setItem('onyx_user_bio', 'exploring the web with onyx.');
  localStorage.setItem('onyx_user_pfp', '💎');
}

let tabs = [{ id: 1, title: 'new tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let historyLog = JSON.parse(localStorage.getItem('onyx_history') || '[]');
let bookmarksList = JSON.parse(localStorage.getItem('onyx_bookmarks') || '[]');

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

/* Themes */
const THEMES = {
  midnight: { bg: '#000000', panel: '#0a0a0a', border: '#222222', text: '#ffffff', subtext: '#888888', hover: '#161616' },
  matrix: { bg: '#020b05', panel: '#051b0f', border: '#133a23', text: '#86efac', subtext: '#4ade80', hover: '#0d2e1a' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', text: '#fca5a5', subtext: '#f87171', hover: '#2f0c11' },
  aquatic: { bg: '#020d14', panel: '#051926', border: '#0e314a', text: '#7dd3fc', subtext: '#38bdf8', hover: '#092436' },
  sunset: { bg: '#140812', panel: '#260d21', border: '#4a193f', text: '#f5d0fe', subtext: '#e879f9', hover: '#3b1231' },
  slate: { bg: '#0f172a', panel: '#1e293b', border: '#334155', text: '#f8fafc', subtext: '#94a3b8', hover: '#273548' }
};

function applyTheme(key) {
  const t = THEMES[key] || THEMES.midnight;
  const root = document.documentElement;
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--panel', t.panel);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--text', t.text);
  root.style.setProperty('--subtext', t.subtext);
  root.style.setProperty('--hover', t.hover);
  localStorage.setItem('onyx_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('onyx_theme') || 'midnight');

/* Search Engine Selector */
const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  yahoo: 'https://search.yahoo.com/search?p=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
  startpage: 'https://www.startpage.com/sp/search?query=',
  qwant: 'https://www.qwant.com/?q='
};

let activeEngineKey = localStorage.getItem('onyx_search_engine') || 'google';
document.querySelectorAll('.search-engine-card').forEach(card => {
  if (card.getAttribute('data-engine') === activeEngineKey) {
    card.classList.add('active');
  } else {
    card.classList.remove('active');
  }
  card.addEventListener('click', () => {
    document.querySelectorAll('.search-engine-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeEngineKey = card.getAttribute('data-engine');
    localStorage.setItem('onyx_search_engine', activeEngineKey);
  });
});

/* Profile & Chat Settings */
const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');

function loadProfileSettings() {
  if (profileNameInput) profileNameInput.value = localStorage.getItem('onyx_user_name') || '';
  if (profileBioInput) profileBioInput.value = localStorage.getItem('onyx_user_bio') || '';
  if (profilePfpInput) profilePfpInput.value = localStorage.getItem('onyx_user_pfp') || '';
}
loadProfileSettings();

document.getElementById('save-profile')?.addEventListener('click', () => {
  localStorage.setItem('onyx_user_name', profileNameInput.value.trim() || 'onyxuser');
  localStorage.setItem('onyx_user_bio', profileBioInput.value.trim());
  localStorage.setItem('onyx_user_pfp', profilePfpInput.value.trim() || '💎');
  alert('profile settings saved successfully!');
  if (window.initChat) window.initChat();
});

/* Adblock Toggle */
const adblockToggle = document.getElementById('adblock-toggle');
if (adblockToggle) {
  adblockToggle.checked = localStorage.getItem('onyx_adblock') === 'true';
  adblockToggle.addEventListener('change', (e) => {
    localStorage.setItem('onyx_adblock', e.target.checked);
  });
}

/* Userscripts Management */
const userscriptInput = document.getElementById('userscript-input');
if (userscriptInput) {
  userscriptInput.value = localStorage.getItem('onyx_userscript_code') || '';
}
document.getElementById('save-userscript')?.addEventListener('click', () => {
  localStorage.setItem('onyx_userscript_code', userscriptInput.value);
  alert('userscript saved successfully!');
});

/* Inspect Element Tool Trigger */
document.getElementById('toggle-inspector-btn')?.addEventListener('click', () => {
  try {
    if (proxyViewer && proxyViewer.contentWindow) {
      proxyViewer.contentWindow.postMessage({ type: 'TOGGLE_INSPECTOR' }, '*');
      alert('inspector message sent to active proxied frame!');
    } else {
      alert('no active proxy page loaded to inspect.');
    }
  } catch (e) {
    alert('unable to access active frame.');
  }
});

/* Cloaking / Stealth Handling */
let isCloaked = false;
function toggleCloak(forceState) {
  isCloaked = typeof forceState === 'boolean' ? forceState : !isCloaked;
  document.body.style.opacity = isCloaked ? '0' : '1';
}
document.getElementById('manual-cloak-btn')?.addEventListener('click', () => toggleCloak(true));
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    toggleCloak();
  }
});

/* Toolbar Actions & Proxy Execution */
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
    const baseSearchUrl = SEARCH_ENGINES[activeEngineKey] || SEARCH_ENGINES.google;
    return baseSearchUrl + encodeURIComponent(query);
  }
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const currentTab = tabs.find(t => t.id === activeTabId);
  const encodedToken = btoa(encodeURIComponent(targetUrl))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  const proxyUrl = `/service/${encodedToken}`;
  
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  historyLog.unshift({ url: targetUrl, time: new Date().toLocaleTimeString() });
  if (historyLog.length > 50) historyLog.pop();
  localStorage.setItem('onyx_history', JSON.stringify(historyLog));

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

renderTabs();
