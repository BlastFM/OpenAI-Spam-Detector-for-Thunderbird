document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('openOptions');

  btn.addEventListener('click', async () => {
    const api = typeof messenger !== 'undefined' ? messenger : browser;

    try {
      if (api.runtime.openOptionsPage) {
        await api.runtime.openOptionsPage();
      } else {
        await api.tabs.create({ url: api.runtime.getURL('options/options.html') });
      }
    } catch (err) {
      console.warn('openOptionsPage failed, opening direct tab:', err);
      api.tabs.create({ url: api.runtime.getURL('options/options.html') });
    }
  });
});
