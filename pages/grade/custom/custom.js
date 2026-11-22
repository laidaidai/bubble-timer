const themeBind = require('../utils/theme-bind.js');
const theme = require('../utils/theme.js');
const { MODULE_DEFS, getPaper, paperModules, savePaperOverride, clearPaperOverride } = require('../utils/data.js');
const custom = require('../utils/custom.js');
const store = require('../utils/store.js');

// 常用模块：前六个是行测主干，新建时默认给这六行
const CORE_KEYS = ['politics', 'common', 'verbal', 'quant', 'logic', 'data'];

// 套用现成卷的题量与分值，省得从 0 一个个填
const PRESETS = [
  { id: 'paper-gk-fs', label: '国考副省 135' },
  { id: 'paper-hn', label: '河南省考 120' },
  { id: 'paper-sydw-gj', label: '事业单位公基 100' },
  { id: 'paper-xd', label: '选调生 100' },
];

// 分值展示：整数原样，小数最多两位、去掉尾零（12.50 → 12.5）
function fmt(v) {
  const n = Math.round(v * 100) / 100;
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(2)));
}

function segPointsOf(seg) {
  if (typeof seg.points === 'number') return Math.round(seg.points * 100) / 100;
  if (typeof seg.per === 'number') return Math.round(seg.per * seg.count * 100) / 100;
  return 0;
}

function splitInt(total, parts) {
  const n = Math.max(1, parts);
  const base = Math.floor(total / n);
  const extra = total - base * n;
  const list = [];
  for (let i = 0; i < n; i += 1) list.push(base + (i < extra ? 1 : 0));
  return list;
}

// 同一模块的多个 layout 段收进一个 row：默认只显示整章汇总，点「细分」时再展开每个小节。
function rowsFromLayout(layout) {
  const rows = [];
  (layout || []).forEach((seg) => {
    if (!MODULE_DEFS[seg.key] && !seg.name) return;
    const count = Number(seg.count) || 0;
    if (!count) return;
    const points = segPointsOf(seg);
    let row = null;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].key === seg.key) { row = rows[i]; break; }
    }
    if (!row) {
      row = { key: seg.key, name: '', count: 0, points: 0, parts: [] };
      rows.push(row);
    }
    const segName = String(seg.name || '').trim();
    if (!row.name && segName) row.name = segName;
    row.count += count;
    row.points = Math.round((row.points + points) * 100) / 100;
    row.parts.push({
      label: String(seg.section || '').trim(),
      count: count,
      points: points,
    });
  });
  return rows;
}

