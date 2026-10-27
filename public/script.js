if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_VERSION = 'celest_v1.4';
if (localStorage.getItem('celest_version') !== CURRENT_VERSION) {
  localStorage.setItem('celest_version', CURRENT_VERSION);
}

if (!localStorage.getItem('celest_user_name')) {
  localStorage.setItem('celest_user_name', 'celestuser-' + Math.floor(1000 + Math.random() * 9000));
  localStorage.setItem('celest_user_bio', 'vector network explorer.');
  localStorage.setItem('celest_user_pfp', '🚀');
  localStorage.setItem('celest_user_color', '#ffffff');
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

document.querySelectorAll('.settings-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`pane-${btn.getAttribute('data-tab')}`)?.classList.add('active');
  });
});

const adblockToggle = document.getElementById('adblock-toggle');
if (adblockToggle) {
  const savedAdblock = localStorage.getItem('celest_adblock') === 'true';
  adblockToggle.checked = savedAdblock;
  adblockToggle.addEventListener('change', (e) => {
    localStorage.setItem('celest_adblock', e.target.checked);
  });
}

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

const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');

function loadProfileSettings() {
  if (profileNameInput) profileNameInput.value = localStorage.getItem('celest_user_name') || '';
  if (profileBioInput) profileBioInput.value = localStorage.getItem('celest_user_bio') || '';
  if (profilePfpInput) profilePfpInput.value = localStorage.getItem('celest_user_pfp') || '';
}
loadProfileSettings();

document.getElementById('save-profile')?.addEventListener('click', () => {
  localStorage.setItem('celest_user_name', profileNameInput.value.trim() || 'celestuser');
  localStorage.setItem('celest_user_bio', profileBioInput.value.trim());
  localStorage.setItem('celest_user_pfp', profilePfpInput.value.trim() || '🚀');
  alert('profile updated!');
  if (window.initChat) window.initChat();
});

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

document.getElementById('clear-local-data')?.addEventListener('click', () => {
  if (confirm('wipe all local data?')) {
    localStorage.clear();
    location.reload();
  }
});

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
    return 'https://search.yahoo.com/search?p=' + encodeURIComponent(query);
  }
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const currentTab = tabs.find(t => t.id === activeTabId);
  const simIp = '192.168.1.102';
  const adblockEnabled = localStorage.getItem('celest_adblock') === 'true';
  
  const encodedToken = btoa(encodeURIComponent(targetUrl)).replace(/=/g, '');
  const proxyUrl = `/api/proxy?token=${encodedToken}&sim_ip=${simIp}&adblock=${adblockEnabled}`;
  
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

document.getElementById('btn-star')?.addEventListener('click', () => {
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab && currentTab.url) {
    if (!bookmarksList.some(b => b.url === currentTab.url)) {
      bookmarksList.push({ title: currentTab.title, url: currentTab.url });
      localStorage.setItem('celest_bookmarks', JSON.stringify(bookmarksList));
      alert('page bookmarked!');
    } else {
      alert('already bookmarked.');
    }
  }
});

const historyModal = document.getElementById('history-modal');
document.getElementById('btn-history')?.addEventListener('click', () => {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = historyLog.map(h => `<div class="list-item" onclick="launchProxy('${h.url}'); historyModal.classList.add('hidden');"><span>${h.url}</span><span style="color:var(--subtext);font-size:0.7rem;">${h.time}</span></div>`).join('') || '<p style="color:var(--subtext);">no history.</p>';
  historyModal.classList.remove('hidden');
});
document.getElementById('close-history')?.addEventListener('click', () => historyModal.classList.add('hidden'));
document.getElementById('clear-history')?.addEventListener('click', () => {
  historyLog = [];
  localStorage.removeItem('celest_history');
  document.getElementById('history-list').innerHTML = '<p style="color:var(--subtext);">no history.</p>';
});

const bookmarksModal = document.getElementById('bookmarks-modal');
document.getElementById('btn-bookmarks')?.addEventListener('click', () => {
  const listEl = document.getElementById('bookmarks-list');
  listEl.innerHTML = bookmarksList.map(b => `<div class="list-item" onclick="launchProxy('${b.url}'); bookmarksModal.classList.add('hidden');"><span>${b.title}</span><span style="color:var(--subtext);font-size:0.7rem;">${b.url}</span></div>`).join('') || '<p style="color:var(--subtext);">no bookmarks.</p>';
  bookmarksModal.classList.remove('hidden');
});
document.getElementById('close-bookmarks')?.addEventListener('click', () => bookmarksModal.classList.add('hidden'));

renderTabs();
