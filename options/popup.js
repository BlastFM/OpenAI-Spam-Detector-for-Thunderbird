document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('target') || 'log';

  const titleEl = document.getElementById('popup-title');
  const descEl = document.getElementById('popup-desc');
  const confirmBtn = document.getElementById('confirm-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  if (target === 'memory') {
    titleEl.textContent = 'Clear Training Memory?';
    descEl.textContent = 'Are you sure you want to clear all active AI training memory?';
  } else {
    titleEl.textContent = 'Clear Spam Log?';
    descEl.textContent = 'Are you sure you want to clear all recorded spam log entries?';
  }

  confirmBtn.addEventListener('click', async () => {
    if (target === 'memory') {
      await browser.storage.local.set({ trainingMemory: [] });
      browser.runtime.sendMessage({ action: 'memoryCleared' });
    } else {
      await browser.storage.local.set({ spamLog: [] });
      browser.runtime.sendMessage({ action: 'logCleared' });
    }
    window.close();
  });

  cancelBtn.addEventListener('click', () => {
    window.close();
  });
});