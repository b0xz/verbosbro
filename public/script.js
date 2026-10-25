if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_DATA_VERSION = 'v15_satura';
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

const IP_POOL = [
  { ip: '198.51.100.42', loc: 'US East' },
  { ip: '85.214.132.11', loc: 'Germany' },
  { ip: '202.12.29.11', loc: 'Japan' },
  { ip: '54.240.196.18', loc: 'US West' },
  { ip: '203.0.113.195', loc: 'UK' }
];

function getRandomIp() {
  return IP_POOL[Math.floor(Math.random() * IP_POOL.length)];
}

let tabs = [{ id: 1, title: 'new tab', url: '', src: 'about:blank', ipObj: getRandomIp() }];
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
const loadingSpinner = document.getElementById('loading-spinner');

function showSpinner() { if (loadingSpinner) loadingSpinner.classList.remove('hidden'); }
function hideSpinner() { if (loadingSpinner) loadingSpinner.classList.add('hidden'); }

if (proxyViewer) proxyViewer.addEventListener('load', hideSpinner);

/* Top-Right IP Widget */
const ipWidgetToggle = document.getElementById('ip-widget-toggle');
const ipDropdownMenu = document.getElementById('ip-dropdown-menu');
const currentIpDisplay = document.getElementById('current-ip-display');

if (ipWidgetToggle && ipDropdownMenu) {
  ipWidgetToggle.onclick = (e) => {
    e.stopPropagation();
    ipDropdownMenu.classList.toggle('active');
  };
  document.addEventListener('click', () => ipDropdownMenu.classList.remove('active'));
}

window.changeUserIp = function(ip, loc) {
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.ipObj = { ip, loc };
    if (currentIpDisplay) currentIpDisplay.textContent = `${ip} (${loc})`;
  }
  if (ipDropdownMenu) ipDropdownMenu.classList.remove('active');
};

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
    if (currentIpDisplay) currentIpDisplay.textContent = `${tab.ipObj.ip} (${tab.ipObj.loc})`;
    hideAllPages();

    if (tab.src === 'about:blank' || !tab.url) {
      if (proxyViewerContainer) proxyViewerContainer.classList.remove('active');
      if (homeView) homeView.classList.remove('hidden');
      if (proxyViewer) proxyViewer.src = 'about:blank';
    } else {
      if (homeView) homeView.classList.add('hidden');
      if (proxyViewerContainer) proxyViewerContainer.classList.add('active');
      if (proxyViewer) proxyViewer.src = tab.src;
    }
  }
  renderTabs();
}

function addTab(url = '', src = 'about:blank', title = 'new tab') {
  const newId = Date.now();
  const assignedIp = getRandomIp();
  tabs.push({ id: newId, title, url, src, ipObj: assignedIp });
  switchTab(newId);
}

