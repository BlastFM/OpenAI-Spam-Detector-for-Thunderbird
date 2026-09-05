document.addEventListener('DOMContentLoaded', async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;

  // Non-secret settings live in storage.sync (so they roam with the
  // profile); the API key lives in storage.local only, so it never leaves
  // this machine.
  const { model, targetFolder, customPrompt, whitelist, blacklist } =
    await api.storage.sync.get(['model', 'targetFolder', 'customPrompt', 'whitelist', 'blacklist']);
  const { apiKey } = await api.storage.local.get(['apiKey']);

  if (apiKey) document.getElementById('apiKey').value = apiKey || '';
  if (model) document.getElementById('model').value = model || 'gpt-4o-mini';
  if (targetFolder) document.getElementById('targetFolder').value = targetFolder || 'trash';
  if (whitelist) document.getElementById('whitelist').value = whitelist || '';
  if (blacklist) document.getElementById('blacklist').value = blacklist || '';
  if (customPrompt) document.getElementById('customPrompt').value = customPrompt || '';

  // 2. Initial logs render
  await loadLogs();

  // 3. Storage change listener
  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.spamLog || changes.falsePositives) {
        loadLogs();
      }
    }
  });

  // 4. Attach Backup & Restore handlers
  setupBackupHandlers();
});

// --- LOG LOADING & RENDERING ---

async function loadLogs() {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const { spamLog } = await api.storage.local.get({ spamLog: [] });
  const { falsePositives } = await api.storage.local.get({ falsePositives: [] });

  renderLog('spamLogContainer', spamLog, 'No spam detected yet.');
  renderLog('falsePositivesContainer', falsePositives, 'No false positives recorded.');
}

function renderLog(containerId, list, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  const isSpamLog = containerId === 'spamLogContainer';
  const isFP = containerId === 'falsePositivesContainer';

  container.innerHTML = list.map((item, index) => {
    const isNewest = index === 0;
    const iconPath = isSpamLog ? '../icons/spam-red.png' : '../icons/not-spam-green.png';
    const author = item.author || item.sender || 'Unknown Sender';
    const subject = item.subject || 'No Subject';
    const dateRaw = item.dateAdded || item.timestamp || item.date;
    const formattedDate = dateRaw ? new Date(dateRaw).toLocaleDateString() + ' ' + new Date(dateRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    return `
      <div class="log-card-item ${isNewest ? 'newest-entry' : ''}">
        <div class="log-card-header">
          <div class="log-author-wrap">
            <img src="${iconPath}" alt="Status" style="width:14px; height:14px; flex-shrink:0;">
            <span class="log-author">${escapeHtml(author)}</span>
            ${isNewest ? '<span class="entry-badge">Latest</span>' : ''}
          </div>
          <span class="log-date">${formattedDate}</span>
        </div>
        <div class="log-subject">${escapeHtml(subject)}</div>
        <div class="log-snippet">${escapeHtml(item.bodySnippet || '')}</div>
        <div class="log-footer">
          ${isSpamLog ? `
            <button class="btn btn-green-outline btn-sm mark-not-spam-btn" data-index="${index}">Mark as Not Spam</button>
          ` : ''}
          ${isFP ? `
            <span class="training-badge">Active Training Prompt</span>
            <button class="btn btn-orange-outline btn-sm remove-fp-btn" data-index="${index}">Remove</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (isSpamLog) {
    container.querySelectorAll('.mark-not-spam-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        await markLogItemAsNotSpam(idx);
      });
    });
  }

  if (isFP) {
    container.querySelectorAll('.remove-fp-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        await removeFalsePositive(idx);
      });
    });
  }

  container.scrollTop = 0;
}

// --- LOG ACTION HANDLERS ---

async function markLogItemAsNotSpam(index) {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const { spamLog } = await api.storage.local.get({ spamLog: [] });
  const item = spamLog[index];
  if (!item || !item.id) return;

  // Delegate entirely to the background script's manualMarkAsNotSpam: it
  // already updates falsePositives/spamLog AND moves the message with the
  // tracked-move guard that prevents an immediate reclassification once it
  // lands back in the origin folder. Duplicating that bookkeeping here
  // previously caused the log entry to be recorded twice.
  try {
    await api.runtime.sendMessage({ action: 'restoreMessage', messageId: item.id });
    showStatus('Moved to Not Spam training & restored to original folder!', 'success');
  } catch (err) {
    console.warn('Could not move physical message:', err);
    showStatus('Could not restore message: ' + err.message, 'error');
  }
}

async function removeFalsePositive(index) {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const { falsePositives } = await api.storage.local.get({ falsePositives: [] });
  falsePositives.splice(index, 1);
  await api.storage.local.set({ falsePositives });
  showStatus('Training memory item removed.', 'success');
}

// --- SETTINGS FORM & API TESTING ---

document.getElementById('save').addEventListener('click', async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('model').value;
  const targetFolder = document.getElementById('targetFolder').value;
  const whitelist = document.getElementById('whitelist').value.trim();
  const blacklist = document.getElementById('blacklist').value.trim();
  const customPrompt = document.getElementById('customPrompt').value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key!', 'error');
    return;
  }

  // Secret stays local-only; everything else can roam via sync.
  await api.storage.local.set({ apiKey });
  await api.storage.sync.set({ model, targetFolder, whitelist, blacklist, customPrompt });
  showStatus('Saved successfully!', 'success');
});

