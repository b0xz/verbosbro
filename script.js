if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let activeScreenIndex = 1;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const proxyIframe1 = document.getElementById('proxy-iframe-1');
const proxyIframe2 = document.getElementById('proxy-iframe-2');
const loadingSpinner = document.getElementById('loading-spinner');

function showSpinner() { loadingSpinner.classList.remove('hidden'); }
function hideSpinner() { loadingSpinner.classList.add('hidden'); }

proxyIframe1.addEventListener('load', hideSpinner);
proxyIframe2.addEventListener('load', hideSpinner);

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
    const activeIframe = activeScreenIndex === 1 ? proxyIframe1 : proxyIframe2;
    if (tab.src === 'about:blank' || !tab.url) {
      proxyViewer.classList.remove('active');
      homeView.classList.remove('hidden');
      activeIframe.src = 'about:blank';
    } else {
      homeView.classList.add('hidden');
      proxyViewer.classList.add('active');
      activeIframe.src = tab.src;
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

// Global Chat Modal Logic
const sbChat = document.getElementById('sb-chat');
const chatModal = document.getElementById('chat-modal');
const chatClose = document.getElementById('chat-close');
const chatMessagesContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatUsername = document.getElementById('chat-username');
const chatSend = document.getElementById('chat-send');
let chatPollInterval = null;

chatUsername.value = localStorage.getItem('miksi_chat_user') || 'User_' + Math.floor(Math.random() * 1000);
chatUsername.addEventListener('input', () => {
  localStorage.setItem('miksi_chat_user', chatUsername.value);
});

sbChat.addEventListener('click', () => {
  chatModal.classList.remove('hidden');
  fetchChatMessages();
  if (!chatPollInterval) chatPollInterval = setInterval(fetchChatMessages, 3000);
});

chatClose.addEventListener('click', () => {
  chatModal.classList.add('hidden');
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
});

async function fetchChatMessages() {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const messages = await res.json();
    chatMessagesContainer.innerHTML = messages.map(m => `
      <div style="background:var(--hover); padding:6px 10px; border-radius:6px; font-size:0.85rem;">
        <div style="display:flex; justify-content:space-between; color:var(--subtext); font-size:0.75rem;">
          <span style="color:var(--text); font-weight:bold;">${escapeHtml(m.user)}</span>
          <span>${m.time}</span>
        </div>
        <div style="margin-top:2px; word-break:break-word;">${escapeHtml(m.text)}</div>
      </div>
    `).join('');
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  } catch (err) {}
}

async function sendChatMessage() {
  const text = chatInput.value.trim();
  const user = chatUsername.value.trim() || 'Anonymous';
  if (!text) return;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, text })
    });
    if (res.ok) {
      chatInput.value = '';
      fetchChatMessages();
    }
  } catch (err) {}
}

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Mode & Device toggles
let currentMode = 'fast';
let currentDevice = 'desktop';
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const currentModeLabel = document.getElementById('current-mode-label');
const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const currentDeviceLabel = document.getElementById('current-device-label');

modeToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); deviceMenu.classList.remove('active'); modeMenu.classList.toggle('active'); });
deviceToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); modeMenu.classList.remove('active'); deviceMenu.classList.toggle('active'); });
document.addEventListener('click', () => { modeMenu.classList.remove('active'); deviceMenu.classList.remove('active'); });

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
    currentDeviceLabel.textContent = currentDevice.charAt(0).toUpperCase() + currentDevice.slice(1);
    deviceMenu.classList.remove('active');
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
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}&device=${currentDevice}`;
  
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  proxyInput.value = targetUrl;
  homeView.classList.add('hidden');
  proxyViewer.classList.add('active');

  const activeIframe = activeScreenIndex === 1 ? proxyIframe1 : proxyIframe2;
  activeIframe.src = proxyUrl;
  renderTabs();
};

document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); }
});

// Canvas Background Stars
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
