if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_VERSION = 'styu_v1.0';
if (localStorage.getItem('styu_version') !== CURRENT_VERSION) {
  localStorage.setItem('styu_version', CURRENT_VERSION);
}

let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let historyLog = JSON.parse(localStorage.getItem('styu_history') || '[]');
let bookmarksList = JSON.parse(localStorage.getItem('styu_bookmarks') || '[]');

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const gamesPageView = document.getElementById('games-page-view');
const settingsPageView = document.getElementById('settings-page-view');
const onlineCounterText = document.getElementById('online-counter-text');

// Real Online Users Counter (Synced via BroadcastChannel & LocalStorage Session Heartbeat)
const presenceChannel = new BroadcastChannel('styu_presence_channel');
let sessionKey = 'styu_session_' + Math.random();
let activeSessions = JSON.parse(localStorage.getItem('styu_active_sessions') || '{}');

activeSessions[sessionKey] = Date.now();
localStorage.setItem('styu_active_sessions', JSON.stringify(activeSessions));

window.addEventListener('beforeunload', () => {
  let sessions = JSON.parse(localStorage.getItem('styu_active_sessions') || '{}');
  delete sessions[sessionKey];
  localStorage.setItem('styu_active_sessions', JSON.stringify(sessions));
  presenceChannel.postMessage({ type: 'ping' });
});

presenceChannel.onmessage = (event) => {
  if (event.data && event.data.type === 'ping') {
    updateRealOnlineCounter();
  }
};

async function updateRealOnlineCounter() {
  if (!onlineCounterText) return;
  
  try {
    const res = await fetch('/api/online', { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.count === 'number') {
        onlineCounterText.textContent = data.count === 1 ? '1 person online' : `${data.count} people online`;
        return;
      }
    }
  } catch (e) {}

  let sessions = JSON.parse(localStorage.getItem('styu_active_sessions') || '{}');
  const now = Date.now();
  let validCount = 0;
  
  Object.keys(sessions).forEach(k => {
    if (now - sessions[k] < 15000) {
      validCount++;
    } else {
      delete sessions[k];
    }
  });

  sessions[sessionKey] = now;
  localStorage.setItem('styu_active_sessions', JSON.stringify(sessions));
  validCount = Math.max(1, validCount);

  onlineCounterText.textContent = validCount === 1 ? '1 person online' : `${validCount} people online`;
}

setInterval(updateRealOnlineCounter, 5000);
updateRealOnlineCounter();

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

if (addTabBtn) addTabBtn.addEventListener('click', () => addTab());

function hideAllPages() {
  if (homeView) homeView.classList.remove('active');
  if (proxyViewer) proxyViewer.classList.remove('active');
  if (chatPageView) chatPageView.classList.remove('active');
  if (gamesPageView) gamesPageView.classList.remove('active');
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

/* Toolbar Actions & Proxy Execution connected to /api/proxy */
document.getElementById('btn-home')?.addEventListener('click', () => {
  hideAllPages();
  if (homeView) homeView.classList.add('active');
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = '';
    currentTab.src = 'about:blank';
    currentTab.title = 'New Tab';
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
  if (!query.includes('.') || query.includes(' ')) return 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const currentTab = tabs.find(t => t.id === activeTabId);
  const simIp = '192.168.1.102';
  
  // Encoded token routing through api/proxy.js
  const encodedToken = btoa(encodeURIComponent(targetUrl)).replace(/=/g, '');
  const proxyUrl = `/api/proxy?token=${encodedToken}&sim_ip=${simIp}`;
  
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  // Log History
  historyLog.unshift({ url: targetUrl, time: new Date().toLocaleTimeString() });
  if (historyLog.length > 50) historyLog.pop();
  localStorage.setItem('styu_history', JSON.stringify(historyLog));

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

/* Starring / Bookmarking */
document.getElementById('btn-star')?.addEventListener('click', () => {
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab && currentTab.url) {
    if (!bookmarksList.some(b => b.url === currentTab.url)) {
      bookmarksList.push({ title: currentTab.title, url: currentTab.url });
      localStorage.setItem('styu_bookmarks', JSON.stringify(bookmarksList));
      alert('Page starred and bookmarked!');
    } else {
      alert('Page is already bookmarked.');
    }
  } else {
    alert('No active website to star.');
  }
});

/* History Modal */
const historyModal = document.getElementById('history-modal');
document.getElementById('btn-history')?.addEventListener('click', () => {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = historyLog.map(h => `<div class="list-item" onclick="launchProxy('${h.url}'); historyModal.classList.add('hidden');"><span>${h.url}</span><span style="color:var(--subtext);font-size:0.75rem;">${h.time}</span></div>`).join('') || '<p style="color:var(--subtext);">No history yet.</p>';
  historyModal.classList.remove('hidden');
});
document.getElementById('close-history')?.addEventListener('click', () => historyModal.classList.add('hidden'));
document.getElementById('clear-history')?.addEventListener('click', () => {
  historyLog = [];
  localStorage.removeItem('styu_history');
  document.getElementById('history-list').innerHTML = '<p style="color:var(--subtext);">No history yet.</p>';
});

/* Bookmarks Modal */
const bookmarksModal = document.getElementById('bookmarks-modal');
document.getElementById('btn-bookmarks')?.addEventListener('click', () => {
  const listEl = document.getElementById('bookmarks-list');
  listEl.innerHTML = bookmarksList.map(b => `<div class="list-item" onclick="launchProxy('${b.url}'); bookmarksModal.classList.add('hidden');"><span>${b.title}</span><span style="color:var(--subtext);font-size:0.75rem;">${b.url}</span></div>`).join('') || '<p style="color:var(--subtext);">No starred bookmarks yet.</p>';
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
  localStorage.setItem('styu_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('styu_theme') || 'oled');

// GUI Scale Resizer
const guiScaleSlider = document.getElementById('gui-scale-slider');
const guiScaleVal = document.getElementById('gui-scale-val');
if (guiScaleSlider) {
  const savedScale = localStorage.getItem('styu_gui_scale') || '1.0';
  guiScaleSlider.value = savedScale;
  document.documentElement.style.setProperty('--gui-scale', savedScale);
  if (guiScaleVal) guiScaleVal.textContent = savedScale;

  guiScaleSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    document.documentElement.style.setProperty('--gui-scale', val);
    if (guiScaleVal) guiScaleVal.textContent = val;
    localStorage.setItem('styu_gui_scale', val);
  });
}

renderTabs();
