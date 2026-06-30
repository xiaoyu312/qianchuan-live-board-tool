const defaultUrl = "https://qianchuan.jinritemai.com/";

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
const deltaMetrics = new Set([
  "净成交订单数",
  "用户实际支付净成交金额(元)",
  "1小时内退款订单数",
  "1小时内退款金额(元)",
  "整体成交订单数",
  "用户实际支付金额(元)",
  "整体成交智能优惠券金额(元)",
  "电商平台补贴金额(元)",
  "整体未完结预售订单预估金额(元)",
  "直播间退款金额(元)",
  "直播间整体曝光次数",
  "直播间整体观看人数",
  "直播间整体新增粉丝数",
  "直播间评论次数",
  "直播间商品曝光次数",
  "直播间商品点击次数",
  "分享次数",
  "打赏次数",
  "整体消耗(元)",
  "整体成交金额(元)",
  "净成交金额(元)"
]);

const snapshotMetrics = new Set([
  "实时在线人数",
  "直播间平均停留时长(整场)",
  "GPM(元)",
  "观看成交转化率",
  "曝光观看率(次数)",
  "点赞率"
]);

const tabBar = document.getElementById("tabBar");
const webviewHost = document.getElementById("webviewHost");
const urlInput = document.getElementById("urlInput");
const outputPath = document.getElementById("outputPath");
const statusText = document.getElementById("statusText");
const nextText = document.getElementById("nextText");
const lastText = document.getElementById("lastText");
const intervalSelect = document.getElementById("intervalSelect");
const liveEndInput = document.getElementById("liveEndInput");
const hostRows = document.getElementById("hostRows");
const dataBody = document.getElementById("dataBody");
const rowCount = document.getElementById("rowCount");

let running = false;
let timer = null;
let previousRow = null;
let stopAt = null;
let activeTabId = "";
let tabSeq = 0;
const tabs = new Map();
const cumulativeRows = [];
const intervalRows = [];
const logs = [];

urlInput.value = defaultUrl;

function renderTabs() {
  tabBar.innerHTML = "";
  for (const [id, tab] of tabs) {
    const item = document.createElement("div");
    item.className = `tab${id === activeTabId ? " active" : ""}`;
    item.innerHTML = `<span>${tab.title}</span>${tabs.size > 1 ? "<button type=\"button\">×</button>" : ""}`;
    item.addEventListener("click", (event) => {
      if (event.target.tagName === "BUTTON") {
        closeTab(id);
        return;
      }
      activateTab(id);
    });
    tabBar.appendChild(item);
  }
}

function activateTab(id) {
  activeTabId = id;
  for (const [tabId, tab] of tabs) tab.view.style.display = tabId === id ? "flex" : "none";
  renderTabs();
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab || tabs.size <= 1) return;
  tab.view.remove();
  tabs.delete(id);
  if (activeTabId === id) activateTab(tabs.keys().next().value);
  else renderTabs();
}

function createTab(url, title = "千川") {
  const id = `tab-${++tabSeq}`;
  const view = document.createElement("webview");
  view.src = url;
  view.setAttribute("partition", "persist:qianchuan-live-board");
  view.setAttribute("allowpopups", "");
  view.addEventListener("new-window", (event) => {
    event.preventDefault();
    if (event.url) createTab(event.url, "新页面");
  });
  view.addEventListener("page-title-updated", (event) => {
    const tab = tabs.get(id);
    if (tab && event.title) {
      tab.title = event.title;
      renderTabs();
    }
  });
  view.addEventListener("did-start-loading", () => {
    statusText.textContent = "网页加载中";
  });
  view.addEventListener("did-finish-load", () => {
    if (!running) statusText.textContent = "网页已加载";
  });
  view.addEventListener("did-fail-load", (event) => {
    if (event.errorCode === -3) return;
    statusText.textContent = `网页加载失败：${event.errorDescription || event.errorCode}`;
  });
  webviewHost.appendChild(view);
  tabs.set(id, { title, view });
  activateTab(id);
}

