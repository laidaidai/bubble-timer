const themeBind = require('../utils/theme-bind.js');
const theme = require('../utils/theme.js');
const { BANKS, getPaper, paperTimePlan } = require('../utils/data.js');
const store = require('../utils/store.js');
const custom = require('../utils/custom.js');

Page({
  data: {
    theme: themeBind.themeData().theme,
    themeStyle: themeBind.themeData().themeStyle,
    banks: [],
    bankId: 'bank-a',
    currentBankName: '',
    groups: [],
    collapsed: {},
    homeSummary: {
      total: 0,
      papers: 0,
      hasLast: false,
      lastScore: '—',
      lastPaper: '选一套卷，开始批改',
    },
    isDesktop: false,
    pageReveal: true,
  },

  onLoad() {
    themeBind.sync(this);
    const app = getApp();
    this.setData({
      banks: BANKS,
      isDesktop: app.globalData.isDesktop,
    });
    this.switchBank({ currentTarget: { dataset: { id: 'bank-a' } } });
  },

  onShow() {
    // 回到首页时刷新上次得分（可能刚交卷），自定义卷可能刚在自定义页新建 / 改过
    custom.sync();
    const app = getApp();
    if (app && app.globalData && app.globalData.revealCustom) {
      app.globalData.revealCustom = false;
      const bank = BANKS.find((b) => b.id === 'bank-custom');
      if (bank) {
        const collapsed = this.defaultCollapsed(bank);
        collapsed['group-custom'] = false;
        this.setData({ bankId: 'bank-custom', collapsed });
      }
    }
    this.refreshGroups();
    // 首次渲染已经带 reveal，不重播；从答题 / 子页回来再重播一次
    if (this._shownOnce) {
      this.playReveal();
    } else {
      this._shownOnce = true;
    }
  },

  // 重播入场：摘掉 reveal 后立刻在下一帧挂上，避免中间留出一段空白
  playReveal() {
    if (this._revealTimer) clearTimeout(this._revealTimer);
    this.setData({ pageReveal: false });
    const show = () => {
      this._revealTimer = null;
      this.setData({ pageReveal: true });
    };
    if (wx.nextTick) {
      wx.nextTick(show);
    } else {
      this._revealTimer = setTimeout(show, 16);
    }
  },

  onHide() {
    if (this._revealTimer) {
      clearTimeout(this._revealTimer);
      this._revealTimer = null;
    }
  },

  refreshGroups() {
    const bank = BANKS.find((b) => b.id === this.data.bankId) || BANKS[0];
    this.setData({
      banks: BANKS,
      bankId: bank.id,
      currentBankName: bank.name,
    });
    const groups = bank.groups.map((g) => {
      const papers = g.papers.map((p) => {
        // 预设卷可能被用户改过题量 / 分值，列表要显示改后的卷面，而不是内置原始值
        const found = getPaper(p.id);
        const paper = found ? found.paper : p;
        const last = store.getLastScore(p.id);
        const lastScore = last === null ? p.lastScore : last;
        const timePlan = found ? this.buildTimePlan(found) : null;
        const meta = timePlan
          ? `共 ${paper.total} 题 · ${timePlan.totalMinutes} 分钟`
          : `共 ${paper.total} 题`;
        // 有草稿就在卡片上说明「上次没交卷、已答多少」，否则用户不知道为什么点进去是半套答案
        const draft = store.getDraft(p.id) || {};
        const draftCount = Object.keys(draft).filter((k) => draft[k]).length;
        const timerActive = store.getActiveTrainingForPaper(p.id);
        const timerPending = store.getPendingTimerForPaper(p.id);
        return Object.assign({}, paper, {
          lastScore: lastScore,
          meta: meta,
          hasScore: lastScore !== null,
          draftCount: draftCount,
          size: paper.total,
          timerState: timerActive ? 'active' : (timerPending ? 'pending' : ''),
        });
      });
      return Object.assign({}, g, {
        papers: papers,
        totalQuestions: papers.reduce((sum, p) => sum + (Number(p.total) || 0), 0),
      });
    });

    const stored = store.getRecords();
    const records = Array.isArray(stored) ? stored : [];
    const last = records.length ? records[0] : null;
    const rawScore = last ? last.score : null;
    const hasScore = rawScore !== null && rawScore !== undefined && rawScore !== '' && isFinite(Number(rawScore));
    const score = hasScore ? Number(rawScore) : null;
    const paperMap = {};
    for (let i = 0; i < records.length; i += 1) {
      if (records[i] && records[i].paperId) paperMap[records[i].paperId] = true;
    }
    this.setData({
      groups,
      homeSummary: {
        total: records.length,
        papers: Object.keys(paperMap).length,
        hasLast: score !== null,
        lastScore: score === null ? '—' : String(Math.round(score * 10) / 10),
        lastPaper: last && last.paperName ? last.paperName : '点开一套卷开始作答',
      },
    });
  },

  // 首页默认展开第一组，进入页面即可看到试卷卡；其余分组保持收起
  defaultCollapsed(bank) {
    const map = {};
    for (let i = 0; i < bank.groups.length; i += 1) map[bank.groups[i].id] = i > 0;
    return map;
  },

  switchBank(e) {
    const id = e.currentTarget.dataset.id;
    const bank = BANKS.find((b) => b.id === id) || BANKS[0];
    this.setData({ bankId: bank.id, collapsed: this.defaultCollapsed(bank) });
    this.refreshGroups();
  },

  toggleGroup(e) {
    const id = e.currentTarget.dataset.id;
    const collapsed = Object.assign({}, this.data.collapsed);
    collapsed[id] = !collapsed[id];
    this.setData({ collapsed });
  },

  // 批改首页从工具页进入；没有上级栈时直接回工具页
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/tools/tools' }) });
    } else {
      wx.switchTab({ url: '/pages/tools/tools' });
    }
  },

  goLetter() {
    wx.navigateTo({ url: '/pages/grade/letter/letter' });
  },

  goCustom() {
    wx.navigateTo({ url: '/pages/grade/custom/custom' });
  },

  // 自定义卷的编辑入口：带着 id 进独立表单页，卷列表不掺表单
  editCustom(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/grade/custom/custom?id=${id}` });
  },

  // 预设卷也允许改题量 / 分值：同一个表单页，用 paperId 区分，不动内置题库文件
  editPaper(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/grade/custom/custom?paperId=${id}` });
  },

  goHistory(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/grade/history/history?paperId=${id}` });
  },

  goAnswers(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/grade/answers/answers?paperId=${id}` });
  },

  // 从试卷卡带卷起跑：模块、题号区间、默认时长全部来自本卷，
  // 计时页只负责累计时间，不再让用户选一套不相干的训练模板。
  goTimedPaper(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    const active = store.getActiveTrainingSession();
    if (active) {
      const same = active.context && active.context.paperId === id;
      if (same) {
        wx.showModal({
          title: '计时还没结束',
          content: '上次计时保留了进度，可以接着跑；重新计时会丢弃上次未完成的计时。',
          confirmText: '继续计时',
          cancelText: '重新计时',
          success: (r) => {
            if (r.confirm) {
              this.resumeActiveTimer();
            } else {
              this.confirmRestartTimer(id);
            }
          },
        });
      } else {
        const name = (active.context && active.context.paperName) || '另一项训练';
        wx.showModal({
          title: '正在计时',
          content: `「${name}」的计时还没结束，先完成或返回后再开始这套卷。`,
          confirmText: '去查看',
          cancelText: '取消',
          success: (r) => {
            if (r.confirm) this.resumeActiveTimer();
          },
        });
      }
      return;
    }
    const pending = store.getPendingTimerForPaper(id);
    if (pending) {
      wx.showModal({
        title: '这次计时还没填答案',
        content: `已保存 ${this.durationText(pending.totalActual)} 的分模块用时，先去填答案？`,
        confirmText: '去填答案',
        cancelText: '重新计时',
        success: (r) => {
          if (r.confirm) this.openPendingTimer(id, pending.id);
          else this.openTimerPlan(id);
        },
      });
      return;
    }
    this.openTimerPlan(id);
  },

  resumeActiveTimer() {
    wx.navigateTo({
      url: '/pages/blank/blank?mode=enter',
      fail: () => wx.showToast({ title: '打开计时页失败，请重试', icon: 'none' }),
    });
  },

  openPendingTimer(paperId, timerId) {
    wx.navigateTo({
      url: `/pages/grade/answer/answer?paperId=${paperId}&timerId=${timerId}`,
      fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' }),
    });
  },

  confirmRestartTimer(paperId) {
    const app = getApp();
    wx.showModal({
      title: '重新计时',
      content: '会丢弃上次未完成的计时，已作答的草稿会保留。',
      confirmText: '重新计时',
      confirmColor: '#E8442F',
      success: (r) => {
        if (!r.confirm) return;
        try { wx.removeStorageSync(app.globalData.storageKey); } catch (e) {}
        this.openTimerPlan(paperId);
      },
    });
  },

  // 默认配时来自本卷；用户改过的模块分钟存在本卷自己的覆盖里。
  buildTimePlan(found) {
    const base = paperTimePlan(found.paper, found.group.id);
    const saved = store.getPaperTimerPlan(found.paper.id);
    const plan = base.map((m) => {
      const savedMinutes = saved[m.key];
      return Object.assign({}, m, {
        targetMinutes: savedMinutes ? savedMinutes : m.targetMinutes,
      });
    });
    const totalMinutes = plan.reduce((sum, m) => sum + (Number(m.targetMinutes) || 0), 0);
    const isCustom = plan.some((m, i) => m.targetMinutes !== base[i].targetMinutes);
    return { base, plan, totalMinutes, isCustom };
  },

  timerPlanFor(paperId) {
    const found = getPaper(paperId);
    if (!found) return null;
    return Object.assign({ found }, this.buildTimePlan(found));
  },

  // 进入独立的「本卷配时」页：模块与题号仍由试卷决定，只调整各段时长。
  openTimerPlan(paperId) {
    if (!paperId) return;
    const info = this.timerPlanFor(paperId);
    if (!info || !info.plan.length) {
      wx.showToast({ title: '这套卷还没有模块', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/grade/plan/plan?paperId=${encodeURIComponent(paperId)}`,
      fail: () => wx.showToast({ title: '打不开本卷配时', icon: 'none' }),
    });
  },

  durationText(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  },

  // 草稿行内单独提供「重做」：清空进度后再进答题页，
  // 否则答题页会自动恢复上次答案，用户以为改不动
  restartPaper(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) return;
    const themeInfo = theme.getTheme() || {};
    const danger = (themeInfo.css && themeInfo.css.danger) || '#D9534F';
    wx.showModal({
      title: '重新开始',
      content: `会清空「${name || '这份试卷'}」已答的进度，从第 1 题重新作答，确认？`,
      confirmText: '清空重做',
      confirmColor: danger,
      success: (r) => {
        if (!r.confirm) return;
        store.clearDraft(id);
        this.refreshGroups();
        wx.navigateTo({
          url: `/pages/grade/answer/answer?paperId=${id}&mode=list&noTimer=1`,
          fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' })
        });
      },
    });
  },

  // 桌面端拖动窗口 / 手机横竖屏切换时，重算一次宽屏判定，避免布局还按旧档走
  onResize() {
    const app = getApp();
    if (app && app.detectEnvironment) app.detectEnvironment();
    this.setData({ isDesktop: app.globalData.isDesktop });
  },
});
