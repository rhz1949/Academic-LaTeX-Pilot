const SETTINGS_KEY = 'aiTransSettings';
const DEFAULT_PROVIDER = 'gemini';

const statusEl = document.getElementById('status');
const providerEl = document.getElementById('provider');
const keyEl = document.getElementById('api-key');
const saveBtn = document.getElementById('save-btn');

const setStatus = (message) => {
  statusEl.textContent = message;
};

const loadSettings = () => {
  chrome.storage.local.get([SETTINGS_KEY], (result) => {
    const settings = result[SETTINGS_KEY] || { provider: DEFAULT_PROVIDER, apiKey: '' };
    providerEl.value = settings.provider || DEFAULT_PROVIDER;
    keyEl.value = settings.apiKey || '';
  });
};

const saveSettings = () => {
  const provider = providerEl.value;
  const apiKey = keyEl.value.trim();
  chrome.storage.local.set({ [SETTINGS_KEY]: { provider, apiKey } }, () => {
    setStatus('Saved!');
    setTimeout(() => setStatus(''), 1500);
  });
};

saveBtn.addEventListener('click', saveSettings);
document.addEventListener('DOMContentLoaded', loadSettings);
