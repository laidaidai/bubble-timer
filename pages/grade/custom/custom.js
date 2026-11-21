const themeBind = require('../utils/theme-bind.js');
const theme = require('../utils/theme.js');
const { MODULE_DEFS, getPaper, paperModules } = require('../utils/data.js');
const custom = require('../utils/custom.js');
const store = require('../utils/store.js');

// 常用模块：前六个是行测主干，新建时默认给这六行
const CORE_KEYS = ['politics', 'common', 'verbal', 'quant', 'logic', 'data'];

// 套用现成卷的题量与分值，省得从 0 一个个填
const PRESETS = [
  { id: 'paper-gk-fs', label: '国考副省 135' },
  { id: 'paper-gk-ds', label: '国考地市 130' },
  { id: 'paper-hn', label: '河南省考 120' },
  { id: 'paper-sydw-a', label: '事业单位 A 100' },
];

// 分值展示：整数原样，小数最多两位、去掉尾零（12.50 → 12.5）
function fmt(v) {
  const n = Math.round(v * 100) / 100;
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(2)));
}

function rowsFromLayout(layout) {
  const map = {};
  (layout || []).forEach((seg) => {
    if (!MODULE_DEFS[seg.key] && !seg.name) return;
    if (!map[seg.key]) map[seg.key] = { count: 0, points: 0 };
    map[seg.key].count += seg.count || 0;
    map[seg.key].points += seg.points || 0;
    // 同名模块只保留一个显示名（编辑器一行一个模块）
    if (!map[seg.key].name && seg.name) map[seg.key].name = String(seg.name).trim();
  });
  return map;
}