window.qianchuanApp.onOpenTab((url) => createTab(url, "新页面"));
createTab(defaultUrl);

function addHostRow(start = "", end = "", name = "") {
  const row = document.createElement("div");
  row.className = "host-row";
  row.innerHTML = `
    <input class="host-start" type="time" value="${start}" aria-label="主播开始时间" />
    <input class="host-end" type="time" value="${end}" aria-label="主播结束时间" />
    <input class="host-name" placeholder="主播名" value="${name}" aria-label="主播名" />
    <button class="remove-host" type="button" title="删除">×</button>
  `;
  row.querySelector(".remove-host").addEventListener("click", () => row.remove());
  hostRows.appendChild(row);
}

addHostRow("08:00", "15:00", "");

function clean(value) {
  return String(value ?? "").trim().replace(/，/g, ",").replace(/％/g, "%").replace(/\s+/g, "");
}

function norm(value) {
  return clean(value).replace(/（/g, "(").replace(/）/g, ")").replace(/１/g, "1");
}

const labelMap = Object.fromEntries(metrics.map((metric) => [norm(metric), metric]));
const valueRe = /^(?:--|-|[0-9][0-9,]*(?:\.[0-9]+)?%?|[0-9]+分[0-9]+秒)$/;
const timeRe = /[0-9]+分[0-9]+秒/;

function isValue(value) {
  return valueRe.test(clean(value));
}

function valueAfter(lines, start) {
  const parts = [];
  for (const candidate of lines.slice(start, start + 8)) {
    if (labelMap[norm(candidate)]) break;
    const text = clean(candidate);
    if (!text) continue;
    parts.push(text);
    const joined = parts.join("");
    const time = joined.match(timeRe);
    if (time) return time[0];
    if (isValue(text)) return text;
  }
  return "";
}

function parseBoardText(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const row = {};
  lines.forEach((line, index) => {
    const metric = labelMap[norm(line)];
    if (!metric) return;
    const value = valueAfter(lines, index + 1);
    if (value) row[metric] = value;
  });
  return row;
}

