/* ===================================================
   MIKSI CLIENT CONTROLLER
   =================================================== */
const EDUCATIONAL_PRESETS = {
  none: { title: 'miksi', icon: 'https://www.bing.com/th/id/OIP.cS6NYrx4o3zr-locEJ1AxwHaHa?w=205&h=205&c=8&rs=1&qlt=90&o=6&dpr=1.1&pid=3.1&rm=2' },
  canvas: { title: 'Dashboard - Canvas', icon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico' },
  classroom: { title: 'Classes', icon: 'https://ssl.gstatic.com/classroom/favicon.png' },
  drive: { title: 'My Drive - Google Drive', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
  docs: { title: 'Google Docs', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
  edpuzzle: { title: 'Edpuzzle', icon: 'https://edpuzzle.imgix.net/edpuzzle-logo-icon.png?w=32' },
  quizlet: { title: 'Flashcards, learning tools, and textbook solutions | Quizlet', icon: 'https://assets.quizlet.com/a-s/j/favicon.ico' },
  clever: { title: 'Clever | Portal', icon: 'https://assets.clever.com/assets/favicon.ico' },
  schoology: { title: 'Home | Schoology', icon: 'https://www.schoology.com/sites/default/files/favicon.ico' },
  khan: { title: 'Dashboard | Khan Academy', icon: 'https://www.khanacademy.org/favicon.ico' },
  desmos: { title: 'Desmos | Graphing Calculator', icon: 'https://www.desmos.com/favicon.ico' }
};

const tabTitleEl = document.getElementById('tab-title');
const tabFaviconEl = document.getElementById('tab-favicon');

function applyTabDisguise(title, iconUrl) {
  tabTitleEl.textContent = title;
  tabFaviconEl.href = iconUrl;
}

function loadSavedDisguise() {
  const savedKey = localStorage.getItem('miksi_disguise_preset') || 'canvas';
  const customTitle = localStorage.getItem('miksi_custom_title');
  const customIcon = localStorage.getItem('miksi_custom_icon');

  if (savedKey === 'custom' && customTitle && customIcon) {
    applyTabDisguise(customTitle, customIcon);
  } else if (EDUCATIONAL_PRESETS[savedKey]) {
    const preset = EDUCATIONAL_PRESETS[savedKey];
    applyTabDisguise(preset.title, preset.icon);
  }
}
loadSavedDisguise();

/* GUI Scale Settings */
const guiScaleSlider = document.getElementById('gui-scale-slider');
const guiScaleVal = document.getElementById('gui-scale-val');

function applyGuiScale(scale) {
  document.documentElement.style.setProperty('--gui-scale', scale);
  guiScaleVal.textContent = parseFloat(scale).toFixed(2) + 'x';
}

const savedScale = localStorage.getItem('miksi_gui_scale') || '1';
guiScaleSlider.value = savedScale;
applyGuiScale(savedScale);

guiScaleSlider.addEventListener('input', (e) => applyGuiScale(e.target.value));

/* Settings Modal */
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalCloseBtn = document.getElementById('modal-close');
const presetSelect = document.getElementById('preset-select');
const customTitleInput = document.getElementById('custom-title-input');
const customIconInput = document.getElementById('custom-icon-input');
const saveSettingsBtn = document.getElementById('save-settings');

settingsBtn.addEventListener('click', () => {
  presetSelect.value = localStorage.getItem('miksi_disguise_preset') || 'canvas';
  customTitleInput.value = localStorage.getItem('miksi_custom_title') || '';
  customIconInput.value = localStorage.getItem('miksi_custom_icon') || '';
  settingsModal.classList.add('active');
});

modalCloseBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

presetSelect.addEventListener('change', (e) => {
  const key = e.target.value;
  if (key !== 'none' && EDUCATIONAL_PRESETS[key]) {
    customTitleInput.value = EDUCATIONAL_PRESETS[key].title;
    customIconInput.value = EDUCATIONAL_PRESETS[key].icon;
  }
});

saveSettingsBtn.addEventListener('click', () => {
  localStorage.setItem('miksi_gui_scale', guiScaleSlider.value);
  const selectedPreset = presetSelect.value;
  const titleVal = customTitleInput.value.trim();
  const iconVal = customIconInput.value.trim();

  if (selectedPreset !== 'none' && EDUCATIONAL_PRESETS[selectedPreset]) {
    const preset = EDUCATIONAL_PRESETS[selectedPreset];
    localStorage.setItem('miksi_disguise_preset', selectedPreset);
    applyTabDisguise(preset.title, preset.icon);
  } else if (titleVal && iconVal) {
    localStorage.setItem('miksi_disguise_preset', 'custom');
    localStorage.setItem('miksi_custom_title', titleVal);
    localStorage.setItem('miksi_custom_icon', iconVal);
    applyTabDisguise(titleVal, iconVal);
  } else {
    localStorage.setItem('miksi_disguise_preset', 'none');
    applyTabDisguise(EDUCATIONAL_PRESETS.none.title, EDUCATIONAL_PRESETS.none.icon);
  }
  settingsModal.classList.remove('active');
});

/* Strength Mode & Device Type Selectors */
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeMenu = document.getElementById('mode-menu');
const currentModeLabel = document.getElementById('current-mode-label');

const deviceToggleBtn = document.getElementById('device-toggle-btn');
const deviceMenu = document.getElementById('device-menu');
const currentDeviceLabel = document.getElementById('current-device-label');
const deviceWrapper = document.getElementById('device-wrapper');

let currentMode = localStorage.getItem('miksi_proxy_mode') || 'fast';
let currentDevice = localStorage.getItem('miksi_device_mode') || 'desktop';

currentModeLabel.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
currentDeviceLabel.textContent = currentDevice.charAt(0).toUpperCase() + currentDevice.slice(1);

function updateDeviceView(device) {
  deviceWrapper.className = 'device-viewport';
  if (device === 'mobile') deviceWrapper.classList.add('mode-mobile');
  if (device === 'tablet') deviceWrapper.classList.add('mode-tablet');
}
updateDeviceView(currentDevice);

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
    localStorage.setItem('miksi_proxy_mode', currentMode);
    currentModeLabel.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    modeMenu.classList.remove('active');
  });
});

