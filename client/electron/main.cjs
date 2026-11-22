const {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  shell,
  Tray,
} = require('electron');
const { execFile } = require('child_process');
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
let gameWatcherTimer = null;
let isCheckingProcesses = false;
const startHidden = process.argv.includes('--hidden');

const HOTKEY_HIGHLIGHT = 'F9';
const TEMP_RETENTION_MS = 90 * 60 * 1000;
const MAX_TEMP_SEGMENTS = 120;

const runtimeCaptureState = {
  activeGame: null, // 'VALORANT' | 'PUBG' | null
  overwolfInstalled: false,
  overwolfInstallPath: null,
  overwolfRunning: false,
  desktopCaptureEnabled: true,
  captureCompatMode: 'wgc', // 'wgc' | 'dxgi'
  captureQuality: '720p30', // '720p30' | '1080p60'
  preferredScreenId: null,
  hotkeyRegistered: false,
};

function readInitialPrefsSyncForSwitches() {
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'background-prefs.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.captureCompatMode === 'dxgi') {
      runtimeCaptureState.captureCompatMode = 'dxgi';
      app.commandLine.appendSwitch('disable-features', 'AllowWgcScreenCapturer');
    }
    if (parsed?.captureQuality === '1080p60') {
      runtimeCaptureState.captureQuality = '1080p60';
    }
    if (typeof parsed?.preferredScreenId === 'string' && parsed.preferredScreenId) {
      runtimeCaptureState.preferredScreenId = parsed.preferredScreenId;
    }
  } catch {
    // Su dung mac dinh WGC + 720p30 neu chua co file cau hinh
  }
}

readInitialPrefsSyncForSwitches();

function getAppIconPath() {
  const distIcon = path.join(__dirname, '../dist/launcher_icon.ico');
  const publicIcon = path.join(__dirname, '../public/launcher_icon.ico');
  return fs.existsSync(distIcon) ? distIcon : publicIcon;
}

function getPrefsPath() {
  return path.join(app.getPath('userData'), 'background-prefs.json');
}