function number(value) {
  const text = clean(value).replace(/,/g, "").replace(/%/g, "");
  if (!text || text === "-" || text === "--" || text.includes("分") || text.includes("秒")) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesFromTime(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isMinuteInRange(minute, start, end) {
  if (start == null || end == null) return false;
  if (start === end) return true;
  if (end > start) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

function dateAtTime(base, timeValue) {
  const minutes = minutesFromTime(timeValue);
  if (minutes == null) return null;
  const date = new Date(base);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function configuredEnd(reference = new Date()) {
  return dateAtTime(reference, liveEndInput.value);
}

function activeEnd(reference = new Date()) {
  return stopAt || configuredEnd(reference);
}

function readHostSchedule() {
  return Array.from(hostRows.querySelectorAll(".host-row"))
    .map((row) => ({
      start: minutesFromTime(row.querySelector(".host-start").value),
      end: minutesFromTime(row.querySelector(".host-end").value),
      name: row.querySelector(".host-name").value.trim()
    }))
    .filter((row) => row.name && row.start != null && row.end != null);
}

function hostFor(date) {
  const minute = minutesFromDate(date);
  const matched = readHostSchedule().find((row) => isMinuteInRange(minute, row.start, row.end));
  return matched ? matched.name : "";
}

function parseLocalDateTime(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function canUsePrevious(row, now = new Date()) {
  if (!row) return false;
  const capturedAt = parseLocalDateTime(row["采集时间"]);
  return capturedAt && capturedAt.toDateString() === now.toDateString() && capturedAt <= now;
}

function metricsUnchanged(previous, current) {
  if (!previous) return false;
  return metrics.every((metric) => clean(previous[metric]) === clean(current[metric]));
}

function divide(a, b, multiplier = 1) {
  if (a == null || b == null || b === 0) return "";
  return (a / b) * multiplier;
}

function percentText(a, b) {
  const value = divide(a, b, 100);
  return value === "" ? "" : `${value.toFixed(2)}%`;
}

function captureInterval() {
  return Number(intervalSelect.value) || 5;
}

function format(metric, value) {
  if (value === "" || value == null) return "";
  if (snapshotMetrics.has(metric)) return String(value);
  if (typeof value === "string") return value;
  if (metric.includes("率") || metric.includes("ROI") || metric.includes("GPM") || metric.includes("成本") || metric.includes("金额") || metric.includes("消耗")) return value.toFixed(2);
  return Math.abs(value - Math.round(value)) < 0.000001 ? String(Math.round(value)) : value.toFixed(2);
}

function buildInterval(previous, current, anchorName) {
  if (!previous) return null;
  const row = { "时段开始": previous["采集时间"], "时段结束": current["采集时间"], "主播": anchorName || "" };
  const deltas = {};
  for (const metric of deltaMetrics) {
    const prev = number(previous[metric]);
    const curr = number(current[metric]);
    deltas[metric] = prev == null || curr == null ? "" : curr - prev;
  }
  for (const metric of metrics) {
    if (deltaMetrics.has(metric)) row[metric] = format(metric, deltas[metric]);
    else if (snapshotMetrics.has(metric)) row[metric] = current[metric] || "";
    else row[metric] = "";
  }
  row["商品点击率"] = percentText(deltas["直播间商品点击次数"], deltas["直播间商品曝光次数"]);
  row["商品转化率"] = percentText(deltas["净成交订单数"], deltas["直播间商品点击次数"]);
  row["净成交订单成本(元)"] = format("净成交订单成本(元)", divide(deltas["整体消耗(元)"], deltas["净成交订单数"]));
  row["整体成交订单成本(元)"] = format("整体成交订单成本(元)", divide(deltas["整体消耗(元)"], deltas["整体成交订单数"]));
  row["净成交金额结算率"] = format("净成交金额结算率", divide(deltas["净成交金额(元)"], deltas["整体成交金额(元)"], 100));
  row["净成交订单结算率"] = format("净成交订单结算率", divide(deltas["净成交订单数"], deltas["整体成交订单数"], 100));
  row["1小时内退款率"] = format("1小时内退款率", divide(deltas["1小时内退款金额(元)"], deltas["整体成交金额(元)"], 100));
  row["直播间退款率"] = format("直播间退款率", divide(deltas["直播间退款金额(元)"], deltas["整体成交金额(元)"], 100));
  row["整体支付ROI"] = format("整体支付ROI", divide(deltas["整体成交金额(元)"], deltas["整体消耗(元)"]));
  row["净成交ROI"] = format("净成交ROI", divide(deltas["净成交金额(元)"], deltas["整体消耗(元)"]));
  row["分享率"] = format("分享率", divide(deltas["分享次数"], deltas["直播间整体观看人数"], 100));
  return row;
}

function nextAlignedDate() {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  const minutes = captureInterval();
  const remainder = next.getMinutes() % minutes;
  const add = remainder === 0 ? minutes : minutes - remainder;
  next.setMinutes(next.getMinutes() + add);
  return next;
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function collectCurrent(scheduledAt) {
  const board = await window.qianchuanApp.readBoardText();
  const values = parseBoardText(board.text);
  const current = { "采集时间": formatDate(scheduledAt), "主播": hostFor(scheduledAt) };
  for (const metric of metrics) current[metric] = values[metric] || "";
  current["商品点击率"] = percentText(number(current["直播间商品点击次数"]), number(current["直播间商品曝光次数"]));
  current["商品转化率"] = percentText(number(current["净成交订单数"]), number(current["直播间商品点击次数"]));
  const missing = metrics.filter((metric) => !current[metric]);
  return { current, missing, sourceUrl: board.url || "" };
}

async function capture(scheduledAt) {
  const end = activeEnd(scheduledAt);
  if (!end) {
    statusText.textContent = "请填写下播时间";
    return false;
  }

  const { current, missing, sourceUrl } = await collectCurrent(scheduledAt);
  if (scheduledAt >= end && metricsUnchanged(previousRow, current)) {
    running = false;
    if (timer) clearTimeout(timer);
    nextText.textContent = "-";
    statusText.textContent = `直播已结束，且最近 ${captureInterval()} 分钟数据没有变化，已自动停止`;
    lastText.textContent = "未写入重复行";
    return false;
  }

  const interval = buildInterval(previousRow, current, current["主播"]);
  const log = {
    captured_at: current["采集时间"],
    anchor: current["主播"],
    live_end: formatDate(end),
    status: missing.length ? "partial" : "full",
    missing_metrics: missing,
    source_url: sourceUrl
  };
  cumulativeRows.push(current);
  if (interval) intervalRows.push(interval);
  logs.push(log);
  previousRow = current;
  lastText.textContent = missing.length ? `缺失 ${missing.length} 项：${missing.join("、")}` : "36 项完整";
  statusText.textContent = "已登记到实时表";
  renderData();
  return true;
}

function renderData() {
  const rows = intervalRows.length ? intervalRows : cumulativeRows;
  rowCount.textContent = `${rows.length} 条`;
  if (!rows.length) {
    dataBody.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
    return;
  }
  dataBody.innerHTML = rows.slice(-100).reverse().map((row) => `
    <tr>
      <td>${row["时段开始"] ? `${row["时段开始"]} - ${row["时段结束"]}` : row["采集时间"]}</td>
      <td>${row["主播"] || ""}</td>
      <td>${row["净成交订单数"] || ""}</td>
      <td>${row["净成交金额(元)"] || ""}</td>
      <td>${row["整体消耗(元)"] || ""}</td>
      <td>${row["商品点击率"] || ""}</td>
      <td>${row["商品转化率"] || ""}</td>
    </tr>
  `).join("");
}

function scheduleNext() {
  if (!running) return;
  if (!activeEnd()) {
    statusText.textContent = "请填写下播时间";
    running = false;
    return;
  }
  const next = nextAlignedDate();
  nextText.textContent = formatDate(next);
  const delay = Math.max(0, next.getTime() - Date.now());
  timer = setTimeout(async () => {
    try {
      await capture(next);
    } catch (error) {
      statusText.textContent = `采集失败：${error.message}`;
    }
    scheduleNext();
  }, delay);
}

document.getElementById("openBtn").addEventListener("click", () => {
  createTab(urlInput.value || defaultUrl);
});

document.getElementById("startBtn").addEventListener("click", async () => {
  stopAt = configuredEnd(new Date());
  if (!stopAt) {
    statusText.textContent = "请填写下播时间";
    return;
  }
  previousRow = canUsePrevious(previousRow) ? previousRow : null;
  running = true;
  if (timer) clearTimeout(timer);
  const now = new Date();
  statusText.textContent = "正在写入当前数据";
  try {
    await capture(now);
  } catch (error) {
    statusText.textContent = `采集失败：${error.message}`;
  }
  scheduleNext();
});

document.getElementById("stopBtn").addEventListener("click", () => {
  running = false;
  stopAt = null;
  if (timer) clearTimeout(timer);
  statusText.textContent = "已停止";
  nextText.textContent = "-";
});

document.getElementById("addHostBtn").addEventListener("click", () => addHostRow());

document.getElementById("exportBtn").addEventListener("click", async () => {
  if (!cumulativeRows.length) {
    statusText.textContent = "暂无可导出数据";
    return;
  }
  const result = await window.qianchuanApp.exportData({ cumulativeRows, intervalRows, logs });
  if (!result) return;
  outputPath.textContent = result.cumulativeFile;
  statusText.textContent = "表格已导出";
});
