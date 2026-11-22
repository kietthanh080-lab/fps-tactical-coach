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
  // Desktop Capture & Overwolf Detection APIs
  getCaptureStatus: () => ipcRenderer.invoke('capture:get-status'),
  checkOverwolfInstalled: () => ipcRenderer.invoke('capture:check-overwolf'),
  openOverwolfDownload: () => ipcRenderer.invoke('capture:open-overwolf-download'),
  setDesktopCaptureEnabled: (enabled) => ipcRenderer.invoke('capture:set-desktop-capture', enabled),
  listScreens: () => ipcRenderer.invoke('capture:list-screens'),
  setCaptureOptions: (options) => ipcRenderer.invoke('capture:set-capture-options', options),
  relaunchApp: () => ipcRenderer.invoke('capture:relaunch-app'),
  getScreenSourceId: () => ipcRenderer.invoke('capture:get-screen-source'),
  saveTempSegment: (payload) => ipcRenderer.invoke('capture:save-temp-segment', payload),
  promoteF9Highlight: (payload) => ipcRenderer.invoke('capture:promote-f9-highlight', payload),
  matchKillSegments: (payload) => ipcRenderer.invoke('capture:match-kill-segments', payload),
  onCaptureStateChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('capture:state-changed', listener);
    return () => ipcRenderer.removeListener('capture:state-changed', listener);
  },
  onHotkeyHighlight: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('capture:hotkey-highlight', listener);
    return () => ipcRenderer.removeListener('capture:hotkey-highlight', listener);
  },
});
