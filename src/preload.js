const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

contextBridge.exposeInMainWorld("qianchuanApp", {
  webviewPreloadUrl: pathToFileURL(path.join(__dirname, "renderer", "webview-preload.js")).href,
  chooseOutputDir: () => ipcRenderer.invoke("choose-output-dir"),
  getLastCumulative: (outputDir) => ipcRenderer.invoke("get-last-cumulative", outputDir),
  saveCapture: (payload) => ipcRenderer.invoke("save-capture", payload)
});
