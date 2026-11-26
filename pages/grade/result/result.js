const themeBind = require('../utils/theme-bind.js');
const store = require('../utils/store.js');
const theme = require('../utils/theme.js');
const data = require('../utils/data.js');
const { MODULE_DEFS } = data;
const {
  resetSheetDrag,
  startSheetDrag,
  moveSheetDrag,
  endSheetDrag,
  cancelSheetDrag,
} = require('../../../utils/format.js');

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

// 计时摘要里的短时长：秒数 / 分钟 / 小时；只保留有效单位
function clockSpan(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return total < 60
    ? `${total} 秒`
    : `${Math.round(total / 60)} 分钟`;
}

function deltaTimeText(seconds) {
  const v = Number(seconds) || 0;
  if (!v) return '持平';
  return `${v > 0 ? '超' : '提前'} ${clockSpan(Math.abs(v))}`;
}

function timeTone(seconds) {
  const v = Number(seconds) || 0;
  return v > 0 ? 'late' : (v < 0 ? 'early' : 'even');
}

// 模块距目标的分差（分）＝该模块实得分 − 该模块满分 × 目标百分比。
// 绘制轴尾、底部提示都调这一个函数，切 60 / 70 / 80 时按同一口径实时重算。
function moduleDiff(item, target) {
  if (!item || !(item.full > 0)) return null;
  const diff = item.got - (item.full * target) / 100;
  return Math.round(diff * 10) / 10;
}

// 逐题对错：四格 A/B/C/D，只标「正解」与「你选」；跨用户的选项人数/占比需要服务端统计，本地不做

// 能力图拆成两层静止图：底图（网格 / 轴 / 轴名、原始分与差值）和曲线层（目标框 / 我的曲线 / 顶点）。
// 曲线层是透明 PNG，展示时绕圆心从 1.5% 放大到 100%，就是每个顶点从中心点往四周扩。
function radarGeometry(cfg) {
  const { w, h, items } = cfg;
  const n = items.length;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.max(34, Math.min(w, h) / 2 - 34);
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, k) => ({
    x: cx + Math.cos(angle(i)) * R * k,
    y: cy + Math.sin(angle(i)) * R * k,
  });
  return { n, cx, cy, R, angle, pt };
}

