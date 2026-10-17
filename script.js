/* ===================================================
   MIKSI CLIENT CONTROLLER (TABS, SIDEBAR, PANIC KEY)
   =================================================== */
let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyIframe = document.getElementById('proxy-iframe');

function renderTabs() {
  const existingTabs = tabBar.querySelectorAll('.tab-item');
  existingTabs.forEach(el => el.remove());

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    tabEl.setAttribute('data-tab-id', tab.id);
    tabEl.innerHTML = `
      <span class="tab-title-text" style="overflow:hidden; text-overflow:ellipsis;">${tab.title}</span>
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
    proxyIframe.src = tab.src;
  }
  renderTabs();
}

function addTab(url = '', src = 'about:blank', title = 'New Tab') {
  const newId = Date.now();
  tabs.push({ id: newId, title, url, src });
  switchTab(newId);
}

window.closeTab = function(id) {
  if (tabs.length === 1) return;
  tabs = tabs.filter(t => t.id !== id);
  if (activeTabId === id) {
    switchTab(tabs[tabs.length - 1].id);
  } else {
    renderTabs();
  }
};

addTabBtn.addEventListener('click', () => addTab());

/* Panic Hide Key (\) */
let isHidden = false;
document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    isHidden = !isHidden;
    document.body.style.display = isHidden ? 'none' : 'block';
  }
});

/* Sidebar Navigation Actions */
const sbHome = document.getElementById('sb-home');
const sbGames = document.getElementById('sb-games');
const sbChat = document.getElementById('sb-chat');
const sbSettings = document.getElementById('sb-settings');
const gamesModal = document.getElementById('games-modal');
const gamesClose = document.getElementById('games-close');
const settingsModal = document.getElementById('settings-modal');
const modalClose = document.getElementById('modal-close');
const chatDrawer = document.getElementById('chat-drawer');
const chatClose = document.getElementById('chat-close');

sbHome.addEventListener('click', () => { proxyInput.focus(); });
sbGames.addEventListener('click', () => gamesModal.classList.add('active'));
gamesClose.addEventListener('click', () => gamesModal.classList.remove('active'));
sbSettings.addEventListener('click', () => settingsModal.classList.add('active'));
modalClose.addEventListener('click', () => settingsModal.classList.remove('active'));
sbChat.addEventListener('click', () => chatDrawer.classList.add('active'));
chatClose.addEventListener('click', () => chatDrawer.classList.remove('active'));

/* Proxy Navigation Engine */
const proxyGoBtn = document.getElementById('proxy-go');
let currentMode = 'strong';

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

function launchProxy(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}`;
  
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    currentTab.title = new URL(targetUrl).hostname;
  }

  proxyInput.value = targetUrl;
  proxyIframe.src = proxyUrl;
  renderTabs();
}

proxyGoBtn.addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    launchProxy(proxyInput.value);
  }
});

/* Settings & Chat Script Hooks */
const guiScaleSlider = document.getElementById('gui-scale-slider');
guiScaleSlider.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--gui-scale', e.target.value);
  document.getElementById('gui-scale-val').textContent = parseFloat(e.target.value).toFixed(2) + 'x';
});

document.getElementById('save-settings').addEventListener('click', () => settingsModal.classList.remove('active'));

/* Chat Auth */
let currentUser = '';
document.getElementById('sign-in-btn').addEventListener('click', () => {
  const name = document.getElementById('username-input').value.trim();
  if (name) {
    currentUser = name;
    document.getElementById('chat-auth-view').classList.add('hidden');
    document.getElementById('chat-messages-view').classList.remove('hidden');
    document.getElementById('chat-footer-view').classList.remove('hidden');
  }
});

document.getElementById('chat-send-btn').addEventListener('click', () => {
  const text = document.getElementById('chat-input').value.trim();
  if (text && currentUser) {
    const list = document.getElementById('chat-msg-list');
    list.innerHTML += `<div class="chat-msg"><strong>${currentUser}</strong><span>${text}</span></div>`;
    document.getElementById('chat-input').value = '';
  }
});
