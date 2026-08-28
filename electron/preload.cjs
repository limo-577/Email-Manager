const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emailManager', {

  // ============================================================
  // Browser
  // ============================================================

  openBrowserProfile: (browser, profile, url) =>
    ipcRenderer.invoke('open-browser-profile', {
      browser,
      profile,
      url
    }),


  // ============================================================
  // Data
  // ============================================================

  saveEmailData: (data) =>
    ipcRenderer.invoke('save-email-data', data),

  loadEmailData: () =>
    ipcRenderer.invoke('load-email-data'),


  // ============================================================
  // Export
  // ============================================================

  exportEmailData: (data) =>
    ipcRenderer.invoke('export-email-data', data),


  // ============================================================
  // Toolbar
  // ============================================================

  openToolbar: () =>
    ipcRenderer.invoke('open-toolbar'),

  closeToolbar: () =>
    ipcRenderer.invoke('close-toolbar'),

  setToolbarAlwaysOnTop: (value) =>
    ipcRenderer.invoke(
      'set-toolbar-always-on-top',
      value
    ),


  // ============================================================
  // Open Main Window
  // ============================================================

  openMainWindow: () =>
    ipcRenderer.invoke('open-main-window'),


  // ============================================================
  // Real-time data update
  // ============================================================

  onEmailDataUpdated: (callback) => {

    const listener = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on(
      'email-data-updated',
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        'email-data-updated',
        listener
      );
    };
  },


  // ============================================================
  // Manual broadcast
  // ============================================================

  broadcastData: (data) =>
    ipcRenderer.invoke(
      'broadcast-email-data',
      data
    )

});