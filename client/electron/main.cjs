const { app, BrowserWindow } = require('electron');
const path = require('path');

function createMainWindow() {
  const indexHtmlPath = path.join(__dirname, '../dist/public/index.html');

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
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(indexHtmlPath);

  // Tự động bắt token sau khi đăng nhập Steam / Riot và quay về giao diện chính
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
}

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});