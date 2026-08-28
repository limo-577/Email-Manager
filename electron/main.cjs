const {
  app,
  BrowserWindow,
  shell,
  session,
  ipcMain,
  dialog
} = require('electron');

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow = null;
let toolbarWindow = null;


// ============================================================
// Paths
// ============================================================

function getDataPath() {
  return path.join(app.getPath('userData'), 'email-data.json');
}

function getOpenBrowserScript() {
  return isDev
    ? path.join(__dirname, 'OpenBrowser.ps1')
    : path.join(process.resourcesPath, 'OpenBrowser.ps1');
}


// ============================================================
// Profile
// ============================================================

function normalizeProfile(profile) {
  if (!profile) return '';

  const value = String(profile).trim();

  return /^\d+$/.test(value)
    ? `Profile ${value}`
    : value;
}


// ============================================================
// Browser Profile URL
// ============================================================

function encodeBrowserProfileUrl(browser, profile, url) {
  const params = new URLSearchParams();

  params.set('browser', browser || 'Chrome');
  params.set('profile', normalizeProfile(profile));

  if (url) {
    params.set('url', url);
  }

  return `browserprofile://open?${params.toString()}`;
}


// ============================================================
// Launch browser
// ============================================================

function launchBrowserProfile(browser, profile, url) {

  return new Promise((resolve, reject) => {

    const cleanProfile = normalizeProfile(profile);

    if (!cleanProfile) {
      reject(new Error('没有设置 Chrome / Edge / Brave Profile'));
      return;
    }

    const script = getOpenBrowserScript();

    const browserProfileUrl = encodeBrowserProfileUrl(
      browser,
      cleanProfile,
      url
    );

    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        browserProfileUrl
      ],
      {
        windowsHide: true
      }
    );

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {

      if (code === 0) {
        resolve({ ok: true });
      } else {
        reject(
          new Error(
            stderr.trim() ||
            `OpenBrowser.ps1 exited with code ${code}`
          )
        );
      }

    });

  });
}


// ============================================================
// Save data
// ============================================================

function saveData(data) {

  const file = getDataPath();

  try {

    fs.mkdirSync(path.dirname(file), {
      recursive: true
    });

    fs.writeFileSync(
      file,
      JSON.stringify(data || [], null, 2),
      'utf8'
    );

    return {
      ok: true
    };

  } catch (error) {

    return {
      ok: false,
      error: error.message
    };

  }
}


// ============================================================
// Load data
// ============================================================

function loadData() {

  const file = getDataPath();

  try {

    if (!fs.existsSync(file)) {
      return {
        ok: true,
        data: []
      };
    }

    const content = fs.readFileSync(
      file,
      'utf8'
    );

    const data = JSON.parse(content);

    return {
      ok: true,
      data: Array.isArray(data)
        ? data
        : []
    };

  } catch (error) {

    return {
      ok: false,
      data: [],
      error: error.message
    };

  }
}


// ============================================================
// Broadcast data
// ============================================================

function broadcastData(data) {

  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {

    mainWindow.webContents.send(
      'email-data-updated',
      data
    );
  }

  if (
    toolbarWindow &&
    !toolbarWindow.isDestroyed()
  ) {

    toolbarWindow.webContents.send(
      'email-data-updated',
      data
    );
  }

}


// ============================================================
// Main window
// ============================================================

function createWindow() {

  mainWindow = new BrowserWindow({

    width: 1180,
    height: 820,

    minWidth: 900,
    minHeight: 620,

    backgroundColor: '#020617',

    autoHideMenuBar: true,

    webPreferences: {

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: true,

      preload: path.join(
        __dirname,
        'preload.cjs'
      )
    }

  });


  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {

      shell.openExternal(url);

      return {
        action: 'deny'
      };

    }
  );


  mainWindow.webContents.on(
    'will-navigate',
    (event, url) => {

      const current =
        mainWindow.webContents.getURL();

      if (url !== current) {

        event.preventDefault();

        shell.openExternal(url);

      }

    }
  );


  if (isDev) {

    mainWindow.loadURL(
      'http://127.0.0.1:5173'
    );

  } else {

    mainWindow.loadFile(
      path.join(
        __dirname,
        '..',
        'dist',
        'index.html'
      )
    );

  }


  mainWindow.on(
    'closed',
    () => {

      mainWindow = null;

    }
  );

}


// ============================================================
// Toolbar window
// ============================================================

function createToolbar() {

  if (
    toolbarWindow &&
    !toolbarWindow.isDestroyed()
  ) {

    toolbarWindow.show();

    toolbarWindow.focus();

    return;
  }


  toolbarWindow = new BrowserWindow({

    width: 320,

    height: 260,

    minWidth: 260,

    minHeight: 100,

    maxWidth: 500,

    maxHeight: 700,

    backgroundColor: '#020617',

    frame: true,

    resizable: true,

    minimizable: false,

    maximizable: false,

    autoHideMenuBar: true,

    alwaysOnTop: true,

    webPreferences: {

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: true,

      preload: path.join(
        __dirname,
        'preload.cjs'
      )

    }

  });


  if (isDev) {

    toolbarWindow.loadURL(
      'http://127.0.0.1:5173?toolbar=1'
    );

  } else {

    toolbarWindow.loadFile(
      path.join(
        __dirname,
        '..',
        'dist',
        'index.html'
      ),
      {
        query: {
          toolbar: '1'
        }
      }
    );

  }


  toolbarWindow.on(
    'closed',
    () => {

      toolbarWindow = null;

    }
  );

}


