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

// Load saved settings
function loadSettings() {
  const scale = localStorage.getItem('miksi_scale') || '1.15';
  document.documentElement.style.setProperty('--gui-scale', scale);
  document.getElementById('gui-scale-slider').value = scale;
  document.getElementById('gui-scale-val').textContent = parseFloat(scale).toFixed(2) + 'x';

  const bgColor = localStorage.getItem('miksi_bg') || '#121212';
  document.documentElement.style.setProperty('--bg', bgColor);
  document.getElementById('bg-color-picker').value = bgColor;

  const accentColor = localStorage.getItem('miksi_accent') || '#ffffff';
  document.documentElement.style.setProperty('--accent', accentColor);
  document.getElementById('accent-color-picker').value = accentColor;
}
loadSettings();

// Update logs modal on first load
if (!localStorage.getItem('miksi_welcomed')) {
  document.getElementById('update-modal').classList.remove('hidden');
}
document.getElementById('close-update-modal').addEventListener('click', () => {
  localStorage.setItem('miksi_welcomed', 'true');
  document.getElementById('update-modal').classList.add('hidden');
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

/* Sidebar Actions */
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

sbGames.addEventListener('click', () => gamesModal.classList.remove('hidden'));
gamesClose.addEventListener('click', () => gamesModal.classList.add('hidden'));
sbSettings.addEventListener('click', () => settingsModal.classList.add('active'));
modalClose.addEventListener('click', () => settingsModal.classList.remove('active'));

/* Mobile & Mouse Touch Dragging */
const modal = document.getElementById('settings-modal');
const dragHandle = document.getElementById('modal-drag-handle');
let isDragging = false, startX, startY, initialX, initialY;

function startDrag(e) {
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  startX = clientX;
  startY = clientY;
  const rect = modal.getBoundingClientRect();
  initialX = rect.left;
  initialY = rect.top;
}

function moveDrag(e) {
  if (!isDragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - startX;
  const dy = clientY - startY;
  modal.style.left = (initialX + dx) + 'px';
  modal.style.top = (initialY + dy) + 'px';
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

/* Rotating Footer Text */
const footerQuotes = [
  "man i love fern",
  "boii this so tuff",
  "Made with vercel the goat",
  "kamran made this, whos that?",
  "why is fast better than strong ???"
];
let quoteIndex = 0;
const footerCredit = document.getElementById('footer-credit');
footerCredit.addEventListener('click', () => {
  quoteIndex = (quoteIndex + 1) % footerQuotes.length;
  footerCredit.textContent = footerQuotes[quoteIndex];
});

/* Bottom Dropdown Menus & Hardware Mapping */
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const currentModeLabel = document.getElementById('current-mode-label');

const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const currentDeviceLabel = document.getElementById('current-device-label');
const deviceWrapper = document.getElementById('device-wrapper');

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
    deviceWrapper.className = 'device-viewport';
    if (currentDevice === 'mobile') deviceWrapper.classList.add('mode-mobile');
    if (currentDevice === 'tablet') deviceWrapper.classList.add('mode-tablet');
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

/* Dynamic Background Stars Canvas */
const bgCanvas = document.getElementById('bg-stars');
const bgCtx = bgCanvas.getContext('2d');
let stars = [];

function resizeBg() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBg);
resizeBg();

for (let i = 0; i < 80; i++) {
  stars.push({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    size: Math.random() * 2.5 + 0.5,
    speed: Math.random() * 0.8 + 0.2,
    rot: Math.random() * Math.PI,
    rotSpeed: (Math.random() - 0.5) * 0.05
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

/* Conway's Game of Life Overlay */
const lifeCanvas = document.getElementById('life-canvas');
const lifeCtx = lifeCanvas.getContext('2d');
const gridCols = 40, gridRows = 40, cellSize = 8;
let grid = Array(gridCols).fill(null).map(() => Array(gridRows).fill(0));

for (let x = 0; x < gridCols; x++) {
  for (let y = 0; y < gridRows; y++) {
    grid[x][y] = Math.random() > 0.85 ? 1 : 0;
  }
}

function drawLife() {
  lifeCtx.clearRect(0, 0, lifeCanvas.width, lifeCanvas.height);
  lifeCtx.fillStyle = '#ffffff';
  let next = grid.map(arr => [...arr]);

  for (let x = 0; x < gridCols; x++) {
    for (let y = 0; y < gridRows; y++) {
      let neighbors = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          let nx = (x + i + gridCols) % gridCols;
          let ny = (y + j + gridRows) % gridRows;
          neighbors += grid[nx][ny];
        }
      }
      if (grid[x][y] === 1 && (neighbors < 2 || neighbors > 3)) next[x][y] = 0;
      else if (grid[x][y] === 0 && neighbors === 3) next[x][y] = 1;

      if (grid[x][y] === 1) lifeCtx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
    }
  }
  grid = next;
  setTimeout(() => requestAnimationFrame(drawLife), 200);
}
drawLife();

/* Star Canvas with Sine Float & Trails */
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let angle = 0, floatTime = 0;

function drawStarCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  
  floatTime += 0.03;
  const floatX = Math.sin(floatTime) * 12;
  const floatY = Math.cos(floatTime * 0.8) * 12;

  ctx.translate(canvas.width / 2 + floatX, canvas.height / 2 + floatY);
  ctx.rotate(angle);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.lineTo(0, -90);
    ctx.rotate(Math.PI / 4);
    ctx.lineTo(0, -30);
    ctx.rotate(Math.PI / 4);
  }
  ctx.closePath();
  ctx.fill();

  const trailSegments = 10;
  for (let t = 1; t <= trailSegments; t++) {
    ctx.save();
    ctx.rotate(-t * 0.025);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.18 * (1 - t / trailSegments)})`;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(0, -96);
      ctx.rotate(Math.PI / 4);
      ctx.lineTo(0, -32);
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

/* Settings Saving */
document.getElementById('gui-scale-slider').addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--gui-scale', e.target.value);
  document.getElementById('gui-scale-val').textContent = parseFloat(e.target.value).toFixed(2) + 'x';
});

document.getElementById('save-settings').addEventListener('click', () => {
  const scale = document.getElementById('gui-scale-slider').value;
  const bg = document.getElementById('bg-color-picker').value;
  const accent = document.getElementById('accent-color-picker').value;

  localStorage.setItem('miksi_scale', scale);
  localStorage.setItem('miksi_bg', bg);
  localStorage.setItem('miksi_accent', accent);

  loadSettings();
  settingsModal.classList.remove('active');
});