document.querySelectorAll('#device-menu .mode-row-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentDevice = btn.getAttribute('data-device');
    localStorage.setItem('miksi_device_mode', currentDevice);
    currentDeviceLabel.textContent = currentDevice.charAt(0).toUpperCase() + currentDevice.slice(1);
    updateDeviceView(currentDevice);
    deviceMenu.classList.remove('active');
  });
});

/* Proxy Execution Engine */
const proxyInput = document.getElementById('proxy-input');
const proxyGoBtn = document.getElementById('proxy-go');
const proxyViewer = document.getElementById('proxy-viewer');
const proxyIframe = document.getElementById('proxy-iframe');
const btnBack = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward');
const btnReload = document.getElementById('btn-reload');
const btnCloseViewer = document.getElementById('btn-close-viewer');

function processUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';
  if (/^https?:\/\//i.test(query)) {
    return query;
  }
  return 'https://' + query;
}

function launchProxy(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;

  proxyInput.value = targetUrl;
  proxyViewer.classList.add('active');
  btnCloseViewer.classList.remove('hidden');

  if (currentMode === 'fast') {
    proxyIframe.src = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
  } else {
    proxyIframe.src = `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=${currentMode}`;
  }
}

proxyGoBtn.addEventListener('click', () => launchProxy(proxyInput.value));
proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    launchProxy(proxyInput.value);
  }
});

btnBack.addEventListener('click', () => { try { proxyIframe.contentWindow.history.back(); } catch(e) {} });
btnForward.addEventListener('click', () => { try { proxyIframe.contentWindow.history.forward(); } catch(e) {} });
btnReload.addEventListener('click', () => { if (proxyIframe.src) proxyIframe.src = proxyIframe.src; });
btnCloseViewer.addEventListener('click', () => {
  proxyViewer.classList.remove('active');
  btnCloseViewer.classList.add('hidden');
  proxyIframe.src = 'about:blank';
});

/* Real-Time Local Chat Controller */
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatDrawer = document.getElementById('chat-drawer');
const chatCloseBtn = document.getElementById('chat-close');
const chatAuthView = document.getElementById('chat-auth-view');
const chatMessagesView = document.getElementById('chat-messages-view');
const chatFooterView = document.getElementById('chat-footer-view');
const usernameInput = document.getElementById('username-input');
const signInBtn = document.getElementById('sign-in-btn');
const chatMsgList = document.getElementById('chat-msg-list');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

let currentUser = localStorage.getItem('miksi_chat_username') || '';

function updateChatAuth() {
  if (currentUser) {
    chatAuthView.classList.add('hidden');
    chatMessagesView.classList.remove('hidden');
    chatFooterView.classList.remove('hidden');
  } else {
    chatAuthView.classList.remove('hidden');
    chatMessagesView.classList.add('hidden');
    chatFooterView.classList.add('hidden');
  }
}

chatToggleBtn.addEventListener('click', () => {
  updateChatAuth();
  chatDrawer.classList.toggle('active');
});

chatCloseBtn.addEventListener('click', () => chatDrawer.classList.remove('active'));

signInBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (name) {
    currentUser = name;
    localStorage.setItem('miksi_chat_username', name);
    updateChatAuth();
  }
});

function appendMessage(user, text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `<strong>${user}</strong><span>${text}</span>`;
  chatMsgList.appendChild(msgEl);
  chatMessagesView.scrollTop = chatMessagesView.scrollHeight;
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (text && currentUser) {
    appendMessage(currentUser, text);
    chatInput.value = '';
  }
}

chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});
