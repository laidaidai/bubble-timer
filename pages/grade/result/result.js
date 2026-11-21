const themeBind = require('../utils/theme-bind.js');
const store = require('../utils/store.js');
const theme = require('../utils/theme.js');
const data = require('../utils/data.js');
const { MODULE_DEFS } = data;

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 分值展示：整数不带小数，0.5 / 10.5 这类保留一位
function fmtPoint(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

// 与目标分的差值：带正负号，负号用全角减号，视觉上比半角 - 更像负值
function signedNum(v) {
  const abs = Math.abs(v);
  return (v >= 0 ? '+' : '\u2212') + fmtPoint(abs);
}
function signedPoint(v) {
  return signedNum(v) + ' 分';
}

// 逐题对错：四格 A/B/C/D，只标「正解」与「你选」；跨用户的选项人数/占比需要服务端统计，本地不做
const LETTERS = ['A', 'B', 'C', 'D'];
function buildCells(q) {
  return LETTERS.map((label) => {
    const isAns = q.correct === label;
    const isPick = q.user === label && q.status === 'wrong';
    return {
      label,
      mark: isAns ? 'ans' : (isPick ? 'pick' : ''),
      sub: isAns ? '正解' : (isPick ? '你选' : ''),
    };
  });
}

// 老记录可能没有模块级 points / got；逐题明细里通常还留着每题 point，
// 没有 point 就按当前卷的逐题分值补，把模块满分 / 得分算回来，
// 能力图才能算「距目标多少分」
function fillModulePoints(list, questions, paperPoints) {
  return (list || []).map((m) => {
    if (typeof m.points === 'number' && m.points > 0 && typeof m.got === 'number') return m;
    let qs = (questions || []).filter((q) => q.moduleKey === m.key);
    // 更老的记录可能只有模块里的 questions 副本
    if (!qs.length) qs = m.questions || [];
    let full = 0;
    let got = 0;
    qs.forEach((q) => {
      if (!q.scored) return;
      const point = typeof q.point === 'number' ? q.point : ((paperPoints && paperPoints[q.no - 1]) || 0);
      if (point <= 0) return;
      full += point;
      if (q.status === 'right') got += point;
    });
    const fullPoints = full > 0 ? full : (typeof m.points === 'number' ? m.points : 0);
    if (fullPoints <= 0) return m;
    return Object.assign({}, m, {
      points: Math.round(fullPoints * 100) / 100,
      pointTotal: Math.round(fullPoints * 100) / 100,
      got: typeof m.got === 'number' ? m.got : Math.round(got * 100) / 100,
    });
  });
}

function tagClass(status) {
  if (status === 'right') return 'ok';
  if (status === 'wrong') return 'bad';
  if (status === 'nostd') return 'void';
  return 'miss';
}

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    isDesktop: false,
    missing: false,
    record: null,
    detail: null,
    modules: [],
    targets: [60, 70, 80],
    radarTarget: 60, // 目标档位：60 / 70 / 80，能力图按这个画目标外框
    radarTip: null,
  },

  onLoad(query) {
    themeBind.sync(this);
    const app = getApp();
    const recordId = query.recordId || '';
    const record = recordId ? store.getRecord(recordId) : null;
    if (!record) {
      this.setData({ missing: true, isDesktop: app.globalData.isDesktop });
      return;
    }
    // 记录里的 detail 是交卷时算好的逐题结果，直接复用，不再重算
    const d = record.detail || {};
    const questions = d.questions || [];
    // 旧记录的逐题明细可能没有 point，用当前卷的逐题分值兜底
    const found = data.getPaper(record.paperId);
    const paperPoints = found ? data.questionPoints(found.paper) : [];
    const moduleStats = fillModulePoints(d.moduleStats || [], questions, paperPoints);
    const modules = moduleStats.map((m) => {
      const rows = (m.questions || []).map((q) => {
        return {
          no: q.no,
          user: q.user || '—',
          correct: q.correct || '—',
          status: q.status,
          statusText: q.status === 'right' ? '对'
            : (q.status === 'wrong' ? '错' : (q.status === 'nostd' ? '无答案' : '未做')),
          tag: tagClass(q.status),
          cells: buildCells(q),
        };
      });
      return {
        key: m.key,
        name: m.name,
        scored: m.scored,
        right: m.right,
        total: m.total,
        pct: m.pct,
        pctText: m.pct.toFixed(1),
        // 新记录才有分值口径；旧记录没有 points、或整模块都没导入标准答案时留空，不显示「0/0 分」
        pointText: typeof m.points === 'number' && m.pointTotal > 0
          ? `${fmtPoint(m.got)} / ${fmtPoint(m.points)} 分`
          : '',
        full: typeof m.points === 'number' ? m.points : 0,
        got: typeof m.got === 'number' ? m.got : 0,
        // 逐题明细默认收起：一屏先看模块得分，点模块名再展开看每题对错
        open: false,
        rows,
      };
    });
    // 正确率＝该次作答答对题数 / 计分题量（未做会拉低正确率，和真实卷面口径一致）
    const scoredMods = modules.filter((m) => m.scored);
    let rightSum = 0;
    let totalSum = 0;
    scoredMods.forEach((m) => { rightSum += m.right; totalSum += m.total; });
    const accuracy = totalSum ? (rightSum / totalSum) * 100 : 0;
    // 能力图：每个模块一条轴，值＝该模块实得 / 模块满分；没有分值口径的旧记录退回正确率
    // 注意：scoredMods 是给 WXML 的精简对象（没有 points / got），能力图要用原始 moduleStats
    const radarMods = moduleStats.filter((m) => m.scored === true);
    const radarTarget = this.data.radarTarget;
    const radarItems = radarMods.map((m) => {
      const def = MODULE_DEFS[m.key];
      const full = typeof m.points === 'number' ? m.points : 0;
      return {
        // 自定义卷的模块名可能改过，优先用卷面自己的简称
        label: m.short || (def && def.short) || m.name,
        name: m.name,
        value: full > 0 ? (m.got / full) * 100 : m.pct,
        full,
        got: typeof m.got === 'number' ? m.got : 0,
      };
    });
    this._radar = { items: radarItems, target: radarTarget };
    const tip = this.tipFor(radarItems, radarTarget);
    this.setData({
      isDesktop: app.globalData.isDesktop,
      missing: false,
      record: Object.assign({}, record, { timeText: formatTime(record.time) }),
      detail: {
        scoreText: record.score.toFixed(1),
        right: record.right,
        wrong: record.wrong,
        blank: record.blank,
        accuracyText: accuracy.toFixed(1),
        pointText: typeof d.earnedPoints === 'number' && d.totalPoints < 100
          ? `缺答案的题已剔除，按已导入的 ${fmtPoint(d.totalPoints)} 分折算`
          : '',
      },
      // 旧记录里可能还留着「附加题」模块（已删除的功能），读旧数据时直接跳过
      modules: modules.filter((m) => m.scored !== false),
      radarTip: tip,
    }, () => {
      this.drawRadar();
      // 首帧偶发拿不到 canvas 尺寸（同页 setData 刚渲染完），稍后再试一次；成功则跳过
      setTimeout(() => {
        if (!this._radarDrawn) this.drawRadar();
      }, 160);
    });
  },

  // 能力图：六边形雷达。绿框＝当前目标档（各模块按分值折算的「0 分差」线），
  // 轴末端写模块简称 + 距目标的分差，比原来那三个小刻度直观得多。
  drawRadar() {
    const radar = this._radar;
    if (!radar || !radar.items.length) return;
    wx.createSelectorQuery().in(this).select('#radar').fields({ node: true, size: true }).exec((res) => {
      const item = res && res[0];
      if (!item || !item.node || !item.width) return;
      const canvas = item.node;
      const w = item.width;
      const h = item.height;
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      this._radarDrawn = true;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const colors = theme.getCanvasColors();
      const n = radar.items.length;
      const target = radar.target || 60;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.max(34, Math.min(w, h) / 2 - 34);
      // 自定义卷最多 13 个模块：轴多时用简称 + 更小字号，但差值不能省
      const dense = n > 8;
      const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const pt = (i, k) => ({
        x: cx + Math.cos(angle(i)) * R * k,
        y: cy + Math.sin(angle(i)) * R * k,
      });
      const dataPt = (i) => {
        const k = Math.max(0.015, Math.min(1, radar.items[i].value / 100));
        return pt(i, k);
      };

      // 网格：四圈淡线，只当坐标参考；档位由绿框和轴尾差值表达，不再靠小数字
      [0.25, 0.5, 0.75, 1].forEach((k) => {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const p = pt(i, k);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 轴线
      for (let i = 0; i < n; i++) {
        const p = pt(i, 1);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 目标外框：各模块刚好达到目标分的连线（0 分差）
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = pt(i, Math.max(0.01, Math.min(1, target / 100)));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = colors.success;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 我的表现：杏色填充 + 深杏描边
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = dataPt(i);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.accentDeep;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 顶点
      for (let i = 0; i < n; i++) {
        const p = dataPt(i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.accentDeep;
        ctx.fill();
      }

      // 轴名 + 距目标的分差：+ 绿色领先 / − 红色落后
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const it = radar.items[i];
        const dirX = Math.cos(angle(i));
        const dirY = Math.sin(angle(i));
        const ax = cx + dirX * (R + (dense ? 8 : 12));
        const ay = cy + dirY * (R + (dense ? 8 : 12));
        const diff = it.full > 0 ? it.got - (it.full * target) / 100 : null;
        ctx.textAlign = dirX > 0.3 ? 'left' : (dirX < -0.3 ? 'right' : 'center');
        // 6 轴放得下全称，和参考图一致；13 轴退回简称，避免左右互相压
        const name = dense || it.name.length > 6 ? it.label : it.name;
        ctx.font = dense ? 'bold 9px sans-serif' : 'bold 11px sans-serif';
        ctx.fillStyle = colors.ink;
        ctx.fillText(name, ax, ay - (dense ? 6 : 8));
        if (diff !== null) {
          ctx.font = dense ? 'bold 9px sans-serif' : 'bold 12px sans-serif';
          ctx.fillStyle = diff >= 0 ? colors.success : colors.danger;
          ctx.fillText(signedNum(diff), ax, ay + (dense ? 5 : 9));
        }
      }
    });
  },

  // 切 60 / 70 / 80 目标档：只重算差值和重画 canvas，不整页 setData
  switchTarget(e) {
    const v = Number(e.currentTarget.dataset.v);
    if (!v || !this._radar || v === this.data.radarTarget) return;
    this._radar.target = v;
    this.setData({
      radarTarget: v,
      radarTip: this.tipFor(this._radar.items, v),
    }, () => {
      this.drawRadar();
    });
  },

  // 优先补＝距目标最远的模块，拉分最多＝超出目标最多的模块（单位：分）
  tipFor(items, target) {
    let weak = null;
    let lead = null;
    items.forEach((it) => {
      if (!(it.full > 0)) return;
      const diff = it.got - (it.full * target) / 100;
      if (!weak || diff < weak.diff) weak = { name: it.name, diff };
      if (!lead || diff > lead.diff) lead = { name: it.name, diff };
    });
    if (!weak) return null;
    return {
      // 全都超过目标时还说「优先补」会别扭，改成「最低」
      weakLabel: weak.diff < 0 ? '优先补' : '最低',
      weakName: weak.name,
      weakText: signedPoint(weak.diff),
      leadName: lead.name,
      leadText: signedPoint(lead.diff),
    };
  },
  // 模块展开 / 收起：按路径只改目标模块，整份 rows 不再重复下发；高度 0 → 实测 → auto，避免内容瞬间跳出
  toggleModule(e) {
    const key = e.currentTarget.dataset.key;
    const i = this._idxOf(key);
    if (i < 0) return;
    this._toggleRows('modules[' + i + ']', key, this.data.modules[i].open);
  },

  _idxOf(key) {
    const mods = this.data.modules || [];
    for (let i = 0; i < mods.length; i += 1) {
      if (mods[i].key === key) return i;
    }
    return -1;
  },

  _toggleRows(path, key, isOpen) {
    this._busy = this._busy || {};
    this._timers = this._timers || {};
    if (this._busy[key]) return; // 上一次展开 / 收起还没收尾，忽略连点，避免停在半开的高度
    this._busy[key] = true;
    if (isOpen) this._closeRows(path, key);
    else this._openRows(path, key);
  },

  _openRows(path, key) {
    const self = this;
    const start = {};
    start[path + '.open'] = true;
    start[path + '.h'] = '0px'; // 先在 0 高度里把逐题行渲染好，再量内容高度
    this.setData(start, () => {
      wx.createSelectorQuery().in(self).select('#qb-' + key).boundingClientRect((rect) => {
        const h = rect && rect.height ? Math.ceil(rect.height) : 0;
        if (!h) {
          // 量不到高度就直接展开，不让用户卡在 0 高度
          const fin = {};
          fin[path + '.h'] = '';
          self.setData(fin);
          self._busy[key] = false;
          return;
        }
        const grow = {};
        grow[path + '.h'] = h + 'px';
        self.setData(grow, () => {
          self._timers[key] = setTimeout(() => {
            const fin = {};
            fin[path + '.h'] = ''; // 交还 auto：窗口缩放时内容不会被固定高度裁掉
            self.setData(fin);
            self._busy[key] = false;
          }, 300);
        });
      }).exec();
    });
  },

  _closeRows(path, key) {
    const self = this;
    wx.createSelectorQuery().in(self).select('#qw-' + key).boundingClientRect((rect) => {
      const h = rect && rect.height ? Math.ceil(rect.height) : 0;
      if (!h) {
        self._finishClose(path, key);
        return;
      }
      const fix = {};
      fix[path + '.h'] = h + 'px'; // 当前是 auto，先落成具体高度，下一步才能过渡
      self.setData(fix, () => {
        // 等这一帧高度真正生效，再收到 0，过渡才有起点
        const toZero = () => {
          const shrink = {};
          shrink[path + '.h'] = '0px';
          self.setData(shrink, () => {
            self._timers[key] = setTimeout(() => {
              self._finishClose(path, key);
            }, 300);
          });
        };
        if (wx.nextTick) wx.nextTick(toZero);
        else self._timers[key] = setTimeout(toZero, 30);
      });
    }).exec();
  },

  _finishClose(path, key) {
    const fin = {};
    fin[path + '.open'] = false;
    fin[path + '.h'] = '';
    this.setData(fin);
    if (this._busy) this._busy[key] = false;
  },

  // 离开页面时清掉未跑完的高度过渡定时器
  onUnload() {
    const timers = this._timers || {};
    const keys = Object.keys(timers);
    for (let i = 0; i < keys.length; i += 1) clearTimeout(timers[keys[i]]);
    this._timers = {};
    this._busy = {};
  },

  // 自定义顶栏返回：有上级就回上级，直接打开时回批改首页
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/grade/index/index' }) });
    } else {
      wx.reLaunch({ url: '/pages/grade/index/index' });
    }
  },

  onResize() {
    const app = getApp();
    if (app && app.detectEnvironment) app.detectEnvironment();
    this.setData({ isDesktop: app.globalData.isDesktop }, () => {
      this.drawRadar();
    });
  },

  // 同卷重做：先清掉草稿，避免进去还是上次的答案
  retryPaper() {
    const paperId = this.data.record && this.data.record.paperId;
    if (!paperId) return;
    store.clearDraft(paperId);
    wx.redirectTo({
      url: `/pages/grade/answer/answer?paperId=${paperId}&mode=single`,
      fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' }),
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/grade/index/index' });
  },
});
