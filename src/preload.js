const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qianchuanApp", {
  chooseOutputDir: () => ipcRenderer.invoke("choose-output-dir"),
  getLastCumulative: (outputDir) => ipcRenderer.invoke("get-last-cumulative", outputDir),
  readBoardText: () => ipcRenderer.invoke("read-board-text"),
  saveCapture: (payload) => ipcRenderer.invoke("save-capture", payload),
  onOpenTab: (callback) => ipcRenderer.on("open-tab", (_event, url) => callback(url))
});