function drawRadarBase(ctx, cfg) {
  const { w, h, items, target, colors, dense } = cfg;
  const { n, cx, cy, R, angle, pt } = radarGeometry(cfg);
  ctx.clearRect(0, 0, w, h);

  // 网格：四圈淡线，只当坐标参考
  [0.25, 0.5, 0.75, 1].forEach((k) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = pt(i, k);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.closePath();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 轴线
  for (let i = 0; i < n; i++) {
    const q = pt(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(q.x, q.y);
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // D1 轴端：模块名 / 原始分 / 距目标分差三行，固定不动，曲线在它上面扩。
  // 原始分优先 got/full；旧记录没有分值口径时退回百分比，避免出现 0/0。
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const dirX = Math.cos(angle(i));
    const dirY = Math.sin(angle(i));
    const ax = cx + dirX * (R + (dense ? 8 : 12));
    const ay = cy + dirY * (R + (dense ? 8 : 12));
    const diff = moduleDiff(it, target);
    const name = dense || it.name.length > 6 ? it.label : it.name;
    const scoreText = it.full > 0
      ? `${fmtPoint(it.got)}/${fmtPoint(it.full)}`
      : `${Math.round(it.value)}%`;
    ctx.textAlign = dirX > 0.3 ? 'left' : (dirX < -0.3 ? 'right' : 'center');
    ctx.font = dense ? 'bold 9px sans-serif' : 'bold 11px sans-serif';
    ctx.fillStyle = colors.ink;
    ctx.fillText(name, ax, ay - (dense ? 11 : 15));
    ctx.font = dense ? '8px sans-serif' : '9px sans-serif';
    ctx.fillStyle = colors.sub;
    ctx.fillText(scoreText, ax, ay - 2);
    if (diff !== null) {
      ctx.font = dense ? 'bold 9px sans-serif' : 'bold 11px sans-serif';
      ctx.fillStyle = diff >= 0 ? colors.success : colors.danger;
      ctx.fillText(signedNum(diff), ax, ay + (dense ? 8 : 12));
    }
  }
}

function drawRadarCurve(ctx, cfg) {
  const { w, h, items, target, colors } = cfg;
  const { n, pt } = radarGeometry(cfg);
  ctx.clearRect(0, 0, w, h);

  // 目标外框
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const q = pt(i, Math.max(0.01, Math.min(1, target / 100)));
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
  ctx.strokeStyle = colors.success;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 我的表现：杏色填充 + 深杏描边
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const q = pt(i, Math.max(0.015, Math.min(1, items[i].value / 100)));
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
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
    const q = pt(i, Math.max(0.015, Math.min(1, items[i].value / 100)));
    ctx.beginPath();
    ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = colors.accentDeep;
    ctx.fill();
  }
}

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
function fillModulePoints(list, questions, paperPoints, paperFull) {
  return (list || []).map((m) => {
    let qs = (questions || []).filter((q) => q.moduleKey === m.key);
    // 更老的记录可能只有模块里的 questions 副本
    if (!qs.length) qs = m.questions || [];
    // 有答案的题才算分：分母缩水后按同一比例折算回模块满分（与 score.js 同口径）
    let modPoints = 0;
    let modEarned = 0;
    qs.forEach((q) => {
      if (!q.scored || q.status === 'nostd') return;
      // 优先按当前卷面的每题分值重算；老记录自带的 point 只作兜底
      const point = (paperPoints && paperPoints[q.no - 1]) || (typeof q.point === 'number' ? q.point : 0);
      if (point <= 0) return;
      modPoints += point;
      if (q.status === 'right') modEarned += point;
    });
    // 模块满分以当前卷面 layout 为准（例如资料分析从 24 修正为 20），
    // 这样旧记录不会继续沿用作废的分值
    const layoutPoints = paperFull && paperFull[m.key] > 0 ? paperFull[m.key] : 0;
    const savedPoints = typeof m.points === 'number' && m.points > 0 ? m.points : 0;
    const fullPoints = layoutPoints || savedPoints || modPoints;
    if (fullPoints <= 0) return m;
    // 能逐题重算就一定重算，记录里存的老值只作兜底，避免能力图沿用过期的 got
    const got = modPoints > 0
      ? Math.round((modEarned / modPoints) * fullPoints * 100) / 100
      : (typeof m.got === 'number' ? m.got : 0);
    return Object.assign({}, m, {
      points: Math.round(fullPoints * 100) / 100,
      pointTotal: Math.round(modPoints * 100) / 100,
      got,
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
    radarTarget: 60,
    reviewOpen: false, // 答题卡浮层
    sheetDragY: 0,
    sheetDragging: false,
    sheetSettling: false,
    radarTip: null,
    radarBaseImage: '',
    radarCurveImage: '',
    radarGrow: false,
    radarDrawing: false,
    timerSummary: null,
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
    const paperFull = {};
    if (found) {
      data.paperModules(found.paper).forEach((m) => { paperFull[m.key] = m.points; });
    }
    const moduleStats = fillModulePoints(d.moduleStats || [], questions, paperPoints, paperFull);
    // 只有带计时的会话才有时长；旧成绩没有 timer，整块用时分析自动隐藏。
    const timer = record.timer || null;
    const timerRows = (timer && Array.isArray(timer.rows)) ? timer.rows : [];
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
        // 模块用时按 moduleKey 对齐；旧计时没有 key 时退回模块名匹配
        ...(function () {
          const tr = timerRows.length
            ? timerRows.find((r) => r.moduleKey === m.key || (!r.moduleKey && r.name === m.name))
            : null;
          // 没切到过的模块没有可信用时，不能拿 0 秒去算「提前」，宁可不显示。
          if (!tr || (Number(tr.elapsedSeconds) || 0) <= 0) return {};
          return {
            timeText: tr.actualText || clockSpan(tr.elapsedSeconds),
            timeTargetText: tr.targetMinutes ? `目标 ${tr.targetMinutes} 分钟` : '',
            timeDeltaText: deltaTimeText(tr.deltaSeconds),
            timeTone: timeTone(tr.deltaSeconds),
          };
        })(),
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
      const full = typeof m.points === 'number' && m.points > 0
        ? m.points
        : (typeof m.pointTotal === 'number' ? m.pointTotal : 0);
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
    let timerSummary = null;
    if (timer) {
      const targetMinutes = Number(timer.totalTarget) || timerRows.reduce((sum, r) => sum + (Number(r.targetMinutes) || 0), 0);
      const deltaSeconds = typeof timer.deltaSeconds === 'number'
        ? timer.deltaSeconds
        : (Number(timer.totalActual) || 0) - targetMinutes * 60;
      timerSummary = {
        totalText: timer.totalActualText || clockSpan(timer.totalActual),
        targetText: timer.totalTargetText || (targetMinutes ? `${targetMinutes} 分钟` : ''),
        deltaText: timer.deltaText || (targetMinutes ? deltaTimeText(deltaSeconds) : ''),
        tone: timer.tone || timeTone(deltaSeconds),
      };
    }
    // 旧记录里可能还留着「附加题」模块（已删除的功能），读旧数据时直接跳过
    const visibleModules = modules.filter((m) => m.scored !== false);
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
      modules: visibleModules,
      radarTip: tip,
      timerSummary,
    }, () => {
      // 首帧可能拿不到 canvas 节点/尺寸；onReady、onShow 和这里都会补画，
      // drawRadar 内部再按次数退避重试，避免页面渲染慢时只试一次就留下空白。
      this.drawRadar();
    });
  },

  onReady() {
    if (this._radar) this.drawRadar();
  },

  onShow() {
    // 从后台回到结果页时 canvas 可能被系统释放，可见后再补一次
    if (this._radar) this.drawRadar();
  },

  // 能力图：六边形雷达。底图和曲线分两次导出，曲线用 CSS 从中心向外放大。
  // 绿框＝当前目标档，杏色＝我的表现；轴末端写模块简称、原始分与距目标的分差。
  drawRadar(retry = 0) {
    const radar = this._radar;
    if (!radar || !radar.items.length) return;
    // 画布始终在图表区左侧的离屏层，导出 PNG 后移除；不在滚动区里显示原生画布，
    // 否则原生层不跟随 scroll-view 滚动，会浮在模块卡上。
    if (!this.data.radarDrawing) {
      this.setData({
        radarDrawing: true,
        radarBaseImage: '',
        radarCurveImage: '',
        radarGrow: false,
      }, () => this.drawRadar(retry));
      return;
    }
    // 只让最后一次查询落地，避免多个生命周期同时补画时旧回调把新画布覆盖
    const seq = this._radarSeq = (this._radarSeq || 0) + 1;
    wx.createSelectorQuery().in(this).select('#radar').fields({ node: true, size: true }).exec((res) => {
      if (seq !== this._radarSeq) return;
      const item = res && res[0];
      if (!item || !item.node || !item.width || !item.height) {
        this._radarDrawn = false;
        if (retry < 4) {
          clearTimeout(this._radarTimer);
          this._radarTimer = setTimeout(() => this.drawRadar(retry + 1), 90 + retry * 120);
        }
        return;
      }
      const canvas = item.node;
      const w = item.width;
      const h = item.height;
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const colors = theme.getCanvasColors();
      const n = radar.items.length;
      const cfg = {
        w,
        h,
        items: radar.items,
        target: radar.target || 60,
        colors,
        dense: n > 8,
      };

      // 先导出静态底图，再清空画布导出只剩曲线的透明层
      drawRadarBase(ctx, cfg);
      this.exportRadarPart(canvas, seq, (basePath) => {
        if (seq !== this._radarSeq) return;
        this.setData({ radarBaseImage: basePath });
        ctx.clearRect(0, 0, w, h);
        drawRadarCurve(ctx, cfg);
        this.exportRadarPart(canvas, seq, (curvePath) => {
          if (seq !== this._radarSeq) return;
          this._radarDrawn = true;
          this._radarExportFails = 0;
          this.setData({
            radarCurveImage: curvePath,
            radarDrawing: false,
            radarGrow: false,
          }, () => {
            // bindload 正常会触发；这里再兜一层，临时文件很快就能读到
            clearTimeout(this._radarGrowTimer);
            this._radarGrowTimer = setTimeout(() => {
              if (seq !== this._radarSeq) return;
              if (!this.data.radarGrow) this.setData({ radarGrow: true });
            }, 90);
          });
        });
      });
    });
  },

  // 曲线图加载完再启动放大，避免先闪一下终态再缩回去
  onCurveLoad() {
    if (!this.data.radarCurveImage || this.data.radarGrow) return;
    clearTimeout(this._radarGrowTimer);
    this.setData({ radarGrow: true });
  },

  // 单次导出；失败时整张重画，最多重试 2 次
  exportRadarPart(canvas, seq, onDone) {
    if (!canvas || !wx.canvasToTempFilePath) return;
    wx.canvasToTempFilePath({
      canvas,
      fileType: 'png',
      success: (res) => {
        if (seq !== this._radarSeq) return;
        if (!res || !res.tempFilePath) return;
        if (onDone) onDone(res.tempFilePath);
      },
      fail: () => {
        if (seq !== this._radarSeq) return;
        this._radarExportFails = (this._radarExportFails || 0) + 1;
        if (this._radarExportFails > 2) {
          this.setData({
            radarDrawing: false,
            radarBaseImage: '',
            radarCurveImage: '',
            radarGrow: false,
          });
          return;
        }
        this._radarDrawn = false;
        clearTimeout(this._radarTimer);
        this._radarTimer = setTimeout(() => this.drawRadar(), 120);
      },
    }, this);
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
      const diff = moduleDiff(it, target);
      if (diff === null) return;
      if (!weak || diff < weak.diff) weak = { name: it.name, diff };
      if (!lead || diff > lead.diff) lead = { name: it.name, diff };
    });
    if (!weak) return null;
    // 全都低于目标时，lead 只是「最接近目标」的模块，不能叫「拉分最多」
    const leadAbove = lead.diff > 0;
    return {
      // 全都超过目标时还说「优先补」会别扭，改成「最低」
      weakLabel: weak.diff < 0 ? '优先补' : (weak.diff === 0 ? '刚好达标' : '最低'),
      weakName: weak.name,
      weakText: signedPoint(weak.diff),
      weakTone: weak.diff < 0 ? 'weak' : 'close',
      leadLabel: leadAbove ? '拉分最多' : (lead.diff === 0 ? '刚好达标' : '最接近'),
      leadName: lead.name,
      leadText: signedPoint(lead.diff),
      leadTone: leadAbove ? 'lead' : 'close',
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

  openReview() {
    resetSheetDrag(this)
    this.setData({ reviewOpen: true })
  },

  closeReview() {
    if (!this.data.reviewOpen) return
    resetSheetDrag(this)
    this.setData({ reviewOpen: false }, () => {
      // canvas 在浮层期间移除，避免原生画布盖在遮罩上；收起后重新查询节点补画
      setTimeout(() => this.drawRadar(), 80)
    })
  },

  onSheetGripStart(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {}
    startSheetDrag(this, e, { selector: dataset.selector, close: dataset.close })
  },

  onSheetGripMove(e) {
    moveSheetDrag(this, e)
  },

  onSheetGripEnd(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {}
    endSheetDrag(this, e, { selector: dataset.selector, close: dataset.close })
  },

  onSheetGripCancel() {
    cancelSheetDrag(this)
  },

  noop() {},

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
      url: `/pages/grade/answer/answer?paperId=${paperId}&mode=single&noTimer=1`,
      fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' }),
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/grade/index/index' });
  },
});
