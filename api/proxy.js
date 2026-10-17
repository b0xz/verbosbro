/* ===================================================
   MIKSI CLIENT SCRIPT
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

  // Has explicit protocol
  if (/^https?:\/\//i.test(query)) {
    return query;
  }

  // Matches domain names like youtube.com, discord.com, github.com, sub.domain.org/path
  const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?\$/;
  if (domainPattern.test(query)) {
    return 'https://' + query;
  }

  // Fallback to DuckDuckGo html search for standard search queries
  return 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
}

function buildProxyUrl(targetUrl) {
  return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
}

function launchProxy(rawInput) {
  const targetUrl = processUrl(rawInput);
  if (!targetUrl) return;
  proxyInput.value = targetUrl;
  proxyIframe.src = buildProxyUrl(targetUrl);
  proxyViewer.classList.add('active');
  btnCloseViewer.classList.remove('hidden');
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
