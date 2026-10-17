/* ===================================================
   MIKSI CLIENT CONTROLLER
   =================================================== */
let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyIframe = document.getElementById('proxy-iframe');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');

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
      proxyIframe.src = 'about:blank';
    } else {
      homeView.classList.add('hidden');
      proxyViewer.classList.add('active');
      proxyIframe.src = tab.src;
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
  if (activeTabId === id) {
    switchTab(tabs[tabs.length - 1].id);
  } else {
    renderTabs();
  }
};

addTabBtn.addEventListener('click', () => addTab());

/* Panic Key (\) */
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
const sbSettings = document.getElementById('sb-settings');
const gamesModal = document.getElementById('games-modal');
const gamesClose = document.getElementById('games-close');
const settingsModal = document.getElementById('settings-modal');
const modalClose = document.getElementById('modal-close');

sbHome.addEventListener('click', () => {
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = '';
    currentTab.src = 'about:blank';
    currentTab.title = 'New Tab';
  }
  switchTab(activeTabId);
});

sbGames.addEventListener('click', () => gamesModal.classList.add('active'));
gamesClose.addEventListener('click', () => gamesModal.classList.remove('active'));
sbSettings.addEventListener('click', () => settingsModal.classList.add('active'));
modalClose.addEventListener('click', () => settingsModal.classList.remove('active'));

/* Bottom Dropdown Menus */
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const currentModeLabel = document.getElementById('current-mode-label');

const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const currentDeviceLabel = document.getElementById('current-device-label');
const deviceWrapper = document.getElementById('device-wrapper');

let currentMode = 'strong';
let currentDevice = 'desktop';

modeToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  deviceMenu.classList.remove('active');
  modeMenu.classList.toggle('active');
});

deviceToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  modeMenu.classList.remove('active');
  deviceMenu.classList.toggle('active');
});

document.addEventListener('click', () => {
  modeMenu.classList.remove('active');
  deviceMenu.classList.remove('active');
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
    currentDeviceLabel.textContent = currentDevice.charAt(0).toUpperCase() + currentDevice.slice(1);
    deviceWrapper.className = 'device-viewport';
    if (currentDevice === 'mobile') deviceWrapper.classList.add('mode-mobile');
    if (currentDevice === 'tablet') deviceWrapper.classList.add('mode-tablet');
    deviceMenu.classList.remove('active');
  });
});

/* Proxy Execution */
const proxyGoBtn = document.getElementById('proxy-go');

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  gamesModal.classList.remove('active');
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}`;
  
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try {
      currentTab.title = new URL(targetUrl).hostname;
    } catch(e) {
      currentTab.title = targetUrl;
    }
  }

  proxyInput.value = targetUrl;
  homeView.classList.add('hidden');
  proxyViewer.classList.add('active');
  proxyIframe.src = proxyUrl;
  renderTabs();
};

proxyGoBtn.addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    launchProxy(proxyInput.value);
  }
});

/* Star Canvas Animation with Fading Corner Trails */
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let angle = 0;

function drawStarCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);

  // Draw 4-pointed star
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.lineTo(0, -60);
    ctx.rotate(Math.PI / 4);
    ctx.lineTo(0, -20);
    ctx.rotate(Math.PI / 4);
  }
  ctx.closePath();
  ctx.fill();

  // Draw fading corner trails
  const trailSegments = 8;
  for (let t = 1; t <= trailSegments; t++) {
    ctx.save();
    ctx.rotate(-t * 0.02);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * (1 - t / trailSegments)})`;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(0, -65);
      ctx.rotate(Math.PI / 4);
      ctx.lineTo(0, -22);
      ctx.rotate(Math.PI / 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  angle += 0.008;
  requestAnimationFrame(drawStarCanvas);
}
drawStarCanvas();

/* Settings Sliders */
const guiScaleSlider = document.getElementById('gui-scale-slider');
guiScaleSlider.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--gui-scale', e.target.value);
  document.getElementById('gui-scale-val').textContent = parseFloat(e.target.value).toFixed(2) + 'x';
});

document.getElementById('save-settings').addEventListener('click', () => settingsModal.classList.remove('active'));
