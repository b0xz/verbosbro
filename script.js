if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

const CURRENT_DATA_VERSION = 'v10_satura';
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

let tabs = [{ id: 1, title: 'new tab', url: '', src: 'about:blank' }];
let activeTabId = 1;

const tabBar = document.getElementById('tab-bar');
const addTabBtn = document.getElementById('add-tab-btn');
const proxyInput = document.getElementById('proxy-input');
const proxyViewer = document.getElementById('proxy-viewer');
const homeView = document.getElementById('home-view');
const chatPageView = document.getElementById('chat-page-view');
const audioPageView = document.getElementById('audio-page-view');
const gamesPageView = document.getElementById('games-page-view');
const settingsPageView = document.getElementById('settings-page-view');
const bottomNavWrapper = document.getElementById('bottom-nav-wrapper');
const proxyIframe1 = document.getElementById('proxy-iframe-1');
const loadingSpinner = document.getElementById('loading-spinner');

function showSpinner() { loadingSpinner.classList.remove('hidden'); }
function hideSpinner() { loadingSpinner.classList.add('hidden'); }

proxyIframe1.addEventListener('load', hideSpinner);

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
    hideAllPages();
    bottomNavWrapper.classList.remove('hidden');
    document.getElementById('sb-home').classList.add('active');

    if (tab.src === 'about:blank' || !tab.url) {
      proxyViewer.classList.remove('active');
      homeView.classList.remove('hidden');
      proxyIframe1.src = 'about:blank';
    } else {
      homeView.classList.add('hidden');
      proxyViewer.classList.add('active');
      proxyIframe1.src = tab.src;
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

addTabBtn.addEventListener('click', () => addTab());

function hideAllPages() {
  homeView.classList.add('hidden');
  proxyViewer.classList.remove('active');
  chatPageView.classList.remove('active');
  audioPageView.classList.remove('active');
  gamesPageView.classList.remove('active');
  settingsPageView.classList.remove('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
}

/* --- Swipe Transitions --- */
function triggerSwipeTransition(targetPageViewEl, callback) {
  const directions = ['left', 'right', 'up', 'down'];
  const chosenDir = directions[Math.floor(Math.random() * directions.length)];
  const swipeContainer = targetPageViewEl.querySelector('.swipe-container');

  let startTransform = '';
  if (chosenDir === 'left') startTransform = 'translateX(100%)';
  else if (chosenDir === 'right') startTransform = 'translateX(-100%)';
  else if (chosenDir === 'up') startTransform = 'translateY(100%)';
  else if (chosenDir === 'down') startTransform = 'translateY(-100%)';

  if (swipeContainer) {
    swipeContainer.style.transition = 'none';
    swipeContainer.style.transform = startTransform;
    swipeContainer.style.opacity = '0';
  }

  callback();
  targetPageViewEl.classList.add('active');

  setTimeout(() => {
    if (swipeContainer) {
      swipeContainer.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease';
      swipeContainer.style.transform = 'translate(0, 0)';
      swipeContainer.style.opacity = '1';
    }
  }, 20);
}

document.getElementById('sb-home').addEventListener('click', () => {
  hideAllPages();
  bottomNavWrapper.classList.remove('hidden');
  homeView.classList.remove('hidden');
  document.getElementById('sb-home').classList.add('active');
});

document.getElementById('sb-chat').addEventListener('click', () => {
  triggerSwipeTransition(chatPageView, () => {
    hideAllPages();
    chatPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-chat').classList.add('active');
    if (window.initChat) window.initChat();
  });
});

document.getElementById('sb-audio').addEventListener('click', () => {
  triggerSwipeTransition(audioPageView, () => {
    hideAllPages();
    audioPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-audio').classList.add('active');
    markNotifSeen('audio-badge');
  });
});

document.getElementById('sb-games').addEventListener('click', () => {
  triggerSwipeTransition(gamesPageView, () => {
    hideAllPages();
    gamesPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-games').classList.add('active');
  });
});

document.getElementById('sb-settings').addEventListener('click', () => {
  triggerSwipeTransition(settingsPageView, () => {
    hideAllPages();
    settingsPageView.classList.add('active');
    bottomNavWrapper.classList.add('hidden');
    document.getElementById('sb-settings').classList.add('active');
  });
});

/* --- Persistent Notifications --- */
function markNotifSeen(notifId) {
  localStorage.setItem(`satura_seen_${notifId}`, 'true');
  const badge = document.querySelector(`[data-notif-id="${notifId}"]`);
  if (badge) badge.remove();
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-notif-id]').forEach(badge => {
    const id = badge.getAttribute('data-notif-id');
    if (localStorage.getItem(`satura_seen_${id}`) === 'true') {
      badge.remove();
    }
  });
});

