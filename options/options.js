document.addEventListener('DOMContentLoaded', async () => {
  const { apiKey, model, customPrompt } = await messenger.storage.sync.get(['apiKey', 'model', 'customPrompt']);
  if (apiKey) document.getElementById('apiKey').value = apiKey;
  if (model) document.getElementById('model').value = model || 'gpt-4o-mini';
  if (customPrompt) document.getElementById('customPrompt').value = customPrompt;

  await loadLogs();

  messenger.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.spamLog || changes.falsePositives) {
        loadLogs();
      }
    }
  });
});

async function loadLogs() {
  const { spamLog } = await messenger.storage.local.get({ spamLog: [] });
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });

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
    return `
      <div class="log-card-item ${isNewest ? 'newest-entry' : ''}">
        <div class="log-card-header">
          <div class="log-author-wrap">
            <img src="${iconPath}" alt="Status">
            <span class="log-author">${escapeHtml(item.author)}</span>
            ${isNewest ? '<span class="entry-badge">Latest</span>' : ''}
          </div>
          <span class="log-date">${item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() + ' ' + new Date(item.dateAdded).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
        </div>
        <div class="log-subject">${escapeHtml(item.subject)}</div>
        <div class="log-snippet">${escapeHtml(item.bodySnippet)}</div>
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

async function markLogItemAsNotSpam(index) {
  const { spamLog } = await messenger.storage.local.get({ spamLog: [] });
  const item = spamLog[index];
  if (!item) return;

  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });
  
  // Deduplicate before adding to falsePositives list
  const deduplicatedFP = falsePositives.filter(fp => 
    fp.id !== item.id && !(fp.author === item.author && fp.subject === item.subject)
  );
  
  const updatedFP = [item, ...deduplicatedFP].slice(0, 20);
  spamLog.splice(index, 1);

  await messenger.storage.local.set({
    spamLog: spamLog,
    falsePositives: updatedFP
  });

  if (item.id) {
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
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });
  falsePositives.splice(index, 1);
  await messenger.storage.local.set({ falsePositives });
  showStatus('Training memory item removed.', 'success');
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.getElementById('save').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('model').value;
  const customPrompt = document.getElementById('customPrompt').value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key!', 'error');
    return;
  }

  await messenger.storage.sync.set({ apiKey, model, customPrompt });
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
  const confirmed = confirm("Are you sure you want to clear the Detected Spam Log?");
  if (!confirmed) return;

  await messenger.storage.local.set({ spamLog: [], spamExamples: [] });
  showStatus('Spam log cleared successfully!', 'success');
});

document.getElementById('clearFPLog').addEventListener('click', async () => {
  const confirmed = confirm("Are you sure you want to clear the Active AI Training Memory?");
  if (!confirmed) return;

  await messenger.storage.local.set({ falsePositives: [] });
  showStatus('AI training memory cleared successfully!', 'success');
});

let statusTimeout = null;
function showStatus(text, type) {
  const status = document.getElementById('status');
  if (!status) return;

  if (statusTimeout) clearTimeout(statusTimeout);

  status.textContent = text;
  status.className = `status-badge ${type}`;
  status.style.display = 'inline-flex';

  statusTimeout = setTimeout(() => {
    status.className = 'status-badge hidden';
    status.style.display = 'none';
  }, type === 'error' ? 5000 : 3000);
}