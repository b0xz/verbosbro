/* ===================================================
   1. EDUCATIONAL PRESETS & TAB DISGUISE MANAGEMENT
   =================================================== */
const EDUCATIONAL_PRESETS = {
  none: {
    title: 'mayo',
    icon: 'https://www.bing.com/th/id/OIP.cS6NYrx4o3zr-locEJ1AxwHaHa?w=205&h=205&c=8&rs=1&qlt=90&o=6&dpr=1.1&pid=3.1&rm=2'
  },
  classroom: {
    title: 'Classes',
    icon: 'https://ssl.gstatic.com/classroom/favicon.png'
  },
  drive: {
    title: 'My Drive - Google Drive',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png'
  },
  docs: {
    title: 'Google Docs',
    icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico'
  },
  canvas: {
    title: 'Dashboard - Canvas',
    icon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico'
  },
  edpuzzle: {
    title: 'Edpuzzle',
    icon: 'https://edpuzzle.imgix.net/edpuzzle-logo-icon.png?w=32'
  },
  quizlet: {
    title: 'Flashcards, learning tools, and textbook solutions | Quizlet',
    icon: 'https://assets.quizlet.com/a-s/j/favicon.ico'
  },
  clever: {
    title: 'Clever | Portal',
    icon: 'https://assets.clever.com/assets/favicon.ico'
  },
  schoology: {
    title: 'Home | Schoology',
    icon: 'https://www.schoology.com/sites/default/files/favicon.ico'
  },
  khan: {
    title: 'Dashboard | Khan Academy',
    icon: 'https://www.khanacademy.org/favicon.ico'
  },
  desmos: {
    title: 'Desmos | Graphing Calculator',
    icon: 'https://www.desmos.com/favicon.ico'
  }
};

const tabTitleEl = document.getElementById('tab-title');
const tabFaviconEl = document.getElementById('tab-favicon');

function applyTabDisguise(title, iconUrl) {
  tabTitleEl.textContent = title;
  
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = iconUrl;
}

function loadSavedDisguise() {
  const savedKey = localStorage.getItem('mayo_disguise_preset') || 'none';
  const customTitle = localStorage.getItem('mayo_custom_title');
  const customIcon = localStorage.getItem('mayo_custom_icon');

  if (savedKey === 'custom' && customTitle && customIcon) {
    applyTabDisguise(customTitle, customIcon);
  } else if (EDUCATIONAL_PRESETS[savedKey]) {
    const preset = EDUCATIONAL_PRESETS[savedKey];
    applyTabDisguise(preset.title, preset.icon);
  }
}

// Initialize tab mask on page start
loadSavedDisguise();

/* ===================================================
   2. SETTINGS MODAL INTERACTION
   =================================================== */
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalCloseBtn = document.getElementById('modal-close');
const presetSelect = document.getElementById('preset-select');
const customTitleInput = document.getElementById('custom-title-input');
const customIconInput = document.getElementById('custom-icon-input');
const saveSettingsBtn = document.getElementById('save-settings');

settingsBtn.addEventListener('click', () => {
  const currentPreset = localStorage.getItem('mayo_disguise_preset') || 'none';
  presetSelect.value = currentPreset;
  customTitleInput.value = localStorage.getItem('mayo_custom_title') || '';
  customIconInput.value = localStorage.getItem('mayo_custom_icon') || '';
  settingsModal.classList.add('active');
});

modalCloseBtn.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

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
    // Check if user modified input manually
    if (titleVal === preset.title && iconVal === preset.icon) {
      localStorage.setItem('mayo_disguise_preset', selectedPreset);
      applyTabDisguise(preset.title, preset.icon);
    } else {
      localStorage.setItem('mayo_disguise_preset', 'custom');
      localStorage.setItem('mayo_custom_title', titleVal);
      localStorage.setItem('mayo_custom_icon', iconVal);
      applyTabDisguise(titleVal, iconVal);
    }
  } else if (titleVal && iconVal) {
    localStorage.setItem('mayo_disguise_preset', 'custom');
    localStorage.setItem('mayo_custom_title', titleVal);
    localStorage.setItem('mayo_custom_icon', iconVal);
    applyTabDisguise(titleVal, iconVal);
  } else {
    localStorage.setItem('mayo_disguise_preset', 'none');
    applyTabDisguise(EDUCATIONAL_PRESETS.none.title, EDUCATIONAL_PRESETS.none.icon);
  }

  settingsModal.classList.remove('active');
});

/* ===================================================
   3. LIGHT / DARK THEME TOGGLE
   =================================================== */
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('mayo_theme') || (prefersDark ? 'dark' : 'light');

function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIconSun.classList.add('hidden');
    themeIconMoon.classList.remove('hidden');
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeIconSun.classList.remove('hidden');
    themeIconMoon.classList.add('hidden');
  }
  localStorage.setItem('mayo_theme', theme);
}

setTheme(savedTheme);

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

/* ===================================================
   4. CLIENT PROXY DISPATCHER
   =================================================== */
const proxyInput = document.getElementById('proxy-input');
const proxyGoBtn = document.getElementById('proxy-go');
const proxyViewer = document.getElementById('proxy-viewer');
const proxyIframe = document.getElementById('proxy-iframe');
const viewerUrlBar = document.getElementById('viewer-url-bar');
const btnClose = document.getElementById('btn-close');
const btnReload = document.getElementById('btn-reload');

function buildProxyUrl(rawInput) {
  let query = rawInput.trim();
  if (!query) return '';

  let targetUrl = '';
  const urlPattern = /^(https?:\/\/)?([\w\-]+(\.[\w\-]+)+)([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?$/i;

  if (urlPattern.test(query)) {
    if (!query.startsWith('http://') && !query.startsWith('https://')) {
      targetUrl = 'https://' + query;
    } else {
      targetUrl = query;
    }
  } else {
    targetUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  }

  return '/api/proxy?url=' + encodeURIComponent(targetUrl) + '&mode=desktop&speed=fast';
}

function launchProxy(rawUrl) {
  const finalProxyUrl = buildProxyUrl(rawUrl);
  if (!finalProxyUrl) return;

  viewerUrlBar.value = rawUrl;
  proxyIframe.src = finalProxyUrl;
  proxyViewer.classList.add('active');
}

// Event Listeners
proxyGoBtn.addEventListener('click', () => {
  launchProxy(proxyInput.value);
});

proxyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    launchProxy(proxyInput.value);
  }
});

document.querySelectorAll('.grid-item').forEach(item => {
  item.addEventListener('click', () => {
    const url = item.getAttribute('data-url');
    if (url) {
      proxyInput.value = url;
      launchProxy(url);
    }
  });
});

btnClose.addEventListener('click', () => {
  proxyViewer.classList.remove('active');
  proxyIframe.src = 'about:blank';
});

btnReload.addEventListener('click', () => {
  if (proxyIframe.src) {
    proxyIframe.contentWindow.location.reload();
  }
});