// 编辑已有卷时只恢复它真正用过的模块；多个同 key 段只占一行
function keysFromLayout(layout) {
  const keys = [];
  (layout || []).forEach((seg) => {
    if ((!MODULE_DEFS[seg.key] && !seg.name) || keys.indexOf(seg.key) >= 0) return;
    keys.push(seg.key);
  });
  return keys;
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    name: '',
    modules: [],
    editingId: '',
    totalCount: 0,
    sumText: '0',
    diffText: '',
    valid: false,
    presets: PRESETS,
  },

  // 只做「新建 / 编辑」表单：带 id 进来是编辑，不带是新建；卷列表留在首页题库里
  onLoad(query) {
    themeBind.sync(this);
    const app = getApp();
    const id = (query && query.id) || '';
    const paper = id ? custom.get(id) : null;
    this.setData({
      isDesktop: app.globalData.isDesktop,
      name: paper ? paper.name : '',
      editingId: paper ? id : '',
      modules: this.buildModules(paper ? paper.layout : null),
    });
    this.recalc();
  },

  // 一行一个模块：有 layout 就只还原用过的模块，新建时才默认给六个主模块
  buildModules(layout) {
    const values = rowsFromLayout(layout);
    const keys = layout && layout.length ? keysFromLayout(layout) : CORE_KEYS.slice();
    const mods = keys.map((key) => this.moduleRow(key, values[key]));
    return this.withPer(mods);
  },

  moduleRow(key, v) {
    const def = MODULE_DEFS[key];
    const value = v || { count: 0, points: 0 };
    const nameText = String(value.name || '').trim();
    // 自建模块没有标准名：占位提示「模块名」，名字完全由用户起
    const stdName = def ? def.name : '';
    return {
      key: key,
      custom: !def,
      name: stdName,
      ph: stdName || '模块名',
      nameText: nameText,
      displayName: nameText || stdName || '新模块',
      count: value.count,
      countText: String(value.count),
      points: Math.round(value.points * 100) / 100,
      pointsText: fmt(value.points),
      perText: '',
    };
  },

  // 每题分值由「模块总分 / 题量」算，填题量或总分都能看到每题多少分
  withPer(mods) {
    return mods.map((m) => {
      const per = m.count > 0 && m.points > 0
        ? `每题 ${fmt(Math.round((m.points * 100) / m.count) / 100)} 分`
        : '';
      return Object.assign({}, m, { perText: per });
    });
  },

  idxOf(key) {
    const mods = this.data.modules || [];
    for (let i = 0; i < mods.length; i += 1) {
      if (mods[i].key === key) return i;
    }
    return -1;
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  // 模块改名：输入时只更新这一行，不整表重排（避免光标跳）；失焦再规整与校验
  onModName(e) {
    const key = e.currentTarget.dataset.key;
    const i = this.idxOf(key);
    if (i < 0) return;
    const raw = String(e.detail.value || '');
    const patch = {};
    patch['modules[' + i + '].nameText'] = raw;
    patch['modules[' + i + '].displayName'] = raw.trim() || this.data.modules[i].name;
    this.setData(patch);
  },

  normalizeName(e) {
    const key = e.currentTarget.dataset.key;
    const i = this.idxOf(key);
    if (i < 0) return;
    const mods = this.data.modules.slice();
    const m = Object.assign({}, mods[i]);
    m.nameText = String(m.nameText || '').trim();
    m.displayName = m.nameText || m.name;
    mods[i] = m;
    this.setData({ modules: mods });
    this.recalc();
  },

  // 加减一题：直接改数字并回填文本
  step(e) {
    const key = e.currentTarget.dataset.key;
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    const mods = this.data.modules.slice();
    const i = this.idxOf(key);
    if (i < 0) return;
    const next = Math.max(0, Math.min(100, mods[i].count + delta));
    mods[i] = Object.assign({}, mods[i], { count: next, countText: String(next) });
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 输入题量 / 模块总分：先按输入文本走，失焦时再规整
  edit(e) {
    const key = e.currentTarget.dataset.key;
    const field = e.currentTarget.dataset.field;
    const i = this.idxOf(key);
    if (i < 0) return;
    const raw = String(e.detail.value || '').replace(/[^0-9.]/g, '');
    const patch = {};
    patch['modules[' + i + '].' + field + 'Text'] = raw;
    patch['modules[' + i + '].' + field] = Number(raw || 0);
    this.setData(patch);
    this.recalc();
  },

  normalize(e) {
    const key = e.currentTarget.dataset.key;
    const field = e.currentTarget.dataset.field;
    const i = this.idxOf(key);
    if (i < 0) return;
    const mods = this.data.modules.slice();
    const m = Object.assign({}, mods[i]);
    if (field === 'count') {
      m.count = Math.max(0, Math.min(100, Math.round(m.count)));
      m.countText = String(m.count);
    } else {
      m.points = Math.max(0, Math.min(100, Math.round(m.points * 100) / 100));
      m.pointsText = fmt(m.points);
    }
    mods[i] = m;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 添加模块＝直接补一张空白卡（名字自己起），不再从预设列表里挑
  addModule() {
    const mods = this.data.modules;
    let max = 0;
    for (let i = 0; i < mods.length; i += 1) {
      const m = /^u(\d+)$/.exec(mods[i].key);
      if (m) max = Math.max(max, Number(m[1]));
    }
    const next = mods.concat([this.moduleRow('u' + (max + 1), null)]);
    this.setData({ modules: this.withPer(next) });
    this.recalc();
  },

  // 上移 / 下移：数组顺序就是卷面章节顺序，换序后保存会按新顺序重排题号
  moveModule(e) {
    const i = Number(e.currentTarget.dataset.index);
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    const mods = this.data.modules.slice();
    const j = i + delta;
    if (i < 0 || j < 0 || i >= mods.length || j >= mods.length) return;
    const tmp = mods[i];
    mods[i] = mods[j];
    mods[j] = tmp;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 移除模块：已经有题量 / 分值时必须先确认，避免误删一整块
  removeModule(e) {
    const key = e.currentTarget.dataset.key;
    const i = this.idxOf(key);
    if (i < 0) return;
    const m = this.data.modules[i];
    const drop = () => {
      const mods = this.data.modules.slice();
      mods.splice(i, 1);
      this.setData({ modules: this.withPer(mods) });
      this.recalc();
    };
    if (m.count > 0 || m.points > 0) {
      wx.showModal({
        title: '移除模块',
        content: `「${m.displayName || m.name}」的 ${m.count} 题 / ${fmt(m.points)} 分一起清掉，确认？`,
        confirmText: '移除',
        confirmColor: theme.getTheme().css.danger,
        success: (r) => { if (r.confirm) drop(); },
      });
    } else {
      drop();
    }
  },

  // 合计用「分」的整数算，避免 0.1 浮点把 100 判成 99.99
  recalc() {
    const mods = this.withPer(this.data.modules || []);
    let totalCount = 0;
    let sumCents = 0;
    let badText = '';
    for (let i = 0; i < mods.length; i += 1) {
      const m = mods[i];
      totalCount += m.count;
      sumCents += Math.round(m.points * 100);
      if (!badText && m.count === 0 && m.points > 0) badText = `「${m.displayName || m.name}」只有分值`;
      if (!badText && m.count > 0 && m.points === 0) badText = `「${m.displayName || m.name}」只有题量`;
    }
    const diffCents = 10000 - sumCents;
    let diffText = '';
    if (!badText && totalCount > 300) badText = '最多 300 题';
    if (badText) diffText = badText;
    else if (diffCents > 0) diffText = `还差 ${fmt(diffCents / 100)} 分`;
    else if (diffCents < 0) diffText = `超出 ${fmt(-diffCents / 100)} 分`;
    else if (totalCount === 0) diffText = '未填题量';
    const valid = totalCount > 0 && sumCents === 10000 && !badText;
    this.setData({
      modules: mods,
      totalCount: totalCount,
      sumText: fmt(sumCents / 100),
      diffText: diffText,
      valid: valid,
    });
  },

  // 一键把差额补进题量最多的模块（少了就加，多了从高分模块里扣）
  fillRest() {
    const mods = this.data.modules.slice();
    const sumCents = mods.reduce((a, m) => a + Math.round(m.points * 100), 0);
    const diffCents = 10000 - sumCents;
    if (diffCents === 0) return;
    let picked = -1;
    for (let i = 0; i < mods.length; i += 1) {
      if (mods[i].count > 0 && (picked < 0 || mods[i].count > mods[picked].count)) picked = i;
    }
    if (picked < 0) {
      wx.showToast({ title: '先填模块题量', icon: 'none' });
      return;
    }
    if (diffCents > 0) {
      mods[picked].points = Math.round((mods[picked].points * 100 + diffCents)) / 100;
    } else {
      let need = -diffCents;
      const order = mods.map((m, i) => ({ i: i, cents: Math.round(m.points * 100) }))
        .sort((a, b) => b.cents - a.cents);
      for (let k = 0; k < order.length && need > 0; k += 1) {
        const m = mods[order[k].i];
        if (order[k].cents <= 0) continue;
        const take = Math.min(order[k].cents, need);
        m.points = (order[k].cents - take) / 100;
        need -= take;
      }
      if (need > 0) {
        wx.showToast({ title: '现有分值不够扣，先调小题量', icon: 'none' });
        return;
      }
    }
    for (let i = 0; i < mods.length; i += 1) {
      mods[i].pointsText = fmt(mods[i].points);
    }
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 套用现成卷：直接抄它的模块题量与分值，用户再改
  applyPreset(e) {
    const id = e.currentTarget.dataset.id;
    const found = getPaper(id);
    if (!found) return;
    const mods = paperModules(found.paper).map((m) => ({
      key: m.key,
      count: m.count,
      points: Math.round(m.points * 100) / 100,
    }));
    const next = this.buildModules(mods);
    this.setData({
      modules: next,
      name: this.data.name || found.paper.name,
    });
    this.recalc();
  },

  // 默认卷名按已有「自定义卷 N」最大编号往后排，删掉中间一卷也不会重名
  nextDefaultName() {
    let max = 0;
    custom.list().forEach((p) => {
      const m = /^自定义卷\s+(\d+)$/.exec(p.name || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `自定义卷 ${max + 1}`;
  },

  save() {
    const name = String(this.data.name || '').trim() || this.nextDefaultName();
    if (!this.data.valid) {
      wx.showToast({ title: this.data.diffText || '分值没配到 100', icon: 'none' });
      return;
    }
    const layout = this.data.modules
      .filter((m) => m.count > 0)
      .map((m, i) => {
        const item = { key: m.key, count: m.count, points: Math.round(m.points * 100) / 100 };
        const modName = String(m.nameText || '').trim();
        // 自建模块必须带名字（数据层靠 name 识别）；留空就按顺序叫「模块 N」
        if (m.custom) item.name = modName || ('模块 ' + (i + 1));
        else if (modName && modName !== m.name) item.name = modName;
        return item;
      });
    const id = this.data.editingId || custom.nextId();
    const prev = this.data.editingId ? custom.get(id) : null;
    // 改名不影响题号，只有题量 / 分值 / 顺序变了才需要清草稿
    const shapeOf = (ls) => (ls || []).map((s) => s.key + ':' + s.count + ':' + s.points).join('|');
    const changed = !prev || shapeOf(prev.layout) !== shapeOf(layout);
    custom.save({ id: id, name: name, layout: layout });
    // 改了题量 / 分值，旧的作答草稿和旧标准答案就对不上题号了，一并清掉
    if (prev && changed) {
      store.clearDraft(id);
      store.clearStandardAnswers(id);
    }
    wx.showToast({ title: changed && prev ? '已更新，需重新作答' : '已保存', icon: 'none' });
    setTimeout(() => {
      this.goBack();
    }, 700);
  },

  // 编辑已有卷时允许整卷删除：草稿、答案、历史记录一起清（有二次确认）
  deleteCurrent() {
    const id = this.data.editingId;
    if (!id) return;
    const paper = custom.get(id);
    if (!paper) return;
    wx.showModal({
      title: '删除这卷',
      content: `「${paper.name}」的作答、答案、成绩记录都会一起删掉，确认？`,
      confirmText: '删除',
      confirmColor: theme.getTheme().css.danger,
      success: (r) => {
        if (!r.confirm) return;
        custom.remove(id);
        store.removePaperData(id);
        wx.showToast({ title: '已删除', icon: 'none' });
        setTimeout(() => {
          this.goBack();
        }, 500);
      },
    });
  },

  // 保存 / 删除后回首页题库；直接打开本页时退回首页兜底
  goBack() {
    // 回首页时把自定义分组展开，新卷 / 改过的卷直接露出来，不用再点一次分组
    const app = getApp();
    if (app && app.globalData) app.globalData.revealCustom = true;
    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/grade/index/index' });
      },
    });
  },

  onResize() {
    const app = getApp();
    if (app && app.detectEnvironment) app.detectEnvironment();
    this.setData({ isDesktop: app.globalData.isDesktop });
  },
});
