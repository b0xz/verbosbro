/* ===================================================
   MIKSI CLIENT CONTROLLER (SLOW SLOW SPIN & COLOR INVERSION)
   =================================================== */
let tabs = [{ id: 1, title: 'New Tab', url: '', src: 'about:blank' }];
let activeTabId = 1;
let activeScreenIndex = 1;
let isSplitScreen = false;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');

const screenPanel1 = document.getElementById('screen-panel-1');
const screenPanel2 = document.getElementById('screen-panel-2');
const proxyIframe1 = document.getElementById('proxy-iframe-1');
const proxyIframe2 = document.getElementById('proxy-iframe-2');

const splitSwitcherBar = document.getElementById('split-switcher-bar');
const btnScreen1 = document.getElementById('btn-screen1');
const btnScreen2 = document.getElementById('btn-screen2');

// Load saved settings
function loadSettings() {
  const scale = localStorage.getItem('miksi_scale') || '1.15';
  document.documentElement.style.setProperty('--gui-scale', scale);
  document.getElementById('gui-scale-slider').value = scale;
  document.getElementById('gui-scale-val').textContent = parseFloat(scale).toFixed(2) + 'x';
}
loadSettings();

/* Tab Dragging Logic */
const ghost = document.getElementById('tab-ghost');
const snapLeft = document.getElementById('snap-left');
const snapRight = document.getElementById('snap-right');
let draggedTabId = null;

function setupTabDrag(tabEl, tabId) {
  tabEl.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('tab-close')) return;
    draggedTabId = tabId;
    ghost.textContent = tabEl.querySelector('span').textContent;
    ghost.style.display = 'block';
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    tabEl.setPointerCapture(e.pointerId);
  });

  tabEl.addEventListener('pointermove', (e) => {
    if (!draggedTabId) return;
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';

    if (e.clientX < 120) snapLeft.classList.add('active');
    else snapLeft.classList.remove('active');

    if (e.clientX > window.innerWidth - 120) snapRight.classList.add('active');
    else snapRight.classList.remove('active');
  });

  tabEl.addEventListener('pointerup', (e) => {
    if (!draggedTabId) return;
    ghost.style.display = 'none';
    snapLeft.classList.remove('active');
    snapRight.classList.remove('active');

    if (e.clientX < 120 || e.clientX > window.innerWidth - 120) {
      enableSplitScreen();
    }
    draggedTabId = null;
  });
}

function enableSplitScreen() {
  isSplitScreen = true;
  screenPanel2.classList.remove('hidden');
  splitSwitcherBar.classList.add('active');
}

btnScreen1.addEventListener('click', () => {
  activeScreenIndex = 1;
  btnScreen1.classList.add('active');
  btnScreen2.classList.remove('active');
});

btnScreen2.addEventListener('click', () => {
  activeScreenIndex = 2;
  btnScreen2.classList.add('active');
  btnScreen1.classList.remove('active');
});

