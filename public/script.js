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
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const gamesPageView = document.getElementById('games-page-view');
const settingsPageView = document.getElementById('settings-page-view');

/* Top IP Widget handling */
const ipWidgetToggle = document.getElementById('ip-widget-toggle');
const ipDropdownMenu = document.getElementById('ip-dropdown-menu');
const currentIpDisplay = document.getElementById('current-ip-display');

ipWidgetToggle.onclick = (e) => {
  e.stopPropagation();
  ipDropdownMenu.classList.toggle('active');
};
document.addEventListener('click', () => ipDropdownMenu.classList.remove('active'));

window.changeUserIp = function(ip, loc) {
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.ipObj = { ip, loc };
    currentIpDisplay.textContent = `${ip} (${loc})`;
  }
  ipDropdownMenu.classList.remove('active');
};

function renderTabs() {
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
    proxyInput.value = tab.url;
    currentIpDisplay.textContent = `${tab.ipObj.ip} (${tab.ipObj.loc})`;
    hideAllPages();

    if (tab.src === 'about:blank' || !tab.url) {
      proxyViewer.classList.remove('active');
      homeView.classList.add('active');
      proxyViewer.src = 'about:blank';
    } else {
      homeView.classList.remove('active');
      proxyViewer.classList.add('active');
      proxyViewer.src = tab.src;
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

addTabBtn.addEventListener('click', () => addTab());

function hideAllPages() {
  homeView.classList.remove('active');
  proxyViewer.classList.remove('active');
  chatPageView.classList.remove('active');
  gamesPageView.classList.remove('active');
  settingsPageView.classList.remove('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
}

document.getElementById('sb-home').addEventListener('click', () => { hideAllPages(); homeView.classList.add('active'); document.getElementById('sb-home').classList.add('active'); });
document.getElementById('sb-chat').addEventListener('click', () => { hideAllPages(); chatPageView.classList.add('active'); document.getElementById('sb-chat').classList.add('active'); if (window.initChat) window.initChat(); });
document.getElementById('sb-games').addEventListener('click', () => { hideAllPages(); gamesPageView.classList.add('active'); document.getElementById('sb-games').classList.add('active'); });
document.getElementById('sb-settings').addEventListener('click', () => { hideAllPages(); settingsPageView.classList.add('active'); document.getElementById('sb-settings').classList.add('active'); });

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
  const simIp = currentTab ? currentTab.ipObj.ip : '192.168.1.102';
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&sim_ip=${simIp}`;
  
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  proxyInput.value = targetUrl;
  hideAllPages();
  proxyViewer.classList.add('active');
  proxyViewer.src = proxyUrl;
  renderTabs();
};

document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); } });

/* Background Canvas & Shader Settings */
const bgModeSelect = document.getElementById('bg-mode-select');
const shaderCanvas = document.getElementById('shader-canvas');
const starCanvas = document.getElementById('star-canvas');

function applyBgMode(mode) {
  localStorage.setItem('satura_bg_mode', mode);
  if (mode === 'shader') {
    starCanvas.style.display = 'none';
    shaderCanvas.style.display = 'block';
  } else {
    shaderCanvas.style.display = 'none';
    starCanvas.style.display = 'block';
  }
}
if (bgModeSelect) {
  bgModeSelect.addEventListener('change', (e) => applyBgMode(e.target.value));
  bgModeSelect.value = localStorage.getItem('satura_bg_mode') || 'stars';
}
applyBgMode(localStorage.getItem('satura_bg_mode') || 'stars');

/* Star Engine */
const starCtx = starCanvas.getContext('2d');
let angle = 0, floatTime = 0;
const backgroundStars = Array.from({ length: 60 }, () => ({
  x: Math.random() * 600, y: Math.random() * 600, radius: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5
}));

function drawStarEngine() {
  if (starCanvas.style.display === 'none') { requestAnimationFrame(drawStarEngine); return; }
  starCanvas.width = 600; starCanvas.height = 600;
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.save();

  floatTime += 0.012;
  const centerX = starCanvas.width * 0.5 + Math.sin(floatTime) * 6;
  const centerY = starCanvas.height * 0.5 + Math.cos(floatTime * 0.8) * 6;

  backgroundStars.forEach(star => {
    star.x += star.speed;
    if (star.x > starCanvas.width) { star.x = 0; star.y = Math.random() * starCanvas.height; }
    const isInverted = Math.hypot(star.x - centerX, star.y - centerY) < 54;
    starCtx.fillStyle = isInverted ? '#000000' : '#ffffff';
    starCtx.beginPath(); starCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2); starCtx.fill();
  });

  starCtx.translate(centerX, centerY); starCtx.rotate(angle);
  starCtx.fillStyle = '#ffffff'; starCtx.beginPath();
  for (let i = 0; i < 4; i++) { starCtx.lineTo(0, -135); starCtx.rotate(Math.PI * 0.25); starCtx.lineTo(0, -54); starCtx.rotate(Math.PI * 0.25); }
  starCtx.closePath(); starCtx.fill(); starCtx.restore();

  angle += 0.0015;
  requestAnimationFrame(drawStarEngine);
}
drawStarEngine();
renderTabs();
