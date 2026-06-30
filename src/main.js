const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

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

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function appendCsv(file, headers, row) {
  const exists = fs.existsSync(file);
  if (exists) {
    const firstLine = fs.readFileSync(file, "utf8").replace(/^\ufeff/, "").split(/\r?\n/)[0] || "";
    const expected = headers.map(csvEscape).join(",");
    if (firstLine !== expected) {
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const parsed = path.parse(file);
      fs.renameSync(file, path.join(parsed.dir, `${parsed.name}_旧格式_${stamp}${parsed.ext}`));
    }
  }
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "\ufeff" + headers.map(csvEscape).join(",") + "\n", "utf8");
  }
  fs.appendFileSync(
    file,
    headers.map((header) => csvEscape(Object.hasOwn(row, header) ? row[header] : "")).join(",") + "\n",
    "utf8"
  );
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function lastCsvRow(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").replace(/^\ufeff/, "").trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = parseCsvLine(lines[0]);
  const values = parseCsvLine(lines[lines.length - 1]);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
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

ipcMain.handle("choose-output-dir", async () => {
  const result = await dialog.showOpenDialog({
    title: "选择表格保存位置",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return "";
  return result.filePaths[0];
});

ipcMain.handle("get-last-cumulative", async (_event, outputDir) => {
  return lastCsvRow(path.join(outputDir, datedName(cumulativeName)));
});

ipcMain.handle("save-capture", async (_event, payload) => {
  const outputDir = payload.outputDir;
  fs.mkdirSync(outputDir, { recursive: true });
  const dateText = payload.cumulative && payload.cumulative["采集时间"];
  const cumulativeFile = path.join(outputDir, datedName(cumulativeName, dateText));
  const intervalFile = path.join(outputDir, datedName(intervalName, dateText));
  const rawFile = path.join(outputDir, datedName(rawName, dateText));

  appendCsv(cumulativeFile, ["采集时间", "主播", ...outputMetrics], payload.cumulative);
  if (payload.interval) {
    appendCsv(intervalFile, ["时段开始", "时段结束", "主播", ...outputMetrics], payload.interval);
  }
  fs.appendFileSync(rawFile, JSON.stringify(payload.log, null, 0) + "\n", "utf8");
  return { cumulativeFile, intervalFile, rawFile };
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
