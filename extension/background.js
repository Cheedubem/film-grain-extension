/*
 * background.js
 * Service worker. Its only job is the Alt+G keyboard shortcut.
 * (The shortcut itself is declared in manifest.json under "commands".)
 */
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd !== 'toggle-grain') return;
  // Read the current on/off state, then flip it. content.js on every page
  // notices the change through chrome.storage and updates itself.
  chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
    chrome.storage.local.set({ enabled: !enabled });
  });
});
