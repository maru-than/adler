import { getApiKey, setApiKey, getPreferences, setPreferences } from '../lib/storage.js';

const providers = ['openai', 'anthropic', 'gemini'];

const keyInputs = {
  openai: document.getElementById('key-openai'),
  anthropic: document.getElementById('key-anthropic'),
  gemini: document.getElementById('key-gemini'),
};
const prefProvider = document.getElementById('pref-provider');
const btnSave = document.getElementById('btn-save');
const saveStatus = document.getElementById('save-status');

// Load saved values
async function load() {
  for (const p of providers) {
    const key = await getApiKey(p);
    if (key) keyInputs[p].value = key;
  }

  const prefs = await getPreferences();
  prefProvider.value = prefs.defaultProvider || 'openai';
}

// Save
btnSave.addEventListener('click', async () => {
  for (const p of providers) {
    const val = keyInputs[p].value.trim();
    if (val) {
      await setApiKey(p, val);
    } else {
      await chrome.storage.local.remove(`apiKey_${p}`);
    }
  }

  const prefs = await getPreferences();
  prefs.defaultProvider = prefProvider.value;
  await setPreferences(prefs);

  saveStatus.textContent = 'Saved!';
  setTimeout(() => (saveStatus.textContent = ''), 2500);
});

// Toggle password visibility
document.querySelectorAll('.toggle-vis').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('.eye-open').classList.toggle('hidden', !isPassword);
    btn.querySelector('.eye-closed').classList.toggle('hidden', isPassword);
  });
});

load();
