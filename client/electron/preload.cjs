const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('start-download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update-now'),
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  getBackgroundPrefs: () => ipcRenderer.invoke('background:get-prefs'),
  setAutoStart: (enabled) => ipcRenderer.invoke('background:set-auto-start', enabled),
  onBackgroundPrefsChanged: (callback) => {
    const listener = (_event, prefs) => callback(prefs);
    ipcRenderer.on('background:prefs-changed', listener);
    return () => ipcRenderer.removeListener('background:prefs-changed', listener);
  },
  onAuthToken: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('auth:token-received', listener);
    return () => ipcRenderer.removeListener('auth:token-received', listener);
  },
});
