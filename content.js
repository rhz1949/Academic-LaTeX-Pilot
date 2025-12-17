const BUTTON_ID = 'ai-trans-btn';
const SIDEBAR_ID = 'ai-trans-sidebar';
const SETTINGS_KEY = 'aiTransSettings';
const DEFAULT_PROVIDER = 'gemini';

const debounce = (fn, delay = 400) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), delay);
  };
};

const findToolbar = () => {
  const toolbar = document.querySelector('.toolbar-right, .ol-toolbar-right, .toolbar');
  if (toolbar) return toolbar;
  const buttons = Array.from(document.querySelectorAll('button'));
  const recompileBtn = buttons.find((btn) =>
    btn.textContent && btn.textContent.toLowerCase().includes('recompile')
  );
  if (recompileBtn && recompileBtn.parentElement) {
    return recompileBtn.parentElement;
  }
  return null;
};

const insertButton = () => {
  const toolbar = findToolbar();
  if (!toolbar || document.getElementById(BUTTON_ID)) return;

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.textContent = 'Trans';
  button.addEventListener('click', () => {
    openSidebar();
    handleTranslate();
  });

  const referenceButton = Array.from(toolbar.querySelectorAll('button')).find((btn) =>
    btn.textContent && btn.textContent.toLowerCase().includes('recompile')
  );

  if (referenceButton && referenceButton.parentElement === toolbar) {
    toolbar.insertBefore(button, referenceButton);
  } else {
    toolbar.appendChild(button);
  }
};

const observer = new MutationObserver(
  debounce(() => {
    insertButton();
  }, 500)
);

const startObserving = () => {
  if (!document.body) return;
  observer.observe(document.body, { childList: true, subtree: true });
  insertButton();
};

const loadSettings = () =>
  new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (result) => {
      resolve(result[SETTINGS_KEY] || { provider: DEFAULT_PROVIDER, apiKey: '' });
    });
  });

const saveSettings = (settings) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => resolve());
  });

const getSelectedText = () => {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
};

const getContextText = () => {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return '';

  let context = '';
  let node = selection.anchorNode;

  while (node && context.length < 1000) {
    if (node.previousSibling) {
      node = node.previousSibling;
      if (node.textContent) {
        context = node.textContent + context;
      }
    } else {
      node = node.parentNode;
    }
  }

  if (context.length > 1000) {
    return context.slice(-1000);
  }
  return context;
};

const openSidebar = async () => {
  let sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    sidebar = buildSidebar();
    document.body.appendChild(sidebar);
  }
  sidebar.style.display = 'flex';
  const settings = await loadSettings();
  applySettingsToUI(settings);
};

const closeSidebar = () => {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (sidebar) {
    sidebar.style.display = 'none';
  }
};

