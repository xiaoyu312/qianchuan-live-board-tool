const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qianchuanApp", {
  chooseOutputDir: () => ipcRenderer.invoke("choose-output-dir"),
  getLastCumulative: (outputDir) => ipcRenderer.invoke("get-last-cumulative", outputDir),
  saveCapture: (payload) => ipcRenderer.invoke("save-capture", payload)
});