window.closeTab = function(id) {
  if (tabs.length === 1) {
    tabs[0] = { id: Date.now(), title: 'new tab', url: '', src: 'about:blank', ipObj: getRandomIp() };
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

/* Sidebar Navigation */
document.getElementById('sb-home')?.addEventListener('click', () => {
  hideAllPages();
  if (homeView) homeView.classList.remove('hidden');
  document.getElementById('sb-home').classList.add('active');
});

document.getElementById('sb-chat')?.addEventListener('click', () => {
  hideAllPages();
  if (chatPageView) chatPageView.classList.add('active');
  document.getElementById('sb-chat').classList.add('active');
  if (window.initChat) window.initChat();
});

document.getElementById('sb-games')?.addEventListener('click', () => {
  hideAllPages();
  if (gamesPageView) gamesPageView.classList.add('active');
  document.getElementById('sb-games').classList.add('active');
});

document.getElementById('sb-settings')?.addEventListener('click', () => {
  hideAllPages();
  if (settingsPageView) settingsPageView.classList.add('active');
  document.getElementById('sb-settings').classList.add('active');
});

/* Proxy Execution */
let currentMode = 'fast';
let currentDevice = 'desktop';
let currentVpn = 'us-east';

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
  const simIp = currentTab ? currentTab.ipObj.ip : '192.168.1.102';
  
  const encodedToken = btoa(encodeURIComponent(targetUrl)).replace(/=/g, '');
  const proxyUrl = `/api/proxy?token=${encodedToken}&mode=${currentMode}&device=${currentDevice}&vpn=${currentVpn}&sim_ip=${simIp}`;
  
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  if (proxyInput) proxyInput.value = targetUrl;
  hideAllPages();
  if (proxyViewerContainer) proxyViewerContainer.classList.add('active');
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

/* Background Canvas Modes (Stars vs 3D Shader) */
const bgModeSelect = document.getElementById('bg-mode-select');
const shaderCanvas = document.getElementById('shader-canvas');
const starCanvas = document.getElementById('star-canvas');

function applyBgMode(mode) {
  localStorage.setItem('satura_bg_mode', mode);
  if (mode === 'shader') {
    if (starCanvas) starCanvas.style.display = 'none';
    if (shaderCanvas) {
      shaderCanvas.style.display = 'block';
      initShaderCanvas();
    }
  } else {
    if (shaderCanvas) shaderCanvas.style.display = 'none';
    if (starCanvas) starCanvas.style.display = 'block';
  }
}

if (bgModeSelect) {
  bgModeSelect.addEventListener('change', (e) => applyBgMode(e.target.value));
  bgModeSelect.value = localStorage.getItem('satura_bg_mode') || 'stars';
}
applyBgMode(localStorage.getItem('satura_bg_mode') || 'stars');

/* Star Engine */
const starCtx = starCanvas ? starCanvas.getContext('2d') : null;
let angle = 0, floatTime = 0;
const backgroundStars = Array.from({ length: 60 }, () => ({
  x: Math.random() * 550,
  y: Math.random() * 550,
  radius: Math.random() * 2 + 1,
  speed: Math.random() * 1.5 + 0.5
}));

function drawStarEngine() {
  if (!starCanvas || starCanvas.style.display === 'none') {
    requestAnimationFrame(drawStarEngine);
    return;
  }

  starCanvas.width = 550;
  starCanvas.height = 550;
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.save();

  floatTime += 0.012;
  const centerX = starCanvas.width * 0.5 + Math.sin(floatTime) * 6;
  const centerY = starCanvas.height * 0.5 + Math.cos(floatTime * 0.8) * 6;
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

/* Interactive 3D Shader Engine */
let shaderInitialized = false;
let draggableObjects = [];
let isDragging = false;
let draggedObj = null;

function initShaderCanvas() {
  if (shaderInitialized || !shaderCanvas) return;
  shaderInitialized = true;

  const ctx = shaderCanvas.getContext('2d');
  shaderCanvas.width = 550;
  shaderCanvas.height = 550;

  draggableObjects = [
    { x: 275, y: 220, r: 45, color: '#ffffff', label: 'sphere' },
    { x: 180, y: 320, r: 25, color: '#06b6d4', label: 'orb' }
  ];

  let dragOffsetX = 0;
  let dragOffsetY = 0;

  shaderCanvas.onmousedown = (e) => {
    const rect = shaderCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    draggableObjects.forEach(obj => {
      const dist = Math.hypot(mx - obj.x, my - obj.y);
      if (dist < obj.r) {
        isDragging = true;
        draggedObj = obj;
        dragOffsetX = mx - obj.x;
        dragOffsetY = my - obj.y;
      }
    });
  };

  shaderCanvas.onmousemove = (e) => {
    if (!isDragging || !draggedObj) return;
    const rect = shaderCanvas.getBoundingClientRect();
    draggedObj.x = e.clientX - rect.left - dragOffsetX;
    draggedObj.y = e.clientY - rect.top - dragOffsetY;
  };

  window.onmouseup = () => {
    isDragging = false;
    draggedObj = null;
  };

  function renderShader() {
    if (!shaderCanvas || shaderCanvas.style.display === 'none') {
      requestAnimationFrame(renderShader);
      return;
    }

    ctx.clearRect(0, 0, shaderCanvas.width, shaderCanvas.height);

    const groundGrad = ctx.createLinearGradient(0, 340, 0, 550);
    groundGrad.addColorStop(0, '#1f2937');
    groundGrad.addColorStop(1, '#030712');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 340, 550, 210);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 550; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 340);
      ctx.lineTo((i - 275) * 2 + 275, 550);
      ctx.stroke();
    }

    ctx.font = '900 48px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillText("satura", 320, 265);
    ctx.fillStyle = '#ffffff';
    ctx.fillText("satura", 318, 260);

    draggableObjects.forEach(obj => {
      const grad = ctx.createRadialGradient(
        obj.x - obj.r * 0.3,
        obj.y - obj.r * 0.3,
        obj.r * 0.1,
        obj.x,
        obj.y,
        obj.r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, obj.color);
      grad.addColorStop(1, '#000000');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(renderShader);
  }

  renderShader();
}

renderTabs();