document.getElementById('testKey').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const testBtn = document.getElementById('testKey');
  const spinner = testBtn.querySelector('.btn-spinner');

  if (!apiKey) {
    showStatus('Please enter an API key first!', 'error');
    return;
  }

  testBtn.disabled = true;
  spinner.classList.remove('hidden');
  showStatus('Testing connection...', 'info');

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (response.ok) {
      showStatus('Connection successful! Key is valid.', 'success');
    } else {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${response.status}`;
      showStatus(`API Error: ${msg}`, 'error');
    }
  } catch (err) {
    showStatus('Network error connecting to OpenAI.', 'error');
  } finally {
    testBtn.disabled = false;
    spinner.classList.add('hidden');
  }
});

document.getElementById('clearSpamLog').addEventListener('click', async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const confirmed = confirm("Are you sure you want to clear the Detected Spam Log?");
  if (!confirmed) return;

  await api.storage.local.set({ spamLog: [], spamExamples: [] });
  showStatus('Spam log cleared successfully!', 'success');
});

document.getElementById('clearFPLog').addEventListener('click', async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const confirmed = confirm("Are you sure you want to clear the Active AI Training Memory?");
  if (!confirmed) return;

  await api.storage.local.set({ falsePositives: [] });
  showStatus('AI training memory cleared successfully!', 'success');
});

// --- BACKUP & RESTORE MODULE ---

function populateFormFields(settings, credentials) {
  if (settings) {
    document.getElementById('model').value = settings.model || 'gpt-4o-mini';
    document.getElementById('targetFolder').value = settings.targetFolder || 'trash';
    document.getElementById('whitelist').value = settings.whitelist || '';
    document.getElementById('blacklist').value = settings.blacklist || '';
    document.getElementById('customPrompt').value = settings.customPrompt || '';
  }
  if (credentials && credentials.apiKey) {
    document.getElementById('apiKey').value = credentials.apiKey;
  }
}

function setupBackupHandlers() {
  const exportBtn = document.getElementById('exportBackup');
  const importFileInput = document.getElementById('importFileInput');
  const importBackupBtn = document.getElementById('importBackupBtn');

  if (importBackupBtn && importFileInput) {
    importBackupBtn.addEventListener('click', () => importFileInput.click());
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const confirmed = confirm(
        "This backup will contain your OpenAI API key in PLAIN TEXT, " +
        "along with your rules, spam log, and training data. Continue?"
      );
      if (!confirmed) return;

      try {
        const api = typeof messenger !== 'undefined' ? messenger : browser;
        const syncData = await api.storage.sync.get(null);
        const localData = await api.storage.local.get(null);
        const { apiKey, ...logsAndTraining } = localData;

        const fullBackup = {
          version: "1.3.3",
          exportedAt: new Date().toISOString(),
          type: "full_backup",
          settings: syncData,
          credentials: { apiKey: apiKey || '' },
          logsAndTraining
        };

        downloadJson(fullBackup, `openai_spam_detector_backup_${new Date().toISOString().slice(0, 10)}.json`);
        showStatus("Full backup exported successfully!", "success");
      } catch (err) {
        showStatus("Export failed: " + err.message, "error");
      }
    });
  }

  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      handleImportFile(e, async (importedData, api) => {
        if (importedData.settings) {
          // Back-compat: older backups put apiKey inside "settings".
          const { apiKey: legacyApiKey, ...syncSettings } = importedData.settings;
          const credentials = importedData.credentials || { apiKey: legacyApiKey };

          await api.storage.sync.set(syncSettings);
          if (credentials.apiKey) {
            await api.storage.local.set({ apiKey: credentials.apiKey });
          }
          if (importedData.logsAndTraining) {
            await api.storage.local.set(importedData.logsAndTraining);
          }
          populateFormFields(syncSettings, credentials);
        } else {
          await api.storage.local.set(importedData);
        }

        await loadLogs();
        showStatus("Full backup restored successfully!", "success");
      });
    });
  }
}

function handleImportFile(event, restoreCallback) {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (uploadEvent) => {
    try {
      const importedData = JSON.parse(uploadEvent.target.result);
      if (typeof importedData !== "object" || importedData === null) {
        throw new Error("Invalid JSON structure");
      }
      await restoreCallback(importedData, api);
    } catch (err) {
      console.error("Import error:", err);
      showStatus("Import failed: " + err.message, "error");
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function downloadJson(dataObject, filename) {
  const jsonStr = JSON.stringify(dataObject, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  try {
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
  } finally {
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let statusTimeout = null;
function showStatus(text, type) {
  const status = document.getElementById('status');
  if (!status) return;

  if (statusTimeout) clearTimeout(statusTimeout);

  status.textContent = text;
  status.className = `status-badge ${type}`;
  status.style.display = 'block';

  statusTimeout = setTimeout(() => {
    status.className = 'status-badge hidden';
    status.style.display = 'none';
  }, type === 'error' ? 5000 : 3000);
}