// ============================================================
// IPC - Browser
// ============================================================

ipcMain.handle(
  'open-browser-profile',
  async (
    _event,
    {
      browser,
      profile,
      url
    }
  ) => {

    try {

      await launchBrowserProfile(
        browser,
        profile,
        url
      );

      return {
        ok: true
      };

    } catch (error) {

      return {
        ok: false,
        error: error.message
      };

    }

  }
);


// ============================================================
// IPC - Save
// ============================================================

ipcMain.handle(
  'save-email-data',
  async (_event, data) => {

    const result = saveData(data);

    if (result.ok) {
      broadcastData(data);
    }

    return result;

  }
);


// ============================================================
// IPC - Load
// ============================================================

ipcMain.handle(
  'load-email-data',
  async () => {

    return loadData();

  }
);


// ============================================================
// IPC - Export
// ============================================================

ipcMain.handle(
  'export-email-data',
  async (_event, data) => {

    try {

      const result =
        await dialog.showSaveDialog(
          mainWindow,
          {

            title: '导出邮箱数据',

            defaultPath:
              `email-manager-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`,

            filters: [
              {
                name: 'CSV 文件',
                extensions: ['csv']
              }
            ]

          }
        );


      if (result.canceled) {

        return {
          ok: false,
          canceled: true
        };

      }


      const rows = Array.isArray(data)
        ? data
        : [];


      const header = [
        '编号',
        '邮箱链接',
        '浏览器',
        'Profile',
        '使用时间',
        '已用时长',
        '状态'
      ];


      const csvRows = [
        header,

        ...rows.map((item, index) => [

          item.id ?? index + 1,

          item.email ?? '',

          item.browser ?? '',

          item.profile ?? '',

          item.usedAt
            ? new Date(item.usedAt)
                .toLocaleString()
            : '',

          item.usedAt
            ? formatDuration(
                Date.now() - item.usedAt
              )
            : '',

          item.status === 'used'
            ? '已使用'
            : '可用'

        ])

      ];


      const csv = csvRows
        .map(row =>
          row
            .map(value =>
              `"${String(value ?? '')
                .replace(/"/g, '""')}"`
            )
            .join(',')
        )
        .join('\r\n');


      // UTF-8 BOM
      const content =
        '\uFEFF' + csv;


      fs.writeFileSync(
        result.filePath,
        content,
        'utf8'
      );


      return {
        ok: true,
        path: result.filePath
      };


    } catch (error) {

      return {
        ok: false,
        error: error.message
      };

    }

  }
);


// ============================================================
// Format duration
// ============================================================

function formatDuration(milliseconds) {

  if (
    !milliseconds ||
    milliseconds < 0
  ) {
    return '';
  }

  const totalMinutes =
    Math.floor(
      milliseconds / 60000
    );

  const days =
    Math.floor(
      totalMinutes / 1440
    );

  const hours =
    Math.floor(
      (totalMinutes % 1440) / 60
    );

  const minutes =
    totalMinutes % 60;


  if (days > 0) {

    return `${days}天 ${hours}小时`;

  }

  if (hours > 0) {

    return `${hours}小时 ${minutes}分钟`;

  }

  return `${minutes}分钟`;

}

// ============================================================
// IPC - Open Main Window
// ============================================================

ipcMain.handle(
  'open-main-window',
  async () => {

    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {

      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.show();
      mainWindow.focus();

    } else {

      createWindow();

    }

    return {
      ok: true
    };

  }
);


// ============================================================
// IPC - Toolbar
// ============================================================

ipcMain.handle(
  'open-toolbar',
  async () => {

    createToolbar();

    return {
      ok: true
    };

  }
);


ipcMain.handle(
  'close-toolbar',
  async () => {

    if (
      toolbarWindow &&
      !toolbarWindow.isDestroyed()
    ) {

      toolbarWindow.close();

    }

    toolbarWindow = null;

    return {
      ok: true
    };

  }
);


ipcMain.handle(
  'set-toolbar-always-on-top',
  async (
    _event,
    value
  ) => {

    if (
      toolbarWindow &&
      !toolbarWindow.isDestroyed()
    ) {

      toolbarWindow.setAlwaysOnTop(
        Boolean(value)
      );

    }

    return {
      ok: true
    };

  }
);


// ============================================================
// IPC - Broadcast
// ============================================================

ipcMain.handle(
  'broadcast-email-data',
  async (_event, data) => {

    broadcastData(data);

    return {
      ok: true
    };

  }
);


// ============================================================
// App ready
// ============================================================

app.whenReady().then(() => {

  session.defaultSession
    .setPermissionRequestHandler(
      (
        _webContents,
        permission,
        callback
      ) => {

        callback(
          permission === 'clipboard-read' ||
          permission ===
            'clipboard-sanitized-write'
        );

      }
    );


  createWindow();


  app.on(
    'activate',
    () => {

      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {

        createWindow();

      }

    }
  );

});


// ============================================================
// Close
// ============================================================

app.on(
  'window-all-closed',
  () => {

    if (
      process.platform !== 'darwin'
    ) {

      app.quit();

    }

  }
);