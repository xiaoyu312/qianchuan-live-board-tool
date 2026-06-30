const { app, BrowserWindow, dialog, ipcMain, webContents } = require("electron");
const fs = require("fs");
const path = require("path");

process.on("uncaughtException", (error) => {
  if (String(error && error.message).includes("Render frame was disposed before WebFrameMain could be accessed")) {
    return;
  }
  throw error;
});

const metrics = [
  "净成交订单数",
  "净成交订单成本(元)",
  "用户实际支付净成交金额(元)",
  "净成交金额结算率",
  "净成交订单结算率",
  "1小时内退款订单数",
  "1小时内退款金额(元)",
  "1小时内退款率",
  "整体成交订单数",
  "GPM(元)",
  "观看成交转化率",
  "整体成交订单成本(元)",
  "用户实际支付金额(元)",
  "整体成交智能优惠券金额(元)",
  "电商平台补贴金额(元)",
  "整体未完结预售订单预估金额(元)",
  "直播间退款金额(元)",
  "直播间退款率",
  "实时在线人数",
  "直播间整体曝光次数",
  "曝光观看率(次数)",
  "直播间整体观看人数",
  "直播间平均停留时长(整场)",
  "直播间整体新增粉丝数",
  "直播间评论次数",
  "直播间商品曝光次数",
  "直播间商品点击次数",
  "分享次数",
  "分享率",
  "打赏次数",
  "点赞率",
  "整体消耗(元)",
  "整体支付ROI",
  "整体成交金额(元)",
  "净成交ROI",
  "净成交金额(元)"
];
const calculatedMetrics = ["商品点击率", "商品转化率"];
const outputMetrics = metrics.flatMap((metric) =>
  metric === "直播间商品点击次数" ? [metric, ...calculatedMetrics] : [metric]
);

const cumulativeName = "直播大屏累计数据.csv";
const intervalName = "直播大屏5分钟时段数据.csv";
const rawName = "直播大屏采集日志.jsonl";

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1180,
    minHeight: 760,
    title: "千川直播大屏采集工具",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(String(url || ""))) {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) win.webContents.send("open-tab", url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
});

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  fs.writeFileSync(
    file,
    "\ufeff" + headers.map(csvEscape).join(",") + "\n" + rows.map((row) =>
      headers.map((header) => csvEscape(Object.hasOwn(row, header) ? row[header] : "")).join(",")
    ).join("\n") + "\n",
    "utf8"
  );
}

function datePrefix(value = "") {
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function datedName(name, dateText) {
  return `${datePrefix(dateText)}_${name}`;
}

ipcMain.handle("read-board-text", async () => {
  let best = { text: "", url: "" };
  let bestScore = -1;
  for (const contents of webContents.getAllWebContents()) {
    if (contents.isDestroyed()) continue;
    try {
      const result = await contents.executeJavaScript(
        "({ text: document.body ? document.body.innerText : '', url: location.href })",
        true
      );
      const text = result && result.text ? result.text : "";
      const url = result && result.url ? result.url : "";
      const score = metrics.filter((metric) => text.includes(metric)).length + (url.includes("qianchuan") ? 1 : 0);
      if (score > bestScore) {
        best = { text, url };
        bestScore = score;
      }
    } catch (_error) {
      // Page changed while reading; next 5-minute tick will read the settled page.
    }
  }
  return best;
});

ipcMain.handle("export-data", async (_event, payload) => {
  const result = await dialog.showOpenDialog({
    title: "选择表格导出位置",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const outputDir = result.filePaths[0];
  const dateText = payload.cumulativeRows && payload.cumulativeRows[0] && payload.cumulativeRows[0]["采集时间"];
  const cumulativeFile = path.join(outputDir, datedName(cumulativeName, dateText));
  const intervalFile = path.join(outputDir, datedName(intervalName, dateText));
  const rawFile = path.join(outputDir, datedName(rawName, dateText));

  writeCsv(cumulativeFile, ["采集时间", "主播", ...outputMetrics], payload.cumulativeRows || []);
  writeCsv(intervalFile, ["时段开始", "时段结束", "主播", ...outputMetrics], payload.intervalRows || []);
  fs.writeFileSync(rawFile, (payload.logs || []).map((item) => JSON.stringify(item)).join("\n") + "\n", "utf8");
  return { cumulativeFile, intervalFile, rawFile };
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