function getTempSegmentsDir() {
  const dir = path.join(app.getPath('userData'), 'temp-segments');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSegmentsIndexPath() {
  return path.join(getTempSegmentsDir(), 'segments.json');
}

function getHighlightsDir() {
  let videosDir = '';
  try {
    videosDir = app.getPath('videos');
  } catch {
    videosDir = app.getPath('userData');
  }
  const targetDir = path.join(videosDir, 'TacticalReplayAI');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

function readBackgroundPrefs() {
  try {
    const raw = fs.readFileSync(getPrefsPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeBackgroundPrefs(partial) {
  const current = readBackgroundPrefs() || {};
  const next = { ...current, ...partial };
  try {
    fs.writeFileSync(getPrefsPath(), JSON.stringify(next, null, 2), 'utf8');
  } catch {
    // Bo qua neu khong ghi duoc file cau hinh cuc bo
  }
  return next;
}

function readSegmentsIndex() {
  try {
    const raw = fs.readFileSync(getSegmentsIndexPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSegmentsIndex(list) {
  try {
    fs.writeFileSync(getSegmentsIndexPath(), JSON.stringify(list, null, 2), 'utf8');
  } catch {
    // Bo qua loi ghi index
  }
}

function pruneTempSegments() {
  const cutoffMs = Date.now() - TEMP_RETENTION_MS;
  const list = readSegmentsIndex();
  const kept = [];
  let tempCount = 0;

  // Giu cac ban F9/highlight da promote hoac segment con trong khung thoi gian
  const sortedNewestFirst = [...list].sort((a, b) => b.endMs - a.endMs);
  for (const seg of sortedNewestFirst) {
    if (seg.promoted) {
      if (seg.permanentPath && fs.existsSync(seg.permanentPath)) {
        kept.push(seg);
      }
      continue;
    }

    const exists = seg.filePath && fs.existsSync(seg.filePath);
    if (!exists) continue;

    if (seg.endMs < cutoffMs || tempCount >= MAX_TEMP_SEGMENTS) {
      try {
        fs.unlinkSync(seg.filePath);
      } catch {
        // Bo qua neu file dang mo
      }
      continue;
    }
    tempCount += 1;
    kept.push(seg);
  }

  kept.sort((a, b) => a.startMs - b.startMs);
  writeSegmentsIndex(kept);
}

function showDesktopNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: getAppIconPath(),
      }).show();
    }
  } catch {
    // Bo qua neu OS tat thong bao
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

function initDefaultPrefs() {
  const existing = readBackgroundPrefs();
  if (existing && existing.autoStartConfigured) {
    runtimeCaptureState.desktopCaptureEnabled =
      existing.desktopCaptureEnabled !== undefined ? Boolean(existing.desktopCaptureEnabled) : true;
    if (app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin')) {
      app.setLoginItemSettings({
        openAtLogin: Boolean(existing.autoStart),
        args: existing.autoStart ? ['--hidden'] : [],
      });
    }
    return;
  }

  const defaultAutoStart = app.isPackaged;
  runtimeCaptureState.desktopCaptureEnabled = true;
  writeBackgroundPrefs({
    autoStartConfigured: true,
    autoStart: defaultAutoStart,
    desktopCaptureEnabled: true,
  });

  if (defaultAutoStart && (process.platform === 'win32' || process.platform === 'darwin')) {
    app.setLoginItemSettings({
      openAtLogin: true,
      args: ['--hidden'],
    });
  }
}

function getCapturePayload() {
  return {
    activeGame: runtimeCaptureState.activeGame,
    overwolfInstalled: runtimeCaptureState.overwolfInstalled,
    overwolfInstallPath: runtimeCaptureState.overwolfInstallPath,
    overwolfRunning: runtimeCaptureState.overwolfRunning,
    desktopCaptureEnabled: runtimeCaptureState.desktopCaptureEnabled,
    captureCompatMode: runtimeCaptureState.captureCompatMode,
    captureQuality: runtimeCaptureState.captureQuality,
    preferredScreenId: runtimeCaptureState.preferredScreenId,
    hotkeyRegistered: runtimeCaptureState.hotkeyRegistered,
    hotkey: HOTKEY_HIGHLIGHT,
    shouldRecord: Boolean(
      runtimeCaptureState.activeGame &&
        runtimeCaptureState.desktopCaptureEnabled &&
        !runtimeCaptureState.overwolfRunning
    ),
  };
}

function broadcastCaptureState() {
  refreshTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('capture:state-changed', getCapturePayload());
  }
}

function checkRegistryKey(regKey) {
  return new Promise((resolve) => {
    execFile('reg', ['query', regKey], { windowsHide: true, timeout: 2500 }, (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

async function detectOverwolfInstalled() {
  if (process.platform !== 'win32') {
    runtimeCaptureState.overwolfInstalled = false;
    runtimeCaptureState.overwolfInstallPath = null;
    return false;
  }

  const candidatePaths = [
    process.env['ProgramFiles(x86)']
      ? path.join(process.env['ProgramFiles(x86)'], 'Overwolf', 'Overwolf.exe')
      : '',
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, 'Overwolf', 'Overwolf.exe')
      : '',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Overwolf', 'Overwolf.exe')
      : '',
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      runtimeCaptureState.overwolfInstalled = true;
      runtimeCaptureState.overwolfInstallPath = p;
      return true;
    }
  }

  const regKeys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Overwolf',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Overwolf',
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Overwolf',
  ];

  for (const key of regKeys) {
    const found = await checkRegistryKey(key);
    if (found) {
      runtimeCaptureState.overwolfInstalled = true;
      runtimeCaptureState.overwolfInstallPath = key;
      return true;
    }
  }

  runtimeCaptureState.overwolfInstalled = false;
  runtimeCaptureState.overwolfInstallPath = null;
  return false;
}

function scanRunningProcesses() {
  if (process.platform !== 'win32' || isCheckingProcesses) return;
  isCheckingProcesses = true;

  execFile('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true, timeout: 4000 }, (err, stdout) => {
    isCheckingProcesses = false;
    if (err || !stdout) return;

    const lower = stdout.toLowerCase();
    let detectedGame = null;
    if (lower.includes('valorant-win64-shipping.exe')) {
      detectedGame = 'VALORANT';
    } else if (lower.includes('tslgame.exe')) {
      detectedGame = 'PUBG';
    }

    const owRunning = lower.includes('overwolf.exe');
    if (owRunning && !runtimeCaptureState.overwolfInstalled) {
      runtimeCaptureState.overwolfInstalled = true;
    }

    const changed =
      runtimeCaptureState.activeGame !== detectedGame ||
      runtimeCaptureState.overwolfRunning !== owRunning;

    runtimeCaptureState.activeGame = detectedGame;
    runtimeCaptureState.overwolfRunning = owRunning;

    if (changed) {
      syncHotkeyRegistration();
      broadcastCaptureState();
    }
  });
}

function triggerHotkeyCapture() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!runtimeCaptureState.desktopCaptureEnabled || runtimeCaptureState.overwolfRunning) return;
  mainWindow.webContents.send('capture:hotkey-highlight', {
    activeGame: runtimeCaptureState.activeGame,
    triggeredAtMs: Date.now(),
  });
}

function syncHotkeyRegistration() {
  try {
    globalShortcut.unregister(HOTKEY_HIGHLIGHT);
  } catch {
    // Bo qua neu chua dang ky
  }
  runtimeCaptureState.hotkeyRegistered = false;

  if (!runtimeCaptureState.desktopCaptureEnabled || runtimeCaptureState.overwolfRunning) {
    return;
  }

  try {
    const ok = globalShortcut.register(HOTKEY_HIGHLIGHT, () => {
      triggerHotkeyCapture();
    });
    runtimeCaptureState.hotkeyRegistered = Boolean(ok);
  } catch {
    runtimeCaptureState.hotkeyRegistered = false;
  }
}

function setDesktopCaptureEnabled(enabled) {
  const next = Boolean(enabled);
  runtimeCaptureState.desktopCaptureEnabled = next;
  writeBackgroundPrefs({ desktopCaptureEnabled: next });
  syncHotkeyRegistration();
  broadcastCaptureState();
  return next;
}

function startGameWatcher() {
  if (gameWatcherTimer) clearInterval(gameWatcherTimer);
  scanRunningProcesses();
  gameWatcherTimer = setInterval(scanRunningProcesses, 5000);
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
  const payload = getCapturePayload();
  const statusLabel = payload.shouldRecord
    ? `Đang quay Highlight (${payload.activeGame})`
    : payload.overwolfRunning
      ? 'Overwolf đang phụ trách quay'
      : payload.desktopCaptureEnabled
        ? 'Đang chờ vào VALORANT / PUBG'
        : 'Tự động quay Highlight đang tắt';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: statusLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Mở TacticalReplayAI',
      click: () => showMainWindow(),
    },
    {
      label: `Cắt Highlight ngay (${HOTKEY_HIGHLIGHT})`,
      enabled: payload.desktopCaptureEnabled && !payload.overwolfRunning,
      click: () => triggerHotkeyCapture(),
    },
    {
      label: 'Tự quay Highlight trong game (.exe)',
      type: 'checkbox',
      checked: runtimeCaptureState.desktopCaptureEnabled,
      click: (menuItem) => {
        setDesktopCaptureEnabled(menuItem.checked);
      },
    },
    {
      label: 'Tự khởi động ngầm cùng Windows',
      type: 'checkbox',
      checked: autoStart,
      click: (menuItem) => {
        setAutoStartEnabled(menuItem.checked);
      },
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
  tray.setToolTip('TacticalReplayAI - Chạy ngầm & Tự quay Highlight');
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
    desktopCaptureEnabled: runtimeCaptureState.desktopCaptureEnabled,
  };
});

ipcMain.handle('background:set-auto-start', (_event, enabled) => {
  const nextVal = setAutoStartEnabled(enabled);
  return { autoStart: nextVal };
});

ipcMain.handle('capture:get-status', async () => {
  await detectOverwolfInstalled();
  return getCapturePayload();
});

ipcMain.handle('capture:check-overwolf', async () => {
  await detectOverwolfInstalled();
  broadcastCaptureState();
  return {
    installed: runtimeCaptureState.overwolfInstalled,
    installPath: runtimeCaptureState.overwolfInstallPath,
    running: runtimeCaptureState.overwolfRunning,
  };
});

ipcMain.handle('capture:open-overwolf-download', async () => {
  await shell.openExternal('https://www.overwolf.com/');
  return { opened: true };
});

ipcMain.handle('capture:set-desktop-capture', (_event, enabled) => {
  const next = setDesktopCaptureEnabled(enabled);
  return { desktopCaptureEnabled: next, status: getCapturePayload() };
});

ipcMain.handle('capture:list-screens', async () => {
  const primaryId = String(screen.getPrimaryDisplay()?.id || '');
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 },
  });
  return sources.map((s, idx) => ({
    id: s.id,
    name: s.name || `Màn hình ${idx + 1}`,
    displayId: String(s.display_id || ''),
    isPrimary: Boolean(primaryId && String(s.display_id || '') === primaryId),
  }));
});

