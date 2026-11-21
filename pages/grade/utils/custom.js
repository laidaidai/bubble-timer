// 自定义试卷：用户自定模块题量与分值，存本地并挂进 BANKS，后续答题 / 批改 / 历史全走同一套流程
const { BANKS } = require('./data.js');

const KEY = 'xc_custom_papers';
const BANK_ID = 'bank-custom';
const GROUP_ID = 'group-custom';

function readAll() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  try {
    wx.setStorageSync(KEY, list);
  } catch (e) {}
}

// 存储里的精简结构：{ id, name, layout: [{ key, count, points, name? }] }
// seg.name 是用户给模块起的名字，不填就沿用标准模块名
function toPaper(entry) {
  const layout = [];
  let total = 0;
  (entry.layout || []).forEach((seg) => {
    if (!seg.count) return;
    const item = { key: seg.key, count: seg.count, points: seg.points };
    const modName = String(seg.name || '').trim();
    if (modName) item.name = modName;
    layout.push(item);
    total += seg.count;
  });
  return {
    id: entry.id,
    name: entry.name,
    total: total,
    layout: layout,
    lastScore: null,
    custom: true,
  };
}

function buildBank() {
  const papers = readAll().map(toPaper).filter((p) => p.total > 0);
  return {
    id: BANK_ID,
    name: '自定义试卷',
    tag: '自定义',
    custom: true,
    groups: papers.length
      ? [{ id: GROUP_ID, name: '我的自定义卷', papers: papers }]
      : [],
  };
}

// 把自定义卷挂到 BANKS 里（永远保留这个题库，空卷时进去就是「新建」入口）
function sync() {
  let idx = -1;
  for (let i = 0; i < BANKS.length; i += 1) {
    if (BANKS[i].id === BANK_ID) { idx = i; break; }
  }
  if (idx >= 0) BANKS[idx] = buildBank();
  else BANKS.push(buildBank());
  return BANKS[idx >= 0 ? idx : BANKS.length - 1];
}

function list() {
  return readAll().map(toPaper).filter((p) => p.total > 0);
}

function get(id) {
  const all = readAll();
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].id === id) return toPaper(all[i]);
  }
  return null;
}

function save(entry) {
  const all = readAll();
  let idx = -1;
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].id === entry.id) { idx = i; break; }
  }
  const item = { id: entry.id, name: entry.name, layout: entry.layout };
  if (idx >= 0) all[idx] = item;
  else all.unshift(item);
  writeAll(all);
  sync();
  return item;
}

function remove(id) {
  writeAll(readAll().filter((p) => p.id !== id));
  sync();
}

function nextId() {
  return 'paper-u' + Date.now();
}

function bankId() {
  return BANK_ID;
}

module.exports = {
  list,
  get,
  save,
  remove,
  sync,
  nextId,
  bankId,
};
