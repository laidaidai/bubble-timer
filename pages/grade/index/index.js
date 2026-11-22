const themeBind = require('../utils/theme-bind.js');
const theme = require('../utils/theme.js');
const { BANKS, getPaper } = require('../utils/data.js');
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
        const meta = `共 ${paper.total} 题`;
        // 有草稿就在卡片上说明「上次没交卷、已答多少」，否则用户不知道为什么点进去是半套答案
        const draft = store.getDraft(p.id) || {};
        const draftCount = Object.keys(draft).filter((k) => draft[k]).length;
        return Object.assign({}, paper, {
          lastScore: lastScore,
          meta: meta,
          hasScore: lastScore !== null,
          draftCount: draftCount,
          size: paper.total,
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
          url: `/pages/grade/answer/answer?paperId=${id}&mode=list`,
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
