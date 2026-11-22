const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false; // Chờ người dùng bấm nút mới tải

// Đăng ký giao thức deep-link tacticalreplay:// trên Windows
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

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const token = extractTokenFromArgs(commandLine);
    if (token && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:token-received', token);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
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
  autoUpdater.quitAndInstall();
});

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

function createMainWindow() {
  const indexHtmlPath = path.join(__dirname, '../dist/index.html');

  const win = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: 'TacticalReplayAI',
    icon: path.join(__dirname, '../public/launcher_icon.ico'),
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  const initialToken = extractTokenFromArgs(process.argv);
  if (initialToken) {
    win.loadFile(indexHtmlPath, { query: { token: initialToken } });
  } else {
    win.loadFile(indexHtmlPath);
  }

  // Chống treo màn hình đen nếu trang web ngoài bị chặn hoặc mất mạng
  win.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode === -3) return; // Bỏ qua lỗi hủy chuyển hướng chủ động (ERR_ABORTED)
    win.loadFile(indexHtmlPath);
  });

  // Dự phòng trường hợp điều hướng nội bộ tới desktop-callback
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

  // Kiểm tra cập nhật sau khi mở app 3 giây
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  }, 3000);
}

app.whenReady().then(() => {
  setupAutoUpdater();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});