// 卷面结构比较按模块汇总，不能按小节段比较：只细分分值不该触发清空作答。
function layoutSummary(layout) {
  const map = {};
  const order = [];
  (layout || []).forEach((seg) => {
    const key = seg.key;
    if (!map[key]) {
      map[key] = { count: 0, points: 0 };
      order.push(key);
    }
    map[key].count += Number(seg.count) || 0;
    map[key].points += Number(seg.points) || 0;
  });
  return order.map((key) => ({
    key: key,
    count: map[key].count,
    points: Math.round(map[key].points * 100) / 100,
  }));
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    name: '',
    modules: [],
    editingId: '',
    isPreset: false,
    canDelete: false,
    totalCount: 0,
    sumText: '0',
    diffText: '',
    valid: false,
    presets: PRESETS,
    dragging: false,
    dragIndex: -1,
    dragStyle: '',
    dragStyles: [],
  },

  // 只做「新建 / 编辑」表单：带 id 进来是编辑自定义卷，带 paperId 是改预设卷，
  // 都不带是新建；卷列表留在首页题库里
  onLoad(query) {
    themeBind.sync(this);
    this._presetName = '';
    const app = getApp();
    const presetId = (query && query.paperId) || '';
    if (presetId) {
      const found = getPaper(presetId);
      if (found) {
        // 预设卷按模块+小节回填，原卷里判断推理这类多段分值不会在编辑时被抹平
        this.setData({
          isDesktop: app.globalData.isDesktop,
          isPreset: true,
          canDelete: false,
          name: found.paper.name,
          editingId: presetId,
          modules: this.buildModules(paperModules(found.paper)),
        });
        this.recalc();
        return;
      }
    }
    const id = (query && query.id) || '';
    const paper = id ? custom.get(id) : null;
    this.setData({
      isDesktop: app.globalData.isDesktop,
      isPreset: false,
      canDelete: !!paper,
      name: paper ? paper.name : '',
      editingId: paper ? id : '',
      modules: this.buildModules(paper ? paper.layout : null),
    });
    this.recalc();
  },

  // 一行一个模块：有 layout 就只还原用过的模块，新建时才默认给六个主模块。
  // input 可以是 raw layout 段，也可以是 paperModules() 返回的带 parts 的模块。
  buildModules(input) {
    let rows = [];
    if (input && input.length) {
      if (input[0] && Array.isArray(input[0].parts)) {
        rows = input.map((m) => ({
          key: m.key,
          name: m.name,
          count: m.count,
          points: m.points,
          parts: m.parts,
        }));
      } else {
        rows = rowsFromLayout(input);
      }
    } else {
      rows = CORE_KEYS.map((key) => ({ key: key, count: 0, points: 0, parts: [] }));
    }
    return this.withPer(rows.map((row) => this.moduleRow(row.key, row)));
  },

  moduleRow(key, v) {
    const def = MODULE_DEFS[key];
    const value = v || { count: 0, points: 0 };
    const rawName = String(value.name || '').trim();
    // 标准模块如果还是原名就不放进输入框，避免看起来像用户改过名
    const nameText = def ? (rawName && rawName !== def.name ? rawName : '') : rawName;
    const stdName = def ? def.name : '';
    const parts = (value.parts || []).length > 1
      ? value.parts.map((p) => this.partRow(p))
      : [];
    const count = parts.length
      ? parts.reduce((sum, p) => sum + p.count, 0)
      : (Number(value.count) || 0);
    const points = parts.length
      ? Math.round(parts.reduce((sum, p) => sum + p.points, 0) * 100) / 100
      : (Number(value.points) || 0);
    return {
      key: key,
      custom: !def,
      name: stdName,
      ph: stdName || '模块名',
      nameText: nameText,
      displayName: nameText || stdName || '新模块',
      count: count,
      countText: String(count),
      points: points,
      pointsText: fmt(points),
      perText: '',
      parts: parts,
      hasParts: parts.length > 0,
      subOpen: false,
    };
  },

  partRow(p) {
    const count = Math.max(0, Math.round(Number(p.count) || 0));
    const points = Math.round((Number(p.points) || 0) * 100) / 100;
    this._partSeq = (this._partSeq || 0) + 1;
    return {
      uid: p.uid || ('p' + Date.now() + '_' + this._partSeq),
      label: String(p.label || '').trim(),
      labelText: String(p.label || ''),
      count: count,
      countText: String(count),
      points: points,
      pointsText: fmt(points),
      perText: '',
      rangeText: '',
    };
  },

  cloneModules() {
    return (this.data.modules || []).map((m) => Object.assign({}, m, {
      parts: (m.parts || []).map((p) => Object.assign({}, p)),
    }));
  },

  // 每题分值由「小节 / 整章总分 ÷ 题量」算；细分后模块汇总值只读，避免两套数字打架
  withPer(mods) {
    return (mods || []).map((m) => {
      let cursor = 1;
      const parts = (m.parts || []).map((p, pi) => {
        const count = Math.max(0, Math.round(Number(p.count) || 0));
        const points = Math.round((Number(p.points) || 0) * 100) / 100;
        const rangeText = count > 0 ? `第 ${cursor}-${cursor + count - 1} 题` : '未排题号';
        if (count > 0) cursor += count;
        return Object.assign({}, p, {
          count: count,
          countText: p.countText === undefined ? String(count) : p.countText,
          points: points,
          pointsText: p.pointsText === undefined ? fmt(points) : p.pointsText,
          perText: count > 0 && points > 0
            ? `每题 ${fmt(Math.round((points * 100) / count) / 100)} 分`
            : '',
          rangeText: rangeText,
          displayLabel: String(p.labelText || '').trim() || `小节 ${pi + 1}`,
        });
      });

      let count = m.count;
      let points = m.points;
      let countText = m.countText;
      let pointsText = m.pointsText;
      if (parts.length) {
        count = parts.reduce((sum, p) => sum + p.count, 0);
        points = Math.round(parts.reduce((sum, p) => sum + p.points, 0) * 100) / 100;
        countText = String(count);
        pointsText = fmt(points);
      }
      const per = count > 0 && points > 0
        ? `每题 ${fmt(Math.round((points * 100) / count) / 100)} 分`
        : '';
      return Object.assign({}, m, {
        parts: parts,
        hasParts: parts.length > 0,
        subOpen: !!m.subOpen,
        subToggleText: parts.length
          ? (m.subOpen ? '收起' : `${parts.length} 节`)
          : '＋节',
        count: count,
        countText: countText,
        points: points,
        pointsText: pointsText,
        perText: per,
      });
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
    this._presetName = '';
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

  // 加减一题 / 分值：直接改数字并回填文本
  step(e) {
    const key = e.currentTarget.dataset.key;
    const field = e.currentTarget.dataset.field === 'points' ? 'points' : 'count';
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    const mods = this.data.modules.slice();
    const i = this.idxOf(key);
    if (i < 0) return;
    const m = Object.assign({}, mods[i]);
    if (field === 'points') {
      m.points = Math.max(0, Math.min(100, Math.round(((Number(m.points) || 0) + delta) * 100) / 100));
      m.pointsText = fmt(m.points);
    } else {
      m.count = Math.max(0, Math.min(100, Math.round((Number(m.count) || 0) + delta)));
      m.countText = String(m.count);
    }
    mods[i] = m;
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

  // 把一个整章按题量 / 分值均分拆成多个小节；差额按「分」补到前几节，保证合计不变
  splitParts(count, points, number) {
    const counts = splitInt(Math.max(0, Math.round(count)), number);
    const cents = splitInt(Math.round((Number(points) || 0) * 100), number);
    return counts.map((c, i) => ({
      label: '',
      labelText: '',
      count: c,
      points: cents[i] / 100,
    }));
  },

  // 「细分」= 首次均分成两个小节；已有小节时只展开 / 收起，不重复拆
  toggleSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const m = mods[i];
    if (m.parts.length) {
      m.subOpen = !m.subOpen;
      this.setData({ modules: this.withPer(mods) });
      return;
    }
    if (m.count < 2) {
      wx.showToast({ title: '至少 2 题才能细分', icon: 'none' });
      return;
    }
    m.parts = this.splitParts(m.count, m.points, 2).map((p) => this.partRow(p));
    m.subOpen = true;
    mods[i] = m;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 新增小节时把当前最大的小节对半拆开，题量和总分都不会凭空变多
  addSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const m = mods[i];
    if (!m.parts.length) return;
    let picked = -1;
    for (let p = 0; p < m.parts.length; p += 1) {
      if (m.parts[p].count < 2) continue;
      if (picked < 0 || m.parts[p].count > m.parts[picked].count) picked = p;
    }
    if (picked < 0) {
      wx.showToast({ title: '没有可再拆的题量', icon: 'none' });
      return;
    }
    const old = m.parts[picked];
    const next = this.splitParts(old.count, old.points, 2).map((p) => this.partRow(p));
    next[0].label = old.label;
    next[0].labelText = old.labelText;
    m.parts.splice(picked, 1, next[0], next[1]);
    m.subOpen = true;
    mods[i] = m;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 删到只剩一个小节时自动并回整章，不再显示一个没意义的「细分 1 节」
  removeSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    const pi = Number(e.currentTarget.dataset.pi);
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const m = mods[i];
    if (pi < 0 || pi >= m.parts.length) return;
    m.parts.splice(pi, 1);
    if (m.parts.length === 1) {
      const left = m.parts[0];
      m.parts = [];
      m.subOpen = false;
      m.count = left.count;
      m.points = left.points;
      m.countText = String(left.count);
      m.pointsText = fmt(left.points);
    }
    mods[i] = m;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 取消细分：用当前小节汇总值还原成整章，题量和总分保持不变
  mergeSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const m = mods[i];
    m.parts = [];
    m.subOpen = false;
    m.countText = String(m.count);
    m.pointsText = fmt(m.points);
    mods[i] = m;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  stepSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    const pi = Number(e.currentTarget.dataset.pi);
    const field = e.currentTarget.dataset.field === 'points' ? 'points' : 'count';
    const delta = Number(e.currentTarget.dataset.delta) || 0;
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const part = mods[i].parts[pi];
    if (!part) return;
    if (field === 'points') {
      part.points = Math.max(0, Math.min(100, Math.round(((Number(part.points) || 0) + delta) * 100) / 100));
      part.pointsText = fmt(part.points);
    } else {
      part.count = Math.max(0, Math.min(300, Math.round((Number(part.count) || 0) + delta)));
      part.countText = String(part.count);
    }
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  editSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    const pi = Number(e.currentTarget.dataset.pi);
    const field = e.currentTarget.dataset.field;
    if (i < 0 || i >= this.data.modules.length) return;
    const mod = this.data.modules[i];
    if (!mod || !mod.parts[pi] || (field !== 'count' && field !== 'points')) return;
    const raw = String(e.detail.value || '').replace(/[^0-9.]/g, '');
    const patch = {};
    patch['modules[' + i + '].parts[' + pi + '].' + field + 'Text'] = raw;
    patch['modules[' + i + '].parts[' + pi + '].' + field] = Number(raw || 0);
    this.setData(patch);
    this.recalc();
  },

  normalizeSub(e) {
    const i = Number(e.currentTarget.dataset.index);
    const pi = Number(e.currentTarget.dataset.pi);
    const field = e.currentTarget.dataset.field;
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const part = mods[i] && mods[i].parts[pi];
    if (!part) return;
    if (field === 'count') {
      part.count = Math.max(0, Math.min(300, Math.round(Number(part.count) || 0)));
      part.countText = String(part.count);
    } else if (field === 'points') {
      part.points = Math.max(0, Math.min(100, Math.round((Number(part.points) || 0) * 100) / 100));
      part.pointsText = fmt(part.points);
    } else {
      return;
    }
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  onSubName(e) {
    const i = Number(e.currentTarget.dataset.index);
    const pi = Number(e.currentTarget.dataset.pi);
    if (i < 0 || i >= this.data.modules.length) return;
    const patch = {};
    patch['modules[' + i + '].parts[' + pi + '].labelText'] = String(e.detail.value || '');
    this.setData(patch);
  },

  normalizeSubName(e) {
    const i = Number(e.currentTarget.dataset.index);
    const pi = Number(e.currentTarget.dataset.pi);
    if (i < 0 || i >= this.data.modules.length) return;
    const mods = this.cloneModules();
    const part = mods[i] && mods[i].parts[pi];
    if (!part) return;
    part.labelText = String(part.labelText || '').trim();
    part.label = part.labelText;
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 添加模块＝直接补一张空白卡（名字自己起），不再从预设列表里挑
  // ===== 模块长按拖动排序：和首页训练模块同一套手感，不额外占一列箭头 =====
  touchStart(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const index = Number(e.currentTarget.dataset.index);
    this._drag = {
      index: index,
      startY: t.clientY,
      activated: false,
      target: index,
    };
    this._dragDelta = null;
    this.measureDragCards();
  },

  measureDragCards(callback) {
    wx.createSelectorQuery().in(this)
      .selectAll('.mod-card')
      .boundingClientRect((rects) => {
        const list = rects || [];
        if (!list.length) {
          this._dragRects = [];
          if (callback) callback();
          return;
        }
        const gap = list.length > 1
          ? Math.max(0, list[1].top - list[0].top - list[0].height)
          : 12;
        this._dragRects = list;
        this._dragGap = gap;
        if (callback) callback();
      })
      .exec();
  },

  activateDrag(e) {
    if (!this._drag) return;
    const index = Number(e.currentTarget.dataset.index);
    this._drag.index = index;
    this._drag.target = index;
    const start = () => {
      const rects = this._dragRects || [];
      if (!rects[index]) {
        this.measureDragCards(start);
        return;
      }
      this._drag.activated = true;
      this._drag.startY = this._drag.startY || 0;
      this._dragStartTop = rects[index].top;
      this.setData({
        dragging: true,
        dragIndex: index,
        dragStyle: 'transition: none; transform: translate3d(0, 0, 0) scale(1.02);',
        dragStyles: rects.map(() => 'transition: transform 180ms cubic-bezier(.25,.8,.3,1);'),
      });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} });
    };
    start();
  },

  touchMove(e) {
    const d = this._drag;
    if (!d || !d.activated) return;
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!t) return;
    const rects = this._dragRects || [];
    const from = d.index;
    if (!rects[from]) return;
    const delta = t.clientY - d.startY;
    const center = rects[from].top + rects[from].height / 2 + delta;
    let target = from;
    if (delta >= 0) {
      for (let i = from + 1; i < rects.length; i += 1) {
        if (center >= rects[i].top + rects[i].height / 2) target = i;
        else break;
      }
    } else {
      for (let i = from - 1; i >= 0; i -= 1) {
        if (center <= rects[i].top + rects[i].height / 2) target = i;
        else break;
      }
    }
    if (target === d.target && this._dragDelta === delta) return;
    d.target = target;
    this._dragDelta = delta;
    const span = rects[from].height + (this._dragGap || 12);
    const styles = rects.map((rect, i) => {
      let y = 0;
      if (target > from && i > from && i <= target) y = -span;
      if (target < from && i >= target && i < from) y = span;
      return `transition: transform 180ms cubic-bezier(.25,.8,.3,1); transform: translate3d(0, ${y}px, 0);`;
    });
    this.setData({
      dragStyle: `transition: none; transform: translate3d(0, ${delta}px, 0) scale(1.02);`,
      dragStyles: styles,
    });
  },

  touchEnd(e) {
    const d = this._drag;
    if (!d) return;
    if (!d.activated) {
      this._drag = null;
      return;
    }
    const from = d.index;
    const target = d.target;
    if (target === from) {
      this.resetDragStyles();
      this._drag = null;
      return;
    }
    const mods = this.data.modules.slice();
    const moved = mods.splice(from, 1)[0];
    mods.splice(target, 0, moved);
    const styles = mods.map(() => 'transition: transform 180ms cubic-bezier(.25,.8,.3,1); transform: translate3d(0, 0, 0);');
    this.setData({
      modules: this.withPer(mods),
      dragging: false,
      dragIndex: -1,
      dragStyle: '',
      dragStyles: styles,
    }, () => this.recalc());
    setTimeout(() => this.setData({ dragStyles: mods.map(() => '') }), 220);
    this._drag = null;
  },

  resetDragStyles() {
    this.setData({ dragging: false, dragIndex: -1, dragStyle: '', dragStyles: [] });
  },

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
      for (let p = 0; p < (m.parts || []).length; p += 1) {
        const part = m.parts[p];
        if (!badText && part.count === 0 && part.points > 0) {
          badText = `「${m.displayName || m.name}」的${part.displayLabel}只有分值`;
        }
        if (!badText && part.count > 0 && part.points === 0) {
          badText = `「${m.displayName || m.name}」的${part.displayLabel}只有题量`;
        }
      }
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

  // 一键把差额补进题量最多的模块；细分过的模块补在最大的小节上，保证汇总同步
  fillRest() {
    const mods = this.cloneModules();
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
      const m = mods[picked];
      if (m.parts.length) {
        let pi = 0;
        for (let i = 1; i < m.parts.length; i += 1) {
          if (m.parts[i].count > m.parts[pi].count) pi = i;
        }
        m.parts[pi].points = (Math.round(m.parts[pi].points * 100) + diffCents) / 100;
        m.parts[pi].pointsText = fmt(m.parts[pi].points);
      } else {
        m.points = (Math.round(m.points * 100) + diffCents) / 100;
        m.pointsText = fmt(m.points);
      }
    } else {
      let need = -diffCents;
      const targets = [];
      for (let i = 0; i < mods.length; i += 1) {
        const m = mods[i];
        if (m.parts.length) {
          for (let p = 0; p < m.parts.length; p += 1) {
            targets.push({ m: m, p: m.parts[p], cents: Math.round(m.parts[p].points * 100) });
          }
        } else {
          targets.push({ m: m, p: null, cents: Math.round(m.points * 100) });
        }
      }
      targets.sort((a, b) => b.cents - a.cents);
      for (let k = 0; k < targets.length && need > 0; k += 1) {
        const t = targets[k];
        if (t.cents <= 0) continue;
        const take = Math.min(t.cents, need);
        if (t.p) {
          t.p.points = (t.cents - take) / 100;
          t.p.pointsText = fmt(t.p.points);
        } else {
          t.m.points = (t.cents - take) / 100;
          t.m.pointsText = fmt(t.m.points);
        }
        need -= take;
      }
      if (need > 0) {
        wx.showToast({ title: '现有分值不够扣，先调小题量', icon: 'none' });
        return;
      }
    }
    this.setData({ modules: this.withPer(mods) });
    this.recalc();
  },

  // 套用现成卷：直接抄它的模块题量、小节和分值，用户再改
  applyPreset(e) {
    const id = e.currentTarget.dataset.id;
    const found = getPaper(id);
    if (!found) return;
    const next = this.buildModules(paperModules(found.paper));
    // 空卷名或仍沿用上一个预设名时跟着换；用户自己改过卷名则保留
    const currentName = String(this.data.name || '').trim();
    const followName = !currentName || currentName === this._presetName;
    if (followName) this._presetName = found.paper.name;
    this.setData({
      modules: next,
      name: followName ? found.paper.name : currentName,
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
    const name = String(this.data.name || '').trim() || (this.data.isPreset ? '' : this.nextDefaultName());
    if (!this.data.valid) {
      wx.showToast({ title: this.data.diffText || '分值没配到 100', icon: 'none' });
      return;
    }
    // 细分后按小节写成多段 layout；没细分时仍是一整段，默认编辑体验不变
    const layout = [];
    this.data.modules.forEach((m, mi) => {
      if (!m.count) return;
      const segments = m.parts.length
        ? m.parts.filter((p) => p.count > 0).map((p) => ({
          count: p.count,
          points: p.points,
          labelText: p.labelText,
        }))
        : [{ count: m.count, points: m.points, labelText: '' }];
      segments.forEach((part) => {
        const item = {
          key: m.key,
          count: part.count,
          points: Math.round((Number(part.points) || 0) * 100) / 100,
        };
        const modName = String(m.nameText || '').trim();
        // 自建模块必须带名字（数据层靠 name 识别）；留空就按顺序叫「模块 N」
        if (m.custom) item.name = modName || ('模块 ' + (mi + 1));
        else if (modName && modName !== m.name) item.name = modName;
        const sectionName = String(part.labelText || '').trim();
        if (sectionName) item.section = sectionName;
        layout.push(item);
      });
    });
    const id = this.data.editingId || custom.nextId();
    const prev = this.data.isPreset
      ? ((getPaper(id) || {}).paper || null)
      : (this.data.editingId ? custom.get(id) : null);
    // 自定义卷：改名 / 分值不影响题号，题量或顺序变了才清草稿和旧答案。
    // 预设卷：无论改题量还是分值都不清，旧数据保留即可。
    // 结构比较按模块汇总，细分小节不改变题号总数时不会误判成「改了卷面」。
    const structureOfPaper = (paper) => (paper ? paperModules(paper) : [])
      .map((m) => m.key + ':' + m.count).join('|');
    const structureOfLayout = (ls) => layoutSummary(ls)
      .map((m) => m.key + ':' + m.count).join('|');
    const scoreOfPaper = (paper) => (paper ? paperModules(paper) : [])
      .map((m) => m.key + ':' + (Math.round(m.points * 100) / 100)).join('|');
    const scoreOfLayout = (ls) => layoutSummary(ls)
      .map((m) => m.key + ':' + m.points).join('|');
    // 小节细分即使模块总分不变也要保存；单独比较每段题量 / 分值 / 小节名
    const detailOfPaper = (paper) => ((paper && paper.layout) || [])
      .map((s) => [s.key, s.count, segPointsOf(s), String(s.section || '').trim()].join(':')).join('|');
    const detailOfLayout = (ls) => (ls || [])
      .map((s) => [s.key, s.count, Math.round((Number(s.points) || 0) * 100) / 100, String(s.section || '').trim()].join(':')).join('|');
    const structureChanged = !prev || structureOfPaper(prev) !== structureOfLayout(layout);
    const scoreChanged = !prev || scoreOfPaper(prev) !== scoreOfLayout(layout);
    const detailChanged = !prev || detailOfPaper(prev) !== detailOfLayout(layout);
    const changed = structureChanged || scoreChanged || detailChanged;
    const nameChanged = !!prev && String(name || prev.name) !== String(prev.name);

    // 预设卷什么都没改就不写覆盖，避免只是点进来看看也被标成「已自定义」
    if (this.data.isPreset && prev && !changed && !nameChanged) {
      wx.showToast({ title: '未修改', icon: 'none' });
      setTimeout(() => {
        this.goBack();
      }, 500);
      return;
    }

    if (this.data.isPreset) {
      savePaperOverride(id, { name: name || prev.name, layout: layout });
      // 预设卷只改题量 / 分值，旧草稿和已导入答案一律保留；旧数据不会参与新卷面的当前成绩
      wx.showToast({
        title: prev ? '已更新' : '已保存',
        icon: 'none',
      });
      setTimeout(() => {
        this.goBack();
      }, 700);
      return;
    }

    custom.save({ id: id, name: name, layout: layout });
    // 改了题量 / 顺序，旧草稿和旧标准答案就对不上题号了，一并清掉；只改分值则保留
    if (prev && structureChanged) {
      store.clearDraft(id);
      store.clearStandardAnswers(id);
    }
    wx.showToast({
      title: structureChanged && prev ? '已更新，需重新作答' : (scoreChanged && prev ? '已更新分值' : '已保存'),
      icon: 'none',
    });
    setTimeout(() => {
      this.goBack();
    }, 700);
  },

  // 编辑已有卷时允许整卷删除：草稿、答案、历史记录一起清（有二次确认）
  deleteCurrent() {
    if (!this.data.canDelete || this.data.isPreset) return;
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

  // 预设卷改坏了可以一键回到内置题量 / 分值；会清掉按旧卷面答的进度
  resetPreset() {
    if (!this.data.isPreset) return;
    const id = this.data.editingId;
    const paper = (getPaper(id) || {}).paper;
    if (!id || !paper) return;
    wx.showModal({
      title: '恢复默认',
      content: `「${paper.name}」会回到内置题量和分值，已答进度一起清空，确认？`,
      confirmText: '恢复',
      confirmColor: theme.getTheme().css.danger,
      success: (r) => {
        if (!r.confirm) return;
        clearPaperOverride(id);
        // 恢复默认也只改卷面，已答进度和已导入答案继续保留
        wx.showToast({ title: '已恢复默认', icon: 'none' });
        setTimeout(() => {
          this.goBack();
        }, 500);
      },
    });
  },

  // 保存 / 删除后回首页题库；直接打开本页时退回首页兜底
  goBack() {
    // 只有新建 / 编辑自定义卷才跳到自定义分组；改预设卷要留在原来的题库
    const app = getApp();
    if (app && app.globalData && !this.data.isPreset) app.globalData.revealCustom = true;
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
