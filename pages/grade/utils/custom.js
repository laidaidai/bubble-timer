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

// 存储里的精简结构：{ id, name, layout: [{ key, count, points, name?, section? }] }
// seg.name 是用户给模块起的名字，不填就沿用标准模块名；
// seg.section 是模块内部小节的名称，不填则只按题号顺序显示「小节 N」。
function toPaper(entry) {
  const layout = [];
  let total = 0;
  (entry.layout || []).forEach((seg) => {
    if (!seg.count) return;
    const item = { key: seg.key, count: seg.count, points: seg.points };
    const modName = String(seg.name || '').trim();
    if (modName) item.name = modName;
    const sectionName = String(seg.section || '').trim();
    if (sectionName) item.section = sectionName;
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

// 复制卷名：保留原名的可识别部分，避开已存在的重名；
// 卷名输入上限 20 字，后缀“副本 / 副本 N”也要塞进这个长度。
function copyNameOf(name) {
  const raw = String(name || '').trim() || '自定义卷';
  // 复制副本时往回收一层，避免出现「卷A 副本 副本」这种套娃名。
  const source = raw.replace(/ 副本(?: \d+)?$/, '').trim() || raw;
  const names = {};
  readAll().forEach((item) => { names[String(item.name || '')] = true; });
  const maxLength = 20;
  let suffix = ' 副本';
  let candidate = source.slice(0, Math.max(1, maxLength - suffix.length)) + suffix;
  let n = 2;
  while (names[candidate]) {
    suffix = ' 副本 ' + n;
    candidate = source.slice(0, Math.max(1, maxLength - suffix.length)) + suffix;
    n += 1;
  }
  return candidate;
}

// 复制一份独立的自定义卷：只复制卷面结构，不带草稿、答案和成绩。
function duplicate(id) {
  const paper = get(id);
  if (!paper) return null;
  const layout = (paper.layout || []).map((seg) => Object.assign({}, seg));
  return save({
    id: nextId(),
    name: copyNameOf(paper.name),
    layout: layout,
  });
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

let idSeq = 0;
function nextId() {
  // 连续复制 / 新建可能落在同一毫秒，补一个进程内序号，避免 id 撞车后覆盖上一卷。
  idSeq = (idSeq + 1) % 100000;
  return 'paper-u' + Date.now() + '-' + idSeq;
}

function bankId() {
  return BANK_ID;
}

module.exports = {
  list,
  get,
  save,
  duplicate,
  remove,
  sync,
  nextId,
  bankId,
};