ipcMain.handle('capture:set-capture-options', (_event, payload) => {
  const prevCompat = runtimeCaptureState.captureCompatMode;
  const nextCompat = payload?.captureCompatMode === 'dxgi' ? 'dxgi' : 'wgc';
  const nextQuality = payload?.captureQuality === '1080p60' ? '1080p60' : '720p30';
  const nextScreenId =
    payload?.preferredScreenId === null
      ? null
      : typeof payload?.preferredScreenId === 'string' && payload.preferredScreenId.trim()
        ? payload.preferredScreenId.trim()
        : runtimeCaptureState.preferredScreenId;

  runtimeCaptureState.captureCompatMode = nextCompat;
  runtimeCaptureState.captureQuality = nextQuality;
  runtimeCaptureState.preferredScreenId = nextScreenId;

  writeBackgroundPrefs({
    captureCompatMode: nextCompat,
    captureQuality: nextQuality,
    preferredScreenId: nextScreenId,
  });

  broadcastCaptureState();
  return {
    requiresRestart: prevCompat !== nextCompat,
    status: getCapturePayload(),
  };
});

ipcMain.handle('capture:relaunch-app', () => {
  isQuitting = true;
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('capture:get-screen-source', async () => {
  const primaryId = String(screen.getPrimaryDisplay()?.id || '');
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 },
  });
  if (sources.length === 0) return null;

  const preferred =
    runtimeCaptureState.preferredScreenId &&
    sources.find((s) => s.id === runtimeCaptureState.preferredScreenId);
  const primary =
    primaryId && sources.find((s) => String(s.display_id || '') === primaryId);
  const chosen = preferred || primary || sources[0];

  return { id: chosen.id, name: chosen.name };
});

