document.addEventListener('DOMContentLoaded', async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;

  // 1. Load saved settings
  const { apiKey, model, customPrompt } = await api.storage.sync.get(['apiKey', 'model', 'customPrompt']);
  if (apiKey) document.getElementById('apiKey').value = apiKey;
  if (model) document.getElementById('model').value = model || 'gpt-4o-mini';
  if (customPrompt) document.getElementById('customPrompt').value = customPrompt;

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
  if (!item) return;

  const { falsePositives } = await api.storage.local.get({ falsePositives: [] });
  const updatedFP = [item, ...falsePositives].slice(0, 20);
  
  spamLog.splice(index, 1);

  await api.storage.local.set({
    spamLog: spamLog,
    falsePositives: updatedFP
  });

  if (item.id && typeof messenger !== 'undefined') {
    try {
      const messageHeader = await messenger.messages.get(item.id);
      if (messageHeader) {
        let targetFolder = null;

        if (item.originFolderId) {
          try {
            targetFolder = await messenger.folders.get(item.originFolderId);
          } catch (e) {
            console.warn("Origin folder no longer exists, using Inbox fallback.");
          }
        }

        if (!targetFolder) {
          const account = await messenger.accounts.get(messageHeader.folder.accountId);
          function findInbox(folders) {
            for (let f of folders) {
              if (f.type === 'inbox' || f.name.toLowerCase() === 'inbox') return f;
              if (f.subFolders && f.subFolders.length > 0) {
                const found = findInbox(f.subFolders);
                if (found) return found;
              }
            }
            return null;
          }
          targetFolder = findInbox(account.folders);
        }

        if (targetFolder) {
          await messenger.messages.move([item.id], targetFolder);
        }
      }
    } catch (err) {
      console.warn('Could not move physical message:', err);
    }
  }

  showStatus('Moved to Not Spam training & restored to original folder!', 'success');
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
  const customPrompt = document.getElementById('customPrompt').value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key!', 'error');
    return;
  }

  await api.storage.sync.set({ apiKey, model, customPrompt });
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

function setupBackupHandlers() {
  const exportBtn = document.getElementById('exportBackup');
  const importFileInput = document.getElementById('importFileInput');

  // EXPORT
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const api = typeof messenger !== 'undefined' ? messenger : browser;
        const allData = await api.storage.local.get(null);
        const jsonStr = JSON.stringify(allData, null, 2);

        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const fileName = `spam_detector_backup_${new Date().toISOString().slice(0, 10)}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 150);

        showStatus("Backup exported successfully!", "success");
      } catch (err) {
        console.error("Export error:", err);
        showStatus("Export failed: " + err.message, "error");
      }
    });
  }

  // IMPORT
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      const api = typeof messenger !== 'undefined' ? messenger : browser;
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        try {
          const importedData = JSON.parse(uploadEvent.target.result);

          if (typeof importedData !== "object" || importedData === null) {
            throw new Error("Invalid JSON structure");
          }

          // Clear local storage & set imported state
          await api.storage.local.clear();
          await api.storage.local.set(importedData);

          showStatus("Backup restored successfully!", "success");

          // Instant re-render
          await loadLogs();
        } catch (err) {
          console.error("Import error:", err);
          showStatus("Import failed: " + err.message, "error");
        }
      };

      reader.readAsText(file);
    });
  }
}

// --- UTILITY FUNCTIONS ---

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
  status.style.display = 'inline-block';

  statusTimeout = setTimeout(() => {
    status.className = 'status-badge hidden';
    status.style.display = 'none';
  }, type === 'error' ? 5000 : 3000);
}