function renderTabs() {
  tabBar.querySelectorAll('.tab-item').forEach(el => el.remove());

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.id === activeTabId ? 'active' : ''}`;
    tabEl.innerHTML = `
      <span style="overflow:hidden; text-overflow:ellipsis;">${tab.title}</span>
      <button class="tab-close" onclick="event.stopPropagation(); closeTab(${tab.id})">×</button>
    `;
    setupTabDrag(tabEl, tab.id);
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

/* Sidebar Navigation & Modals */
const sbHome = document.getElementById('sb-home');
const sbGames = document.getElementById('sb-games');
const sbUserscripts = document.getElementById('sb-userscripts');
const sbSettings = document.getElementById('sb-settings');

const gamesModal = document.getElementById('games-modal');
const gamesClose = document.getElementById('games-close');
const userscriptsModal = document.getElementById('userscripts-modal');
const userscriptsClose = document.getElementById('userscripts-close');
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

sbGames.addEventListener('click', () => gamesModal.classList.remove('hidden'));
gamesClose.addEventListener('click', () => gamesModal.classList.add('hidden'));

sbUserscripts.addEventListener('click', () => userscriptsModal.classList.remove('hidden'));
userscriptsClose.addEventListener('click', () => userscriptsModal.classList.add('hidden'));

document.getElementById('save-userscript').addEventListener('click', () => {
  localStorage.setItem('miksi_userscript', document.getElementById('userscript-input').value);
  userscriptsModal.classList.add('hidden');
});

sbSettings.addEventListener('click', () => settingsModal.classList.add('active'));
modalClose.addEventListener('click', () => settingsModal.classList.remove('active'));

/* Draggable Settings Modal */
const modal = document.getElementById('settings-modal');
const dragHandle = document.getElementById('modal-drag-handle');
let isDragging = false, startX, startY, initialX, initialY;

function startDrag(e) {
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  startX = clientX; startY = clientY;
  const rect = modal.getBoundingClientRect();
  initialX = rect.left; initialY = rect.top;
}

function moveDrag(e) {
  if (!isDragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  modal.style.left = (initialX + clientX - startX) + 'px';
  modal.style.top = (initialY + clientY - startY) + 'px';
}

function stopDrag() { isDragging = false; }

dragHandle.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', moveDrag);
document.addEventListener('mouseup', stopDrag);
dragHandle.addEventListener('touchstart', startDrag, { passive: true });
document.addEventListener('touchmove', moveDrag, { passive: true });
document.addEventListener('touchend', stopDrag);

/* Settings Tabs */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.getAttribute('data-pane')).classList.add('active');
  });
});

/* Rotating Footer Quotes */
const footerQuotes = [
  "man i love fern",
  "boii this so tuff",
  "Made with vercel the goat",
  "leak to anybody you can dont snitch tho",
  "kamran made this, whos that?"
];
let quoteIndex = 0;
const footerCredit = document.getElementById('footer-credit');
footerCredit.addEventListener('click', () => {
  quoteIndex = (quoteIndex + 1) % footerQuotes.length;
  footerCredit.textContent = footerQuotes[quoteIndex];
});

/* Bottom Dropdown Menus */
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const currentModeLabel = document.getElementById('current-mode-label');

const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const currentDeviceLabel = document.getElementById('current-device-label');

let currentMode = 'fast';
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
    
    const wrapper = activeScreenIndex === 1 ? document.getElementById('device-wrapper-1') : document.getElementById('device-wrapper-2');
    wrapper.className = 'device-viewport';
    if (currentDevice === 'mobile') wrapper.classList.add('mode-mobile');
    if (currentDevice === 'tablet') wrapper.classList.add('mode-tablet');
    deviceMenu.classList.remove('active');
  });
});

/* URL Processing */
const proxyGoBtn = document.getElementById('proxy-go');

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (!query.includes('.') || query.includes(' ')) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }
  if (/^https?:\/\//i.test(query)) return query;
  return 'https://' + query;
}

window.launchProxy = function(rawInput) {
  gamesModal.classList.add('hidden');
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}&device=${currentDevice}`;
  
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

  const activeIframe = activeScreenIndex === 1 ? proxyIframe1 : proxyIframe2;
  activeIframe.src = proxyUrl;
  renderTabs();
};

proxyGoBtn.addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    launchProxy(proxyInput.value);
  }
});

/* Drifting Background Stars Canvas */
const bgCanvas = document.getElementById('bg-stars');
const bgCtx = bgCanvas.getContext('2d');
let stars = [];

function resizeBg() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBg);
resizeBg();

for (let i = 0; i < 110; i++) {
  stars.push({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    size: Math.random() * 3 + 1,
    speed: Math.random() * 0.4 + 0.1,
    rot: Math.random() * Math.PI,
    rotSpeed: (Math.random() - 0.5) * 0.02
  });
}

function drawBgStars() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgCtx.fillStyle = '#ffffff';
  stars.forEach(s => {
    s.x += s.speed;
    s.rot += s.rotSpeed;
    if (s.x > bgCanvas.width) s.x = 0;
    
    bgCtx.save();
    bgCtx.translate(s.x, s.y);
    bgCtx.rotate(s.rot);
    bgCtx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    bgCtx.restore();
  });
  requestAnimationFrame(drawBgStars);
}
drawBgStars();

/* Bigger & Slower Spinning Central Star Canvas with True Difference Inversion */
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let angle = 0, floatTime = 0;

function drawStarCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  
  floatTime += 0.01;
  const floatX = Math.sin(floatTime) * 6;
  const floatY = Math.cos(floatTime * 0.8) * 6;

  ctx.translate(canvas.width / 2 + floatX, canvas.height / 2 + floatY);
  ctx.rotate(angle);

  // Big white star. Renders over bg-stars inside .star-blend-layer (mix-blend-mode: difference),
  // causing background white pixels to invert to black where covered.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.lineTo(0, -180);
    ctx.rotate(Math.PI / 4);
    ctx.lineTo(0, -65);
    ctx.rotate(Math.PI / 4);
  }
  ctx.closePath();
  ctx.fill();

  const trailSegments = 12;
  for (let t = 1; t <= trailSegments; t++) {
    ctx.save();
    ctx.rotate(-t * 0.012);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * (1 - t / trailSegments)})`;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(0, -186);
      ctx.rotate(Math.PI / 4);
      ctx.lineTo(0, -68);
      ctx.rotate(Math.PI / 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  angle += 0.0015; // Very slow rotation
  requestAnimationFrame(drawStarCanvas);
}
drawStarCanvas();

/* Settings Saving */
document.getElementById('gui-scale-slider').addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--gui-scale', e.target.value);
  document.getElementById('gui-scale-val').textContent = parseFloat(e.target.value).toFixed(2) + 'x';
});

document.getElementById('save-settings').addEventListener('click', () => {
  const scale = document.getElementById('gui-scale-slider').value;
  localStorage.setItem('miksi_scale', scale);
  loadSettings();
  settingsModal.classList.remove('active');
});

renderTabs();