ipcMain.handle('capture:save-temp-segment', (_event, payload) => {
  const { gameType, startMs, endMs, bytes } = payload || {};
  if (!bytes || !bytes.length) return { saved: false };

  const dir = getTempSegmentsDir();
  const safeGame = gameType === 'VALORANT' ? 'VALORANT' : 'PUBG';
  const id = `seg_${safeGame}_${startMs}`;
  const filePath = path.join(dir, `${id}.webm`);

  fs.writeFileSync(filePath, Buffer.from(bytes));

  const list = readSegmentsIndex();
  list.push({
    id,
    gameType: safeGame,
    filePath,
    startMs: Number(startMs),
    endMs: Number(endMs),
    durationSec: Math.max(1, Math.round((Number(endMs) - Number(startMs)) / 1000)),
    isF9: false,
    promoted: false,
    attachedMatchId: null,
  });
  writeSegmentsIndex(list);
  pruneTempSegments();

  return { saved: true, id, filePath };
});

ipcMain.handle('capture:promote-f9-highlight', (_event, payload) => {
  const { gameType, startMs, endMs, bytes } = payload || {};
  const safeGame = gameType === 'VALORANT' ? 'VALORANT' : 'PUBG';
  const highlightsDir = getHighlightsDir();
  const list = readSegmentsIndex();
  const now = Date.now();
  const durationMs = Math.max(0, Number(endMs || now) - Number(startMs || now));

  let savedFilePath = '';
  let savedFileName = '';
  let savedStartMs = Number(startMs || now);
  let savedEndMs = Number(endMs || now);

  if (bytes && bytes.length > 0 && durationMs >= 6000) {
    savedFileName = `F9_${safeGame}_${now}.webm`;
    savedFilePath = path.join(highlightsDir, savedFileName);
    fs.writeFileSync(savedFilePath, Buffer.from(bytes));

    list.push({
      id: `f9_${safeGame}_${now}`,
      gameType: safeGame,
      filePath: savedFilePath,
      permanentPath: savedFilePath,
      fileName: savedFileName,
      startMs: savedStartMs,
      endMs: savedEndMs,
      durationSec: Math.max(1, Math.round(durationMs / 1000)),
      isF9: true,
      promoted: true,
      attachedMatchId: null,
    });
    writeSegmentsIndex(list);
  } else {
    // Neu doan dang quay qua ngan (< 6s), promote ngay doan 25s lien truoc do
    const recentPrev = [...list]
      .filter((s) => !s.promoted && !s.isF9 && s.gameType === safeGame && now - s.endMs < 35000)
      .sort((a, b) => b.endMs - a.endMs)[0];

    if (recentPrev && fs.existsSync(recentPrev.filePath)) {
      savedFileName = `F9_${safeGame}_${now}.webm`;
      savedFilePath = path.join(highlightsDir, savedFileName);
      fs.copyFileSync(recentPrev.filePath, savedFilePath);
      try {
        fs.unlinkSync(recentPrev.filePath);
      } catch {
        // Bo qua
      }
      recentPrev.promoted = true;
      recentPrev.isF9 = true;
      recentPrev.permanentPath = savedFilePath;
      recentPrev.fileName = savedFileName;
      savedStartMs = recentPrev.startMs;
      savedEndMs = recentPrev.endMs;
      writeSegmentsIndex(list);
    } else if (bytes && bytes.length > 0) {
      savedFileName = `F9_${safeGame}_${now}.webm`;
      savedFilePath = path.join(highlightsDir, savedFileName);
      fs.writeFileSync(savedFilePath, Buffer.from(bytes));
      list.push({
        id: `f9_${safeGame}_${now}`,
        gameType: safeGame,
        filePath: savedFilePath,
        permanentPath: savedFilePath,
        fileName: savedFileName,
        startMs: savedStartMs,
        endMs: savedEndMs,
        durationSec: Math.max(1, Math.round(durationMs / 1000)),
        isF9: true,
        promoted: true,
        attachedMatchId: null,
      });
      writeSegmentsIndex(list);
    }
  }

  if (savedFilePath) {
    showDesktopNotification(
      'TacticalReplayAI - Đã cắt Highlight (F9)',
      `Đã lưu clip ${savedFileName} vào thư mục Videos/TacticalReplayAI.`
    );
    return {
      saved: true,
      filePath: savedFilePath,
      fileName: savedFileName,
      durationSec: Math.max(1, Math.round((savedEndMs - savedStartMs) / 1000)),
      recordedAt: new Date(savedEndMs).toISOString(),
    };
  }

  return { saved: false };
});