/* --- Cloak & Mobile Double Tap Uncloak --- */
let isCloaked = false;
let lastTapTime = 0;
const cloakNotice = document.getElementById('cloak-notice');

function toggleCloak(forceState) {
  isCloaked = typeof forceState === 'boolean' ? forceState : !isCloaked;
  if (isCloaked) {
    document.body.style.opacity = '0';
    cloakNotice.style.display = 'block';
  } else {
    document.body.style.opacity = '1';
    cloakNotice.style.display = 'none';
  }
}

document.getElementById('manual-cloak-btn').addEventListener('click', () => toggleCloak(true));

document.addEventListener('keydown', (e) => {
  if (e.key === '\\') {
    e.preventDefault();
    toggleCloak();
  }
});

document.addEventListener('touchend', () => {
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;
  if (tapLength < 300 && tapLength > 0 && isCloaked) {
    toggleCloak(false);
  }
  lastTapTime = currentTime;
});

/* --- Tooltips & Satura Hover Effect --- */
const globalTooltip = document.getElementById('global-tooltip');
const saturaTitleEl = document.getElementById('satura-title-el');

saturaTitleEl.addEventListener('mouseover', (e) => {
  globalTooltip.textContent = "*originally verbos";
  globalTooltip.style.display = 'block';
  positionTooltip(e);
});
saturaTitleEl.addEventListener('mousemove', (e) => {
  if (globalTooltip.style.display === 'block') positionTooltip(e);
});
saturaTitleEl.addEventListener('mouseout', () => {
  globalTooltip.style.display = 'none';
});

document.addEventListener('mouseover', (e) => {
  const notifBadge = e.target.closest('[data-tooltip-type="notif"]');
  const wipBadge = e.target.closest('[data-tooltip-type="wip"]');

  if (notifBadge) {
    globalTooltip.textContent = "! means newly added, and the logo disappears if you click it or use it or see it in some way";
    globalTooltip.style.display = 'block';
    positionTooltip(e);
  } else if (wipBadge) {
    globalTooltip.textContent = "the hammer logo means this is still being worked on. Will not disappear when seen / clicked";
    globalTooltip.style.display = 'block';
    positionTooltip(e);
  }
});

document.addEventListener('mousemove', (e) => {
  if (globalTooltip.style.display === 'block' && e.target !== saturaTitleEl) positionTooltip(e);
});

document.addEventListener('mouseout', (e) => {
  if (e.target.closest('[data-tooltip-type]')) globalTooltip.style.display = 'none';
});

function positionTooltip(e) {
  globalTooltip.style.left = (e.clientX + 12) + 'px';
  globalTooltip.style.top = (e.clientY + 12) + 'px';
}

document.addEventListener('click', (e) => {
  const notif = e.target.closest('.badge-notif');
  if (notif) {
    const id = notif.getAttribute('data-notif-id');
    if (id) markNotifSeen(id);
    else notif.remove();
    globalTooltip.style.display = 'none';
  }
});

let currentMode = 'fast';
let currentDevice = 'desktop';
let currentVpn = 'us-east';

const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const vpnToggleBtn = document.getElementById('vpn-toggle-btn');
const vpnMenu = document.getElementById('vpn-menu');

modeToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); deviceMenu.classList.remove('active'); vpnMenu.classList.remove('active'); modeMenu.classList.toggle('active'); });
deviceToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); modeMenu.classList.remove('active'); vpnMenu.classList.remove('active'); deviceMenu.classList.toggle('active'); });
vpnToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); modeMenu.classList.remove('active'); deviceMenu.classList.remove('active'); vpnMenu.classList.toggle('active'); });
document.addEventListener('click', () => { modeMenu.classList.remove('active'); deviceMenu.classList.remove('active'); vpnMenu.classList.remove('active'); });

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
  const currentIp = localStorage.getItem('satura_simulated_ip') || '192.168.1.102';
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}&device=${currentDevice}&vpn=${currentVpn}&sim_ip=${currentIp}`;
  
  const currentTab = tabs.find(t => t.id === activeTabId);
  if (currentTab) {
    currentTab.url = targetUrl;
    currentTab.src = proxyUrl;
    try { currentTab.title = new URL(targetUrl).hostname; } catch(e) { currentTab.title = targetUrl; }
  }

  proxyInput.value = targetUrl;
  hideAllPages();
  bottomNavWrapper.classList.remove('hidden');
  proxyViewer.classList.add('active');

  proxyIframe1.src = proxyUrl;
  renderTabs();
};

document.getElementById('proxy-go').addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); launchProxy(proxyInput.value); } });

/* --- SoundCloud Discovery & Audio Player --- */
const samplePlaylist = [
  { title: "lofi study chill beat 01", stream: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { title: "ambient synthwave vibe 02", stream: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { title: "cyberpunk nocturnal groove 03", stream: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { title: "retro cassette loop 04", stream: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { title: "interstellar synth journey 05", stream: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" }
];

const randomSongsList = document.getElementById('random-songs-list');
const nowPlayingTitle = document.getElementById('now-playing-title');
const scLoadBtn = document.getElementById('sc-load-btn');
const scUrlInput = document.getElementById('sc-url-input');
const audioElement = document.getElementById('audio-element');

function renderPlaylist() {
  if (!randomSongsList) return;
  randomSongsList.innerHTML = samplePlaylist.map((song, idx) => `
    <div class="song-card" onclick="playSong(${idx})">
      <span>🎵 ${song.title}</span>
      <span style="font-size:0.75rem; color:var(--subtext);">play</span>
    </div>
  `).join('');
}
renderPlaylist();

window.playSong = function(index) {
  const song = samplePlaylist[index];
  if (!song) return;
  audioElement.src = song.stream;
  audioElement.play();
  nowPlayingTitle.textContent = `now playing: ${song.title}`;
};

scLoadBtn.addEventListener('click', () => {
  const trackUrl = scUrlInput.value.trim();
  if (!trackUrl) {
    alert("please enter a soundcloud track link!");
    return;
  }
  const randomSong = samplePlaylist[Math.floor(Math.random() * samplePlaylist.length)];
  audioElement.src = randomSong.stream;
  audioElement.play();
  nowPlayingTitle.textContent = `loaded: ${trackUrl.split('/').pop() || 'soundcloud track'}`;
});

document.getElementById('share-playlist-btn').addEventListener('click', async () => {
  const playlistText = `🎵 my satura playlist:\n` + samplePlaylist.map(s => `- ${s.title}`).join('\n');
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.value = playlistText;
  document.getElementById('sb-chat').click();
  alert("playlist loaded into chat input! press send to share.");
});

/* --- Themes & Settings --- */
const DARK_THEMES = {
  obsidian: { bg: '#000000', panel: '#000000', border: '#ffffff', accent: '#ffffff', hover: '#141414' },
  crimson: { bg: '#120305', panel: '#21080b', border: '#3d1217', accent: '#ef4444', hover: '#2f0c11' },
  emerald: { bg: '#02120d', panel: '#082119', border: '#133a2d', accent: '#10b981', hover: '#0f3327' },
  amethyst: { bg: '#0b0614', panel: '#150c26', border: '#2d1b4d', accent: '#8b5cf6', hover: '#22133d' },
  amber: { bg: '#120c02', panel: '#211808', border: '#3d2b12', accent: '#f59e0b', hover: '#2f210e' },
  ghost: { bg: '#090a0f', panel: '#13151c', border: '#2a2e3d', accent: '#94a3b8', hover: '#1c1f2b' },
  cyberpunk: { bg: '#030712', panel: '#0f172a', border: '#06b6d4', accent: '#06b6d4', hover: '#1e293b' },
  matrix: { bg: '#020b05', panel: '#051b0f', border: '#22c55e', accent: '#22c55e', hover: '#0d2e1a' },
  coffee: { bg: '#1c140f', panel: '#291d17', border: '#d97706', accent: '#d97706', hover: '#3d2b21' }
};

function applyTheme(key) {
  const t = DARK_THEMES[key] || DARK_THEMES.obsidian;
  const root = document.documentElement;
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--panel', t.panel);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--hover', t.hover);
  localStorage.setItem('satura_theme', key);
}

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    applyTheme(card.getAttribute('data-theme'));
  });
});
applyTheme(localStorage.getItem('satura_theme') || 'obsidian');

const searchPosSelect = document.getElementById('search-pos-select');
function applySearchPos(pos) {
  const wrapper = document.getElementById('bottom-nav-wrapper');
  if (pos === 'top') {
    wrapper.classList.add('top-search-pos');
  } else {
    wrapper.classList.remove('top-search-pos');
  }
  localStorage.setItem('satura_search_pos', pos);
}
searchPosSelect.value = localStorage.getItem('satura_search_pos') || 'bottom';
applySearchPos(searchPosSelect.value);
searchPosSelect.addEventListener('change', () => applySearchPos(searchPosSelect.value));

const uiOutlinesSelect = document.getElementById('ui-outlines-select');
function applyUiOutlines(val) {
  const root = document.documentElement;
  if (val === 'disabled') {
    root.style.setProperty('--panel-border', 'none');
    root.style.setProperty('--border-radius', '0px');
  } else {
    root.style.setProperty('--panel-border', '1px solid var(--border)');
    root.style.setProperty('--border-radius', '12px');
  }
  localStorage.setItem('satura_ui_outlines', val);
}
uiOutlinesSelect.value = localStorage.getItem('satura_ui_outlines') || 'enabled';
applyUiOutlines(uiOutlinesSelect.value);
uiOutlinesSelect.addEventListener('change', () => applyUiOutlines(uiOutlinesSelect.value));

const guiScaleSlider = document.getElementById('gui-scale-slider');
const guiScaleVal = document.getElementById('gui-scale-val');
function applyGuiScale(val) {
  document.documentElement.style.setProperty('--gui-scale', val);
  guiScaleVal.textContent = val;
  localStorage.setItem('satura_gui_scale', val);
}
const savedScale = localStorage.getItem('satura_gui_scale') || '1.15';
guiScaleSlider.value = savedScale;
applyGuiScale(savedScale);
guiScaleSlider.addEventListener('input', (e) => applyGuiScale(e.target.value));

/* --- Modals Handling --- */
const profileModal = document.getElementById('profile-modal');
const bookmarksModal = document.getElementById('bookmarks-modal');

document.getElementById('sb-bookmarks').addEventListener('click', () => bookmarksModal.classList.remove('hidden'));
document.getElementById('close-bookmarks').addEventListener('click', () => bookmarksModal.classList.add('hidden'));

document.getElementById('sb-profile').addEventListener('click', () => profileModal.classList.remove('hidden'));
document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.add('hidden'));

const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const profilePfpInput = document.getElementById('profile-pfp');
const profileFileInput = document.getElementById('profile-file-input');
const profileFontSelect = document.getElementById('profile-font');
const profileAnimSelect = document.getElementById('profile-anim');
const profileColorInput = document.getElementById('profile-color');
const pfpInitial = document.getElementById('pfp-initial');
const pfpImg = document.getElementById('pfp-img');

function loadProfile() {
  const name = localStorage.getItem('satura_user_name');
  const bio = localStorage.getItem('satura_user_bio');
  const pfp = localStorage.getItem('satura_user_pfp');
  const font = localStorage.getItem('satura_chat_font');
  const anim = localStorage.getItem('satura_username_anim') || 'none';
  const color = localStorage.getItem('satura_user_color');

  profileNameInput.value = name;
  profileBioInput.value = bio;
  if (!pfp.startsWith('data:')) profilePfpInput.value = pfp;
  profileFontSelect.value = font;
  profileAnimSelect.value = anim;
  profileColorInput.value = color;

  if (pfp && (pfp.startsWith('http') || pfp.startsWith('data:'))) {
    pfpImg.src = pfp;
    pfpImg.classList.remove('hidden');
    pfpInitial.classList.add('hidden');
  } else {
    pfpInitial.textContent = name.charAt(0).toUpperCase();
    pfpImg.classList.add('hidden');
    pfpInitial.classList.remove('hidden');
  }
}

profileFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 200 * 1024) {
      alert("image is too large! choose an image under 200kb.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
      profilePfpInput.value = uploadEvent.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('save-profile').addEventListener('click', async () => {
  const name = profileNameInput.value.trim();
  if (!name) {
    alert("display name cannot be empty!");
    return;
  }
  
  try {
    const res = await fetch('/api/chat?type=users');
    if (res.ok) {
      const users = await res.json();
      const currentStoredName = localStorage.getItem('satura_user_name');
      if (users.includes(name) && name !== currentStoredName) {
        alert("this display name is already taken!");
        return;
      }
    }
  } catch (e) {}

  const bio = profileBioInput.value.trim() || 'exploring the web with satura.';
  const pfp = profilePfpInput.value.trim() || '⭐';
  const font = profileFontSelect.value;
  const anim = profileAnimSelect.value;
  const color = profileColorInput.value;

  localStorage.setItem('satura_user_name', name);
  localStorage.setItem('satura_user_bio', bio);
  localStorage.setItem('satura_user_pfp', pfp);
  localStorage.setItem('satura_chat_font', font);
  localStorage.setItem('satura_username_anim', anim);
  localStorage.setItem('satura_user_color', color);

  loadProfile();
  profileModal.classList.add('hidden');
});
loadProfile();

/* --- Cloak Presets & IP --- */
const CLOAK_PRESETS = {
  satura: {
    title: 'satura',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23000'/><path d='M50 80 C50 60, 45 40, 35 30 M50 60 C55 45, 65 35, 75 25' stroke='%23fff' stroke-width='4' fill='none'/><circle cx='35' cy='30' r='6' fill='%23ffb7c5'/><circle cx='75' cy='25' r='8' fill='%23ffb7c5'/><circle cx='45' cy='20' r='5' fill='%23ffb7c5'/><circle cx='60' cy='40' r='6' fill='%23ffb7c5'/></svg>"
  },
  google: { title: 'Google', favicon: 'https://www.google.com/favicon.ico' },
  khan: { title: 'Dashboard | Khan Academy', favicon: 'https://www.khanacademy.org/favicon.ico' },
  drive: { title: 'My Drive - Google Drive', favicon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
  canvas: { title: 'Dashboard', favicon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico' }
};

const tabCloakSelect = document.getElementById('tab-cloak-preset');
const customTitleInput = document.getElementById('custom-title-input');

function applyCloakPreset(presetKey) {
  const preset = CLOAK_PRESETS[presetKey] || CLOAK_PRESETS.satura;
  document.getElementById('tab-title').textContent = customTitleInput.value || preset.title;
  document.getElementById('tab-favicon').href = preset.favicon;
  localStorage.setItem('satura_cloak_preset', presetKey);
}

tabCloakSelect.addEventListener('change', (e) => applyCloakPreset(e.target.value));
customTitleInput.addEventListener('input', () => applyCloakPreset(tabCloakSelect.value));

document.getElementById('randomize-ip-btn').addEventListener('click', () => {
  const randIp = `${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254 + 1)}`;
  localStorage.setItem('satura_simulated_ip', randIp);
  alert(`Simulated IP updated to: ${randIp}`);
});

/* --- Star Canvas Engine --- */
const starCanvas = document.getElementById('star-canvas');
const starCtx = starCanvas.getContext('2d');
let angle = 0, floatTime = 0;

function drawStarLogo() {
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  starCtx.save();
  floatTime += 0.01;
  const centerX = starCanvas.width * 0.5 + Math.sin(floatTime) * 5;
  const centerY = starCanvas.height * 0.5 + Math.cos(floatTime * 0.8) * 5;
  starCtx.translate(centerX, centerY);
  starCtx.rotate(angle);
  
  starCtx.fillStyle = '#ffffff';
  starCtx.beginPath();
  for (let i = 0; i < 4; i++) { 
    starCtx.lineTo(0, -95); 
    starCtx.rotate(Math.PI * 0.25); 
    starCtx.lineTo(0, -38); 
    starCtx.rotate(Math.PI * 0.25); 
  }
  starCtx.closePath(); 
  starCtx.fill();
  starCtx.restore();

  angle += 0.0015;
  requestAnimationFrame(drawStarLogo);
}
drawStarLogo();
renderTabs();