const buildSidebar = () => {
  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;

  const header = document.createElement('div');
  header.className = 'ai-trans-header';

  const title = document.createElement('h3');
  title.className = 'ai-trans-title';
  title.textContent = 'Overleaf Intelligent Translator';

  const actions = document.createElement('div');
  actions.className = 'ai-trans-actions';

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'ai-trans-icon-btn';
  settingsBtn.title = 'Settings';
  settingsBtn.textContent = '⚙️';
  settingsBtn.addEventListener('click', toggleSettings);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ai-trans-icon-btn';
  closeBtn.title = 'Close';
  closeBtn.textContent = '✖';
  closeBtn.addEventListener('click', closeSidebar);

  actions.appendChild(settingsBtn);
  actions.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(actions);

  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'ai-trans-settings';
  settingsPanel.id = 'ai-trans-settings-panel';

  const providerLabel = document.createElement('label');
  providerLabel.textContent = 'Provider';
  const providerSelect = document.createElement('select');
  providerSelect.id = 'ai-trans-provider';
  const geminiOption = document.createElement('option');
  geminiOption.value = 'gemini';
  geminiOption.textContent = 'Gemini';
  const openaiOption = document.createElement('option');
  openaiOption.value = 'openai';
  openaiOption.textContent = 'OpenAI';
  providerSelect.appendChild(geminiOption);
  providerSelect.appendChild(openaiOption);

  const keyLabel = document.createElement('label');
  keyLabel.textContent = 'API Key';
  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.id = 'ai-trans-api-key';
  keyInput.placeholder = 'Enter your API key';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'ai-trans-btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const provider = providerSelect.value;
    const apiKey = keyInput.value.trim();
    await saveSettings({ provider, apiKey });
    setStatus('Settings saved.');
  });

  settingsPanel.appendChild(providerLabel);
  settingsPanel.appendChild(providerSelect);
  settingsPanel.appendChild(keyLabel);
  settingsPanel.appendChild(keyInput);
  settingsPanel.appendChild(saveBtn);

  const body = document.createElement('div');
  body.className = 'ai-trans-body';

  const statusEl = document.createElement('div');
  statusEl.className = 'ai-trans-status';
  statusEl.id = 'ai-trans-status';
  statusEl.textContent = 'Waiting for selection…';

  const errorEl = document.createElement('div');
  errorEl.className = 'ai-trans-error';
  errorEl.id = 'ai-trans-error';

  const polishedSection = document.createElement('div');
  polishedSection.className = 'ai-trans-section';
  const polishedTitle = document.createElement('h4');
  polishedTitle.textContent = 'Polished Chinese';
  const polishedText = document.createElement('div');
  polishedText.className = 'ai-trans-text';
  polishedText.id = 'ai-trans-polished';
  polishedSection.appendChild(polishedTitle);
  polishedSection.appendChild(polishedText);

  const translatedSection = document.createElement('div');
  translatedSection.className = 'ai-trans-section';
  const translatedTitle = document.createElement('h4');
  translatedTitle.textContent = 'English LaTeX';
  const translatedText = document.createElement('div');
  translatedText.className = 'ai-trans-text';
  translatedText.id = 'ai-trans-translated';
  translatedSection.appendChild(translatedTitle);
  translatedSection.appendChild(translatedText);

  body.appendChild(statusEl);
  body.appendChild(errorEl);
  body.appendChild(polishedSection);
  body.appendChild(translatedSection);

  const footer = document.createElement('div');
  footer.className = 'ai-trans-footer';

  const copyCnBtn = document.createElement('button');
  copyCnBtn.className = 'ai-trans-btn-secondary';
  copyCnBtn.textContent = 'Copy CN';
  copyCnBtn.addEventListener('click', () => copyText(polishedText.textContent));

  const copyEnBtn = document.createElement('button');
  copyEnBtn.className = 'ai-trans-btn-secondary';
  copyEnBtn.textContent = 'Copy EN';
  copyEnBtn.addEventListener('click', () => copyText(translatedText.textContent));

  footer.appendChild(copyCnBtn);
  footer.appendChild(copyEnBtn);

  sidebar.appendChild(header);
  sidebar.appendChild(settingsPanel);
  sidebar.appendChild(body);
  sidebar.appendChild(footer);

  return sidebar;
};

const toggleSettings = () => {
  const panel = document.getElementById('ai-trans-settings-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
};

const applySettingsToUI = (settings) => {
  const providerSelect = document.getElementById('ai-trans-provider');
  const keyInput = document.getElementById('ai-trans-api-key');
  if (providerSelect) providerSelect.value = settings.provider || DEFAULT_PROVIDER;
  if (keyInput) keyInput.value = settings.apiKey || '';
};

const setStatus = (message) => {
  const statusEl = document.getElementById('ai-trans-status');
  if (statusEl) statusEl.textContent = message;
};

const setError = (message) => {
  const errorEl = document.getElementById('ai-trans-error');
  if (errorEl) errorEl.textContent = message || '';
};

const renderResult = (data) => {
  const polished = document.getElementById('ai-trans-polished');
  const translated = document.getElementById('ai-trans-translated');
  if (polished) polished.textContent = data.polished_cn || '';
  if (translated) translated.textContent = data.translated_en || '';
};

const copyText = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard');
  } catch (err) {
    console.error('Copy failed', err);
    setStatus('Copy failed. Please copy manually.');
  }
};

const handleTranslate = async () => {
  const targetText = getSelectedText();
  if (!targetText) {
    alert('请选择需要润色的中文文本');
    return;
  }
  const contextText = getContextText();
  const settings = await loadSettings();
  if (!settings.apiKey) {
    setError('请先在设置中填写 API Key。');
    toggleSettings();
    return;
  }

  setError('');
  setStatus('Processing with AI…');
  renderResult({ polished_cn: '', translated_en: '' });

  chrome.runtime.sendMessage(
    {
      type: 'ai-translate',
      target_text: targetText,
      context_text: contextText,
      api_key: settings.apiKey,
      provider: settings.provider || DEFAULT_PROVIDER,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        setError(`Extension error: ${chrome.runtime.lastError.message}`);
        setStatus('Failed');
        return;
      }
      if (!response || !response.success) {
        setError(response && response.error ? response.error : 'Unknown error');
        setStatus('Failed');
        return;
      }
      renderResult(response.data);
      setStatus('Done');
    }
  );
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    insertButton();
  }
});

startObserving();
