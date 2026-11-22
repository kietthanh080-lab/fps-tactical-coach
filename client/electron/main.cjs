const { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } = require('electron');
const fs = require('fs');
const path = require('path');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false; // Cho nguoi dung bam nut moi tai

// Dang ky giao thuc deep-link tacticalreplay:// tren Windows
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('tacticalreplay', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('tacticalreplay');
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
const startHidden = process.argv.includes('--hidden');

function getAppIconPath() {
  const distIcon = path.join(__dirname, '../dist/launcher_icon.ico');
  const publicIcon = path.join(__dirname, '../public/launcher_icon.ico');
  return fs.existsSync(distIcon) ? distIcon : publicIcon;
}

function getPrefsPath() {
  return path.join(app.getPath('userData'), 'background-prefs.json');
}

function readBackgroundPrefs() {
  try {
    const raw = fs.readFileSync(getPrefsPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeBackgroundPrefs(prefs) {
  try {
    fs.writeFileSync(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf8');
  } catch {
    // Bo qua neu khong ghi duoc file cau hinh cuc bo
  }
}

function getAutoStartEnabled() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return false;
  if (!app.isPackaged) {
    const prefs = readBackgroundPrefs();
    return Boolean(prefs?.autoStart);
  }
  const settings = app.getLoginItemSettings();
  return Boolean(settings.openAtLogin);
}

function setAutoStartEnabled(enabled) {
  const normalized = Boolean(enabled);
  writeBackgroundPrefs({ autoStartConfigured: true, autoStart: normalized });

  if (app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin')) {
    app.setLoginItemSettings({
      openAtLogin: normalized,
      args: normalized ? ['--hidden'] : [],
    });
  }

  refreshTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('background:prefs-changed', { autoStart: normalized });
  }
  return normalized;
}

function initDefaultAutoStart() {
  const existing = readBackgroundPrefs();
  if (existing && existing.autoStartConfigured) {
    if (app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin')) {
      app.setLoginItemSettings({
        openAtLogin: Boolean(existing.autoStart),
        args: existing.autoStart ? ['--hidden'] : [],
      });
    }
    return;
  }

  // Mac dinh bat tu khoi dong ngam khi Windows khoi dong lan dau sau khi cai ban packaged
  const defaultEnabled = app.isPackaged;
  writeBackgroundPrefs({ autoStartConfigured: true, autoStart: defaultEnabled });
  if (defaultEnabled && (process.platform === 'win32' || process.platform === 'darwin')) {
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ['--hidden'],
    });
  }
}

function extractTokenFromArgs(argv) {
  const deepLinkUrl = argv.find((arg) => typeof arg === 'string' && arg.startsWith('tacticalreplay://'));
  if (!deepLinkUrl) return null;
  try {
    const parsed = new URL(deepLinkUrl);
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(true);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function refreshTrayMenu() {
  if (!tray) return;
  const autoStart = getAutoStartEnabled();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mở TacticalReplayAI',
      click: () => showMainWindow(),
    },
    {
      label: 'Kiểm tra bản cập nhật',
      click: () => {
        showMainWindow();
        if (app.isPackaged) autoUpdater.checkForUpdates();
      },
    },
    { type: 'separator' },
    {
      label: 'Tự khởi động ngầm cùng Windows',
      type: 'checkbox',
      checked: autoStart,
      click: (menuItem) => {
        setAutoStartEnabled(menuItem.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Thoát hẳn ứng dụng',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(getAppIconPath());
  tray = new Tray(icon);
  tray.setToolTip('TacticalReplayAI - Đang chạy ngầm ở khay hệ thống');
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
  refreshTrayMenu();
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const token = extractTokenFromArgs(commandLine);
    if (token && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:token-received', token);
    }

    if (!commandLine.includes('--hidden') || token) {
      showMainWindow();
    }
  });
}

function setupAutoUpdater() {
  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'available',
        version: info.version,
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        percent: Math.round(progress.percent),
      });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'downloaded',
      });
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        message: err.message,
      });
    }
  });
}

ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged) autoUpdater.checkForUpdates();
});

ipcMain.handle('start-download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update-now', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('background:get-prefs', () => {
  return {
    isElectron: true,
    isPackaged: app.isPackaged,
    autoStart: getAutoStartEnabled(),
  };
});

ipcMain.handle('background:set-auto-start', (_event, enabled) => {
  const nextVal = setAutoStartEnabled(enabled);
  return { autoStart: nextVal };
});

function createMainWindow(forceShow = false) {
  const indexHtmlPath = path.join(__dirname, '../dist/index.html');
  const shouldShow = forceShow || !startHidden;

  const win = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    show: shouldShow,
    title: 'TacticalReplayAI',
    icon: getAppIconPath(),
    backgroundColor: '#0A0D12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  // Thu nho xuong khay he thong khi nguoi dung bam dau X dong cua so
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const initialToken = extractTokenFromArgs(process.argv);
  if (initialToken) {
    win.loadFile(indexHtmlPath, { query: { token: initialToken } });
  } else {
    win.loadFile(indexHtmlPath);
  }

  // Chong treo man hinh den neu trang web ngoai bi chan hoac mat mang
  win.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode === -3) return;
    win.loadFile(indexHtmlPath);
  });

  // Du phong truong hop dieu huong noi bo toi desktop-callback
  win.webContents.on('did-navigate', (_event, url) => {
    if (url.includes('/api/auth/desktop-callback')) {
      try {
        const parsed = new URL(url);
        const token = parsed.searchParams.get('token');
        if (token) {
          win.loadFile(indexHtmlPath, { query: { token } });
        }
      } catch {
        win.loadFile(indexHtmlPath);
      }
    }
  });

  // Kiem tra cap nhat sau khi mo app 3 giay
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  }, 3000);
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  initDefaultAutoStart();
  setupAutoUpdater();
  createTray();
  createMainWindow(false);
  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});
