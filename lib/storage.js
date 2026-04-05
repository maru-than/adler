// Thin wrapper over chrome.storage.local

export async function getApiKey(provider) {
  const result = await chrome.storage.local.get(`apiKey_${provider}`);
  return result[`apiKey_${provider}`] || null;
}

export async function setApiKey(provider, key) {
  await chrome.storage.local.set({ [`apiKey_${provider}`]: key });
}

export async function getPreferences() {
  const result = await chrome.storage.local.get('preferences');
  return result.preferences || {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o',
    maxContextLength: 12000,
  };
}

export async function setPreferences(prefs) {
  await chrome.storage.local.set({ preferences: prefs });
}