ipcMain.handle('capture:match-kill-segments', (_event, payload) => {
  const { matchId, gameType, matchStartMs, matchEndMs, killEpochsMs } = payload || {};
  if (!matchId || !gameType || !matchStartMs) return { clips: [] };

  const safeMatchId = String(matchId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const highlightsDir = getHighlightsDir();
  const list = readSegmentsIndex();
  const kills = Array.isArray(killEpochsMs) ? killEpochsMs.map(Number).filter(Number.isFinite) : [];
  const winStartLimit = Number(matchStartMs) - 10000;
  const winEndLimit = Number(matchEndMs || Number(matchStartMs) + 5400000) + 15000;

  const promotedClips = [];
  const updatedList = [];

  for (const seg of list) {
    if (seg.gameType !== gameType) {
      updatedList.push(seg);
      continue;
    }

    // Gan clip F9 duoc bam trong thoi gian tran dau
    if (seg.isF9 && seg.promoted && !seg.attachedMatchId) {
      if (seg.endMs >= winStartLimit && seg.startMs <= winEndLimit && seg.permanentPath && fs.existsSync(seg.permanentPath)) {
        seg.attachedMatchId = matchId;
        promotedClips.push({
          filePath: seg.permanentPath,
          fileName: seg.fileName || path.basename(seg.permanentPath),
          durationSec: seg.durationSec || 25,
          recordedAt: new Date(seg.endMs).toISOString(),
        });
      }
      updatedList.push(seg);
      continue;
    }

    if (seg.promoted) {
      updatedList.push(seg);
      continue;
    }

    const exists = seg.filePath && fs.existsSync(seg.filePath);
    if (!exists) continue;

    // Kiem tra xem segment nay co trung voi bat ky mang Kill nao khong
    const hitsKill = kills.some((killMs) => {
      const kWinStart = killMs - 20000;
      const kWinEnd = killMs + 8000;
      return seg.endMs >= kWinStart && seg.startMs <= kWinEnd;
    });

    if (hitsKill) {
      const clipName = `${safeMatchId}_h${promotedClips.length + 1}.webm`;
      const permanentPath = path.join(highlightsDir, clipName);
      try {
        fs.copyFileSync(seg.filePath, permanentPath);
        try {
          fs.unlinkSync(seg.filePath);
        } catch {
          // Bo qua
        }
        seg.promoted = true;
        seg.permanentPath = permanentPath;
        seg.fileName = clipName;
        seg.attachedMatchId = matchId;
        promotedClips.push({
          filePath: permanentPath,
          fileName: clipName,
          durationSec: seg.durationSec || 25,
          recordedAt: new Date(seg.endMs).toISOString(),
        });
        updatedList.push(seg);
        continue;
      } catch {
        // Neu copy loi giu nguyen
      }
    }

    // Don sach segment tam nam trong khung thoi gian tran da ket thuc nhung khong co Kill
    if (seg.endMs >= winStartLimit && seg.startMs <= winEndLimit) {
      try {
        fs.unlinkSync(seg.filePath);
      } catch {
        // Bo qua
      }
      continue;
    }

    updatedList.push(seg);
  }

  writeSegmentsIndex(updatedList);
  return { clips: promotedClips };
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
      backgroundThrottling: false, // Giu MediaRecorder hoat dong on dinh khi an xuong System Tray
    },
  });

  mainWindow = win;

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

  win.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode === -3) return;
    win.loadFile(indexHtmlPath);
  });

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

  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  }, 3000);
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (gameWatcherTimer) clearInterval(gameWatcherTimer);
  try {
    globalShortcut.unregisterAll();
  } catch {
    // Bo qua
  }
});

app.whenReady().then(async () => {
  initDefaultPrefs();
  pruneTempSegments();
  await detectOverwolfInstalled();
  setupAutoUpdater();
  createTray();
  createMainWindow(false);
  syncHotkeyRegistration();
  startGameWatcher();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});
