const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qianchuanApp", {
  readBoardText: () => ipcRenderer.invoke("read-board-text"),
  exportData: (payload) => ipcRenderer.invoke("export-data", payload),
  onOpenTab: (callback) => ipcRenderer.on("open-tab", (_event, url) => callback(url))
});
