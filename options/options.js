document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  const apiKeyInput = document.getElementById('api-key');
  const testKeyBtn = document.getElementById('test-key-btn');
  const modelSelect = document.getElementById('model-select');
  const actionDestination = document.getElementById('action-destination');
  const whitelistInput = document.getElementById('whitelist');
  const blacklistInput = document.getElementById('blacklist');
  const customPromptInput = document.getElementById('custom-prompt');
  
  const saveBtn = document.getElementById('save-btn');
  const statusMessage = document.getElementById('status-message');

  // Left Pane: Settings Backup Controls
  const exportRulesBtn = document.getElementById('export-rules-btn');
  const importRulesBtn = document.getElementById('import-rules-btn');
  const importRulesInput = document.getElementById('import-rules-input');

  // Right Pane: Log & Memory Controls
  const exportBackupBtn = document.getElementById('export-backup-btn');
  const importBackupBtn = document.getElementById('import-backup-btn');
  const importFileInput = document.getElementById('import-file-input');
  const clearLogBtn = document.getElementById('clear-log-btn');
  const clearMemoryBtn = document.getElementById('clear-memory-btn');

  const spamLogContainer = document.getElementById('spam-log-container');
  const memoryContainer = document.getElementById('memory-container');

  // --- Helper: Status Message Display ---
  function showStatus(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.className = `status-msg ${isError ? 'error' : 'success'}`;
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = 'status-msg';
    }, 3000);
  }

  // --- Load Settings ---
  function loadSettings() {
    browser.storage.local.get([
      'apiKey',
      'model',
      'actionDestination',
      'whitelist',
      'blacklist',
      'customPrompt',
      'spamLog',
      'trainingMemory'
    ]).then((data) => {
      if (data.apiKey) apiKeyInput.value = data.apiKey;
      if (data.model) modelSelect.value = data.model;
      if (data.actionDestination) actionDestination.value = data.actionDestination;
      if (data.whitelist) whitelistInput.value = data.whitelist;
      if (data.blacklist) blacklistInput.value = data.blacklist;
      if (data.customPrompt) customPromptInput.value = data.customPrompt;

      renderLogs(data.spamLog || []);
      renderMemory(data.trainingMemory || []);
    }).catch((err) => console.error('Error loading settings:', err));
  }

  // --- Save Settings ---
  saveBtn.addEventListener('click', () => {
    browser.storage.local.set({
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      actionDestination: actionDestination.value,
      whitelist: whitelistInput.value.trim(),
      blacklist: blacklistInput.value.trim(),
      customPrompt: customPromptInput.value.trim()
    }).then(() => {
      showStatus('Settings saved successfully!');
    }).catch((err) => {
      showStatus('Failed to save settings.', true);
      console.error(err);
    });
  });

  // --- Test API Key ---
  testKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus('Please enter an API Key first.', true);
      return;
    }
    testKeyBtn.disabled = true;
    testKeyBtn.textContent = 'Testing...';

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (response.ok) {
        showStatus('API Key valid!');
      } else {
        showStatus('Invalid API Key.', true);
      }
    } catch (err) {
      showStatus('Network error testing key.', true);
    } finally {
      testKeyBtn.disabled = false;
      testKeyBtn.textContent = 'Test Key';
    }
  });

  // --- Export Rules & Key (Left Pane) ---
  exportRulesBtn.addEventListener('click', () => {
    const configData = {
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      actionDestination: actionDestination.value,
      whitelist: whitelistInput.value.trim(),
      blacklist: blacklistInput.value.trim(),
      customPrompt: customPromptInput.value.trim()
    };
    downloadJson(configData, 'spam-detector-rules-config.json');
  });

  // --- Import Rules & Key (Left Pane) ---
  importRulesBtn.addEventListener('click', () => importRulesInput.click());
  importRulesInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        if (config.apiKey !== undefined) apiKeyInput.value = config.apiKey;
        if (config.model) modelSelect.value = config.model;
        if (config.actionDestination) actionDestination.value = config.actionDestination;
        if (config.whitelist !== undefined) whitelistInput.value = config.whitelist;
        if (config.blacklist !== undefined) blacklistInput.value = config.blacklist;
        if (config.customPrompt !== undefined) customPromptInput.value = config.customPrompt;

        showStatus('Rules & Key imported. Click Save to apply!');
      } catch (err) {
        showStatus('Invalid JSON config file.', true);
      }
    };
    reader.readAsText(file);
  });

  // --- Export Full Backup (Right Pane) ---
  exportBackupBtn.addEventListener('click', () => {
    browser.storage.local.get(null).then((allData) => {
      downloadJson(allData, 'spam-detector-full-backup.json');
    });
  });

  // --- Import Full Backup (Right Pane) ---
  importBackupBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        browser.storage.local.set(data).then(() => {
          loadSettings();
          showStatus('Full backup imported successfully!');
        });
      } catch (err) {
        showStatus('Failed to parse backup file.', true);
      }
    };
    reader.readAsText(file);
  });

  // --- Clear Log & Memory ---
  clearLogBtn.addEventListener('click', () => {
    browser.storage.local.set({ spamLog: [] }).then(() => {
      renderLogs([]);
      showStatus('Spam log cleared.');
    });
  });

  clearMemoryBtn.addEventListener('click', () => {
    browser.storage.local.set({ trainingMemory: [] }).then(() => {
      renderMemory([]);
      showStatus('Training memory cleared.');
    });
  });

  // --- Render Functions ---
  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      spamLogContainer.innerHTML = '<p class="empty-state">No spam detected yet.</p>';
      return;
    }
    spamLogContainer.innerHTML = logs.map(item => `
      <div class="log-item">
        <strong>${escapeHtml(item.subject || 'No Subject')}</strong>
        <span class="log-meta">${escapeHtml(item.from || '')} - ${new Date(item.timestamp).toLocaleString()}</span>
      </div>
    `).join('');
  }

  function renderMemory(memory) {
    if (!memory || memory.length === 0) {
      memoryContainer.innerHTML = '<p class="empty-state">No false positives recorded.</p>';
      return;
    }
    memoryContainer.innerHTML = memory.map(item => `
      <div class="log-item">
        <strong>${escapeHtml(item.subject || 'No Subject')}</strong>
        <span class="log-meta">Marked Safe</span>
      </div>
    `).join('');
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initial Load
  loadSettings();